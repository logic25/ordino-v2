// recompute-baselines — nightly job.
// 1. Refreshes service_duration_baselines per (type, complexity, building_class, client_tier, is_pro_cert)
//    from completed services in the last 365 days (winsorized 10/90, ≥3 samples required).
// 2. Refreshes clients.client_tier from client_payment_analytics.
// 3. Snapshots prediction accuracy (rolling 30d) into prediction_accuracy_history.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function normalizeServiceName(name: string): string {
  let n = (name || "").toLowerCase();
  const patterns: [RegExp, string][] = [
    [/pro(?:fessional)?\s*cert/i, "pro_cert"],
    [/paa\b/i, "paa"], [/pw\s*1/i, "pw1"], [/pw\s*3/i, "pw3"],
    [/tr\s*1/i, "tr1"], [/tr\s*8/i, "tr8"], [/after.?hours|ahv/i, "ahv"],
    [/place\s*of\s*assembly|poa/i, "poa"], [/bsa\b/i, "bsa"],
    [/landmark/i, "landmarks"], [/dep\b/i, "dep"], [/fdny|fire\s*dept/i, "fdny"],
    [/alt(eration)?\s*(type\s*)?\d/i, "alteration"], [/work\s*permit/i, "work_permit"],
    [/letter\s*of\s*completion|loc\b/i, "loc"], [/oer\b|environmental/i, "oer"],
    [/temporary\s*cert|tco\b/i, "tco"], [/cert\s*of\s*occupancy|c\s*of\s*o/i, "co_cert"],
    [/sign.?off/i, "sign_off"], [/violation/i, "violation"],
    [/amendment/i, "amendment"], [/approval/i, "approval"], [/inspection/i, "inspection"],
  ];
  for (const [p, c] of patterns) if (p.test(n)) return c;
  return n.trim();
}

function median(arr: number[]) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function percentile(arr: number[], p: number) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[idx];
}
function winsorize(arr: number[], pct = 10): number[] {
  if (arr.length < 5) return arr;
  const lo = percentile(arr, pct);
  const hi = percentile(arr, 100 - pct);
  return arr.map(v => Math.min(hi, Math.max(lo, v)));
}
function stddev(arr: number[]) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

