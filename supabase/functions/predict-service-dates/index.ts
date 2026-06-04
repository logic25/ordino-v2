// predict-service-dates: Server-side AI-learned bill date predictor.
// Mirrors src/hooks/useBillDatePrediction.ts. Returns predicted bill dates for
// active services on a project (or, when invoked with `companyId` + no project,
// for all open services across the company — used by the Monday Report).
//
// Body shapes:
//   { projectId: string }                         → predictions for that project
//   { companyId: string, allOpen: true }          → all in-flight services
//   { companyId: string, windowDays?: number }    → services predicted to bill within window (default 7)
//
// Auth: user JWT OR x-cron-secret + companyId.

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

function normalizeServiceName(name: string): string {
  let n = name
    .replace(/^CO#?\d+\s*[-–—]\s*/i, "")
    .replace(/\s*[-–—]\s*(GC|PL|SP|MECH|ELEC|STR|FA|FS|ELEV|BLR|STP)$/i, "")
    .trim()
    .toLowerCase();
  const patterns: [RegExp, string][] = [
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

function addDaysISO(start: Date, days: number) {
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 200 });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const body = (await req.json()) as BodyShape;
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

    // Pull target services
    let svcQuery = admin
      .from("services")
      .select("id, name, status, estimated_bill_date, created_at, project_id, projects:project_id(id, project_number, name, assigned_pm_id, created_at, properties:property_id(address))")
      .eq("company_id", companyId)
      .not("status", "in", "(billed,paid,dropped)");
    if (body.projectId) svcQuery = svcQuery.eq("project_id", body.projectId);
    const { data: services, error: svcErr } = await svcQuery.limit(5000);
    if (svcErr) throw svcErr;

    // Historical data
    const { data: historicals } = await admin
      .from("services")
      .select("name, created_at, billed_at")
      .eq("company_id", companyId)
      .in("status", ["billed", "paid"])
      .not("billed_at", "is", null)
      .limit(1000);

    const daysMap = new Map<string, number[]>();
    for (const hs of (historicals || []) as any[]) {
      if (!hs.billed_at || !hs.created_at) continue;
      const days = Math.round((new Date(hs.billed_at).getTime() - new Date(hs.created_at).getTime()) / 86400000);
      if (days < 0 || days > 730) continue;
      const key = normalizeServiceName(hs.name);
      const arr = daysMap.get(key) || [];
      arr.push(days);
      daysMap.set(key, arr);
    }
    const allDays = Array.from(daysMap.values()).flat();
    const globalAvg = allDays.length ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length) : 90;

    // For each service: compute prediction; manual estimate wins
    const predictions = [] as any[];
    const windowDays = body.windowDays ?? 7;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    for (const svc of (services || []) as any[]) {
      const proj = svc.projects;
      const projectStart = proj?.created_at ? new Date(proj.created_at) : new Date(svc.created_at);

      let predictedDate: string;
      let samples = 0;
      let confidenceDays = 45;
      let source: "manual" | "ai" = "ai";

      if (svc.estimated_bill_date) {
        predictedDate = svc.estimated_bill_date;
        source = "manual";
      } else {
        const key = normalizeServiceName(svc.name);
        const matched = daysMap.get(key) || [];
        let avgDays: number;
        if (matched.length >= 3) {
          avgDays = Math.round(matched.reduce((a, b) => a + b, 0) / matched.length);
          samples = matched.length;
          const std = Math.sqrt(matched.reduce((s, d) => s + (d - avgDays) ** 2, 0) / matched.length);
          confidenceDays = Math.round(std);
        } else if (matched.length > 0) {
          avgDays = Math.round(matched.reduce((a, b) => a + b, 0) / matched.length);
          samples = matched.length;
          confidenceDays = 30;
        } else {
          avgDays = globalAvg;
        }
        let pd = new Date(projectStart);
        pd.setDate(pd.getDate() + avgDays);
        if (pd < today) pd = new Date(today.getTime() + 14 * 86400000);
        predictedDate = pd.toISOString().slice(0, 10);
      }

      const daysOut = Math.round((new Date(predictedDate).getTime() - today.getTime()) / 86400000);
      if (body.allOpen || body.projectId || daysOut <= windowDays) {
        predictions.push({
          serviceId: svc.id,
          serviceName: svc.name,
          projectId: svc.project_id,
          projectNumber: proj?.project_number,
          projectName: proj?.name,
          address: proj?.properties?.address,
          assignedPmId: proj?.assigned_pm_id,
          predictedDate,
          confidenceDays,
          basedOnSamples: samples,
          daysOut,
          source,
        });
      }
    }

    return new Response(JSON.stringify({ predictions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("predict-service-dates error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
