// predict-service-dates v2 — baseline-driven, stage-aware, Pro-Cert-aware.
//
// For each open service:
//   1. Look up service_duration_baselines with progressive fallback
//      (type+complexity+building+client_tier+pro_cert → ... → type+pro_cert → type → global)
//   2. Anchor by stage: not_started → project start; in_progress/filed → filed_at;
//      objections → objections_received_at + objection-resolution bucket;
//      approved/ready_to_bill → today + 3-5d.
//   3. Clamp to [today+3, today+365].
//   4. Write back to services.estimated_bill_date with reasoning and a
//      prediction_outcomes row for the feedback loop.
//
// Body:
//   { projectId: string }                  → predictions for that project
//   { companyId: string, allOpen: true }   → all open services
//   { companyId: string, windowDays?: n }  → services predicted within window

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface BodyShape {
  projectId?: string;
  companyId?: string;
  allOpen?: boolean;
  windowDays?: number;
}

// ---- Service-type taxonomy ----
function normalizeServiceName(name: string): string {
  let n = (name || "")
    .replace(/^CO#?\d+\s*[-–—]\s*/i, "")
    .replace(/\s*[-–—]\s*(GC|PL|SP|MECH|ELEC|STR|FA|FS|ELEV|BLR|STP)$/i, "")
    .trim()
    .toLowerCase();
  const patterns: [RegExp, string][] = [
    [/pro(?:fessional)?\s*cert/i, "pro_cert"],
    [/paa\b/i, "paa"],
    [/pw\s*1/i, "pw1"],
    [/pw\s*3/i, "pw3"],
    [/tr\s*1/i, "tr1"],
    [/tr\s*8/i, "tr8"],
    [/after.?hours|ahv/i, "ahv"],
    [/place\s*of\s*assembly|poa/i, "poa"],
    [/bsa\b/i, "bsa"],
    [/landmark/i, "landmarks"],
    [/dep\b/i, "dep"],
    [/fdny|fire\s*dept/i, "fdny"],
    [/alt(eration)?\s*(type\s*)?\d/i, "alteration"],
    [/work\s*permit/i, "work_permit"],
    [/letter\s*of\s*completion|loc\b/i, "loc"],
    [/oer\b|environmental/i, "oer"],
    [/temporary\s*cert|tco\b/i, "tco"],
    [/cert\s*of\s*occupancy|c\s*of\s*o/i, "co_cert"],
    [/sign.?off/i, "sign_off"],
    [/violation/i, "violation"],
    [/amendment/i, "amendment"],
    [/approval/i, "approval"],
    [/inspection/i, "inspection"],
  ];
  for (const [p, c] of patterns) if (p.test(n)) return c;
  return n;
}

// Resilient median of an array
function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function addDaysISO(start: Date, days: number) {
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Look up a baseline row with progressive fallback. Returns the best match
// with ≥3 samples plus a label describing which fallback level was used.
async function lookupBaseline(
  admin: any,
  companyId: string,
  key: { type: string; complexity: string | null; building_class: string | null; client_tier: string | null; is_pro_cert: boolean },
): Promise<{ median_days: number; sample_size: number; level: string } | null> {
  const tries: Array<[string, any]> = [
    ["type+complexity+building+client+procert", { complexity: key.complexity, building_class: key.building_class, client_tier: key.client_tier, is_pro_cert: key.is_pro_cert }],
    ["type+complexity+client+procert", { complexity: key.complexity, building_class: null, client_tier: key.client_tier, is_pro_cert: key.is_pro_cert }],
    ["type+complexity+procert", { complexity: key.complexity, building_class: null, client_tier: null, is_pro_cert: key.is_pro_cert }],
    ["type+procert", { complexity: null, building_class: null, client_tier: null, is_pro_cert: key.is_pro_cert }],
    ["type", { complexity: null, building_class: null, client_tier: null, is_pro_cert: false }],
  ];
  for (const [label, filt] of tries) {
    let q = admin
      .from("service_duration_baselines")
      .select("median_active_days, median_total_days, sample_size")
      .eq("company_id", companyId)
      .eq("service_type", key.type)
      .eq("is_pro_cert", filt.is_pro_cert);
    q = filt.complexity === null ? q.is("complexity", null) : q.eq("complexity", filt.complexity);
    q = filt.building_class === null ? q.is("building_class", null) : q.eq("building_class", filt.building_class);
    q = filt.client_tier === null ? q.is("client_tier", null) : q.eq("client_tier", filt.client_tier);
    const { data } = await q.maybeSingle();
    if (data && data.sample_size >= 3) {
      const days = Number(data.median_active_days || data.median_total_days || 0);
      if (days > 0) return { median_days: days, sample_size: data.sample_size, level: label };
    }
  }
  return null;
}

// Hard-coded NYC DOB service-level defaults — the floor when company history is too thin.
const DOB_DEFAULTS: Record<string, { days: number; pro_cert_days: number }> = {
  pro_cert: { days: 5, pro_cert_days: 5 },
  paa: { days: 14, pro_cert_days: 7 },
  pw1: { days: 30, pro_cert_days: 7 },
  pw3: { days: 14, pro_cert_days: 7 },
  tr1: { days: 7, pro_cert_days: 5 },
  tr8: { days: 7, pro_cert_days: 5 },
  ahv: { days: 5, pro_cert_days: 5 },
  poa: { days: 30, pro_cert_days: 14 },
  bsa: { days: 90, pro_cert_days: 90 },
  landmarks: { days: 45, pro_cert_days: 30 },
  dep: { days: 21, pro_cert_days: 14 },
  fdny: { days: 21, pro_cert_days: 14 },
  alteration: { days: 45, pro_cert_days: 14 },
  work_permit: { days: 14, pro_cert_days: 7 },
  loc: { days: 21, pro_cert_days: 14 },
  oer: { days: 30, pro_cert_days: 21 },
  tco: { days: 45, pro_cert_days: 30 },
  co_cert: { days: 60, pro_cert_days: 45 },
  sign_off: { days: 14, pro_cert_days: 7 },
  violation: { days: 30, pro_cert_days: 21 },
  amendment: { days: 14, pro_cert_days: 7 },
  approval: { days: 21, pro_cert_days: 14 },
  inspection: { days: 14, pro_cert_days: 7 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 200 });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const body = (await req.json().catch(() => ({}))) as BodyShape;
    const admin = createClient(url, serviceKey);

    // Auth — cron secret OR user JWT
    const cronHdr = req.headers.get("x-cron-secret");
    const envCron = Deno.env.get("CRON_SECRET");
    let companyId = body.companyId;
    if (!cronHdr || cronHdr !== envCron) {
      const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: userRes } = await admin.auth.getUser(jwt);
      const uid = userRes?.user?.id;
      if (!uid) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: prof } = await admin.from("profiles").select("company_id").eq("user_id", uid).maybeSingle();
      companyId = (prof as any)?.company_id;
    }
    if (!companyId) return new Response(JSON.stringify({ error: "companyId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Pull target services with project + property + client context
    let svcQuery = admin
      .from("services")
      .select(`
        id, name, status, estimated_bill_date, created_at, project_id, is_pro_cert,
        filed_at, objections_received_at,
        projects:project_id(
          id, project_number, name, assigned_pm_id, created_at, project_complexity_tier,
          properties:property_id(address, bis_profile_data),
          clients:client_id(id, client_tier)
        )
      `)
      .eq("company_id", companyId)
      .not("status", "in", "(billed,paid,dropped)");
    if (body.projectId) svcQuery = svcQuery.eq("project_id", body.projectId);
    const { data: services, error: svcErr } = await svcQuery.limit(5000);
    if (svcErr) throw svcErr;

    // PM workload — count open services per PM across the company
    const pmCounts = new Map<string, number>();
    (services || []).forEach((s: any) => {
      const pm = s.projects?.assigned_pm_id;
      if (pm) pmCounts.set(pm, (pmCounts.get(pm) || 0) + 1);
    });
    const counts = Array.from(pmCounts.values()).sort((a, b) => a - b);
    const medianPmLoad = counts.length ? counts[Math.floor(counts.length / 2)] : 0;

    const predictions: any[] = [];
    const outcomesToInsert: any[] = [];
    const updates: any[] = [];
    const windowDays = body.windowDays ?? 7;
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);

    for (const svc of (services || []) as any[]) {
      const proj = svc.projects;
      if (!proj) continue;
      const bldgClassRaw = (proj.properties?.bis_profile_data as any)?.bldgclass || (proj.properties?.bis_profile_data as any)?.building_class || "";
      const propClass = String(bldgClassRaw).slice(0, 1) || null; // class letter only
      const complexity = proj.project_complexity_tier || null;
      const clientTier = proj.clients?.client_tier || null;
      const type = normalizeServiceName(svc.name);
      const isProCert = !!svc.is_pro_cert;

      // Manual estimate wins
      if (svc.estimated_bill_date && (svc as any).bill_date_source === "manual") {
        predictions.push({
          serviceId: svc.id, serviceName: svc.name, projectId: svc.project_id,
          projectNumber: proj.project_number, projectName: proj.name,
          predictedDate: svc.estimated_bill_date, source: "manual",
          reasoning: "Manually set by user",
        });
        continue;
      }

      // 1. Get baseline (company history → DOB default)
      const baseline = await lookupBaseline(admin, companyId, {
        type, complexity, building_class: propClass, client_tier: clientTier, is_pro_cert: isProCert,
      });
      let baseDays: number;
      let baselineLevel: string;
      let sampleSize = 0;
      if (baseline) {
        baseDays = baseline.median_days;
        baselineLevel = baseline.level;
        sampleSize = baseline.sample_size;
      } else {
        const def = DOB_DEFAULTS[type] || { days: 45, pro_cert_days: 21 };
        baseDays = isProCert ? def.pro_cert_days : def.days;
        baselineLevel = "dob_default";
      }

      // 2. Stage anchor
      const status = (svc.status || "").toLowerCase();
      let anchor: Date;
      let stageNote = "";
      let remaining = baseDays;
      if (["approved", "ready_to_bill", "filed_complete"].includes(status)) {
        anchor = today; remaining = 5; stageNote = "ready to bill — short fuse";
      } else if (status === "objections" || status === "objection") {
        anchor = svc.objections_received_at ? new Date(svc.objections_received_at) : (svc.updated_at ? new Date(svc.updated_at) : today);
        remaining = 14; // objection resolution standard
        stageNote = "objections — using 14d resolution baseline";
      } else if (["in_progress", "filed", "in_review", "submitted"].includes(status)) {
        anchor = svc.filed_at ? new Date(svc.filed_at) : new Date(svc.created_at);
        const ageDays = Math.max(0, Math.floor((today.getTime() - anchor.getTime()) / 86400000));
        remaining = Math.max(7, baseDays - ageDays);
        stageNote = `in progress — ${ageDays}d elapsed of ${baseDays}d baseline`;
      } else {
        anchor = proj.created_at ? new Date(proj.created_at) : new Date(svc.created_at);
        remaining = baseDays;
        stageNote = "not started — full baseline";
      }

      // 3. PM workload adjustment (cap +30d)
      let workloadAdj = 0;
      const pmLoad = pmCounts.get(proj.assigned_pm_id) || 0;
      if (medianPmLoad > 0 && pmLoad > medianPmLoad * 1.5) {
        const ratio = pmLoad / medianPmLoad;
        workloadAdj = Math.min(30, Math.ceil((ratio - 1) * baseDays * 0.15));
      }

      // 4. Compute + clamp
      let predicted = new Date(anchor);
      predicted.setUTCDate(predicted.getUTCDate() + remaining + workloadAdj);
      const minDate = new Date(today); minDate.setUTCDate(minDate.getUTCDate() + 3);
      const maxDate = new Date(today); maxDate.setUTCDate(maxDate.getUTCDate() + 365);
      if (predicted < minDate) predicted = minDate;
      if (predicted > maxDate) predicted = maxDate;
      const predictedDate = predicted.toISOString().slice(0, 10);

      const reasoning =
        `Type: ${type}${isProCert ? " (Pro Cert)" : ""}. ` +
        `Baseline: ${baselineLevel === "dob_default" ? `${baseDays}d (DOB default — no company history yet)` : `${baseDays}d median (${baselineLevel}, n=${sampleSize})`}. ` +
        `Stage: ${stageNote}.` +
        (workloadAdj > 0 ? ` PM workload +${workloadAdj}d (PM has ${pmLoad} open vs median ${medianPmLoad}).` : "");

      const daysOut = Math.round((predicted.getTime() - today.getTime()) / 86400000);

      predictions.push({
        serviceId: svc.id, serviceName: svc.name, projectId: svc.project_id,
        projectNumber: proj.project_number, projectName: proj.name,
        address: proj.properties?.address, assignedPmId: proj.assigned_pm_id,
        predictedDate, source: "ai", daysOut,
        baselineLevel, baselineDays: baseDays, sampleSize,
        workloadAdjustmentDays: workloadAdj, stageNote, reasoning,
      });

      // Write back to services + outcomes log (only if AI source)
      updates.push({
        id: svc.id, estimated_bill_date: predictedDate, bill_date_source: "ai",
        bill_date_reasoning: reasoning, estimated_bill_date_computed_at: new Date().toISOString(),
      });
      outcomesToInsert.push({
        company_id: companyId, service_id: svc.id, predicted_date: predictedDate,
        prediction_inputs: { type, isProCert, complexity, building_class: propClass, client_tier: clientTier, baselineLevel, baselineDays: baseDays, sampleSize, stageNote, workloadAdj, pmLoad, medianPmLoad },
        model_version: "v2-baseline",
      });
    }

    // Batch writes (best-effort — don't fail the response if cache writes hit conflicts)
    if (updates.length) {
      for (const u of updates) {
        await admin.from("services").update({
          estimated_bill_date: u.estimated_bill_date,
          bill_date_source: u.bill_date_source,
          bill_date_reasoning: u.bill_date_reasoning,
          estimated_bill_date_computed_at: u.estimated_bill_date_computed_at,
        }).eq("id", u.id);
      }
    }
    // Only log a fresh outcome row when the prediction is materially new — skip duplicates from same day
    if (outcomesToInsert.length) {
      const todayStr = today.toISOString().slice(0, 10);
      const svcIds = outcomesToInsert.map(o => o.service_id);
      const { data: existing } = await admin
        .from("prediction_outcomes")
        .select("service_id, predicted_at")
        .in("service_id", svcIds)
        .gte("predicted_at", todayStr);
      const skip = new Set((existing || []).map((e: any) => e.service_id));
      const fresh = outcomesToInsert.filter(o => !skip.has(o.service_id));
      if (fresh.length) await admin.from("prediction_outcomes").insert(fresh);
    }

    // Filter response by window if requested
    const result = body.allOpen || body.projectId
      ? predictions
      : predictions.filter(p => (p.daysOut ?? 0) <= windowDays);

    return new Response(JSON.stringify({ predictions: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("predict-service-dates error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