async function recomputeForCompany(admin: any, companyId: string) {
  // 1. Update client tiers from payment analytics
  const { data: pa } = await admin
    .from("client_payment_analytics")
    .select("client_id, avg_days_to_pay")
    .eq("company_id", companyId);
  for (const r of (pa || []) as any[]) {
    let tier = "normal";
    const d = Number(r.avg_days_to_pay) || 0;
    if (d > 0 && d < 30) tier = "fast";
    else if (d > 60) tier = "slow";
    await admin.from("clients").update({ client_tier: tier }).eq("id", r.client_id);
  }

  // 2. Pull last-year completed services with their project + property + client
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString();
  const { data: services } = await admin
    .from("services")
    .select(`
      id, name, status, created_at, completed_date, billed_at, is_pro_cert,
      projects:project_id(
        project_complexity_tier,
        properties:property_id(bldgclass),
        clients:client_id(client_tier)
      )
    `)
    .eq("company_id", companyId)
    .or(`status.eq.billed,completed_date.not.is.null`)
    .gte("created_at", cutoff)
    .limit(5000);

  // 3. Sum minutes per service
  const ids = (services || []).map((s: any) => s.id);
  const minutesById = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    if (!chunk.length) continue;
    const { data: acts } = await admin
      .from("activities").select("service_id, duration_minutes").in("service_id", chunk);
    (acts || []).forEach((a: any) => {
      if (!a.service_id) return;
      minutesById.set(a.service_id, (minutesById.get(a.service_id) || 0) + (Number(a.duration_minutes) || 0));
    });
  }

  // 4. Group
  type Group = { activeDays: number[]; totalDays: number[]; hours: number[] };
  const groups = new Map<string, { key: any; g: Group }>();
  for (const s of (services || []) as any[]) {
    const end = s.billed_at || s.completed_date;
    const start = s.created_at;
    if (!start || !end) continue;
    const totalDays = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
    if (totalDays > 730) continue;
    const hours = (minutesById.get(s.id) || 0) / 60;
    // "active days" proxy: hours/8 (avg workday); if no time logged, fall back to totalDays
    const activeDays = hours > 0 ? Math.max(1, Math.round(hours / 8)) : totalDays;
    const type = normalizeServiceName(s.name);
    const complexity = s.projects?.project_complexity_tier || null;
    const buildingClass = (s.projects?.properties?.bldgclass || "").slice(0, 1) || null;
    const clientTier = s.projects?.clients?.client_tier || null;
    const isProCert = !!s.is_pro_cert;
    // Emit rows at every fallback level so lookups always find at least one
    const variants = [
      { complexity, building_class: buildingClass, client_tier: clientTier, is_pro_cert: isProCert },
      { complexity, building_class: null, client_tier: clientTier, is_pro_cert: isProCert },
      { complexity, building_class: null, client_tier: null, is_pro_cert: isProCert },
      { complexity: null, building_class: null, client_tier: null, is_pro_cert: isProCert },
      { complexity: null, building_class: null, client_tier: null, is_pro_cert: false },
    ];
    for (const v of variants) {
      const k = JSON.stringify({ type, ...v });
      if (!groups.has(k)) groups.set(k, { key: { type, ...v }, g: { activeDays: [], totalDays: [], hours: [] } });
      const grp = groups.get(k)!.g;
      grp.activeDays.push(activeDays);
      grp.totalDays.push(totalDays);
      grp.hours.push(hours);
    }
  }

  // 5. Upsert baselines (only groups with ≥3 samples)
  const rows: any[] = [];
  for (const { key, g } of groups.values()) {
    if (g.activeDays.length < 3) continue;
    const wActive = winsorize(g.activeDays);
    const wTotal = winsorize(g.totalDays);
    rows.push({
      company_id: companyId,
      service_type: key.type,
      complexity: key.complexity,
      building_class: key.building_class,
      client_tier: key.client_tier,
      is_pro_cert: key.is_pro_cert,
      median_active_days: median(wActive),
      median_total_days: median(wTotal),
      median_hours: median(g.hours),
      p20_days: percentile(wTotal, 20),
      p80_days: percentile(wTotal, 80),
      std_dev_days: stddev(wTotal),
      sample_size: g.activeDays.length,
      computed_at: new Date().toISOString(),
    });
  }
  if (rows.length) {
    await admin.from("service_duration_baselines").upsert(rows, {
      onConflict: "company_id,service_type,complexity,building_class,client_tier,is_pro_cert",
    });
  }

  // 6. Snapshot accuracy
  const win = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: outcomes } = await admin
    .from("prediction_outcomes")
    .select("error_days, service_id, services:service_id(name)")
    .eq("company_id", companyId)
    .not("actual_billed_date", "is", null)
    .gte("actual_billed_date", win);
  const byType = new Map<string, number[]>();
  const overall: number[] = [];
  (outcomes || []).forEach((o: any) => {
    const err = Math.abs(Number(o.error_days) || 0);
    overall.push(err);
    const t = normalizeServiceName(o.services?.name || "");
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(err);
  });
  const snapshot = (label: string | null, errs: number[]) => ({
    company_id: companyId,
    service_type: label,
    snapshot_date: new Date().toISOString().slice(0, 10),
    sample_size: errs.length,
    pct_within_7d: errs.length ? +(errs.filter(e => e <= 7).length / errs.length * 100).toFixed(2) : 0,
    pct_within_14d: errs.length ? +(errs.filter(e => e <= 14).length / errs.length * 100).toFixed(2) : 0,
    pct_within_30d: errs.length ? +(errs.filter(e => e <= 30).length / errs.length * 100).toFixed(2) : 0,
    median_abs_error_days: errs.length ? median(errs) : 0,
  });
  const accRows = [snapshot(null, overall), ...Array.from(byType.entries()).map(([t, e]) => snapshot(t, e))];
  if (accRows.length) {
    await admin.from("prediction_accuracy_history").upsert(accRows, {
      onConflict: "company_id,service_type,snapshot_date",
    });
  }

  return { baselineRows: rows.length, accuracyRows: accRows.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 200 });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    const cronHdr = req.headers.get("x-cron-secret");
    const envCron = Deno.env.get("CRON_SECRET");
    const isCron = cronHdr && cronHdr === envCron;

    let companyIds: string[] = [];
    if (isCron) {
      const { data: cos } = await admin.from("companies").select("id");
      companyIds = (cos || []).map((c: any) => c.id);
    } else {
      const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: userRes } = await admin.auth.getUser(jwt);
      const uid = userRes?.user?.id;
      if (!uid) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: prof } = await admin.from("profiles").select("company_id").eq("user_id", uid).maybeSingle();
      if (!(prof as any)?.company_id) return new Response(JSON.stringify({ error: "no company" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      companyIds = [(prof as any).company_id];
    }

    const results: any[] = [];
    for (const cid of companyIds) {
      try { results.push({ companyId: cid, ...(await recomputeForCompany(admin, cid)) }); }
      catch (e: any) { results.push({ companyId: cid, error: e.message }); }
    }
    return new Response(JSON.stringify({ ok: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("recompute-baselines error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
