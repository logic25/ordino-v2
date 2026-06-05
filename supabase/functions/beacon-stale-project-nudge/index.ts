// Daily cron: notify PMs of projects that have gone stale.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 200 });

  // Auth — accept env CRON_SECRET or vault `cron_secret` (covers both managed-env and pg_net callers)
  const provided = req.headers.get("x-cron-secret") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const acceptable = new Set<string>();
  const envSecret = Deno.env.get("CRON_SECRET");
  if (envSecret) acceptable.add(envSecret);
  const { data: vaultRow } = await supabase.schema("vault" as any).from("decrypted_secrets").select("decrypted_secret").eq("name", "cron_secret").maybeSingle();
  const vaultSecret = (vaultRow as any)?.decrypted_secret;
  if (vaultSecret) acceptable.add(vaultSecret);
  if (!provided || !acceptable.has(provided)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, company_id, name, project_number, assigned_pm_id, senior_pm_id, last_activity_at, stale_threshold_days, properties(address)")
    .eq("status", "open")
    .not("last_activity_at", "is", null);

  if (error) {
    console.error("Failed to load projects", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = Date.now();
  const stale = (projects || []).filter((p: any) => {
    const t = p.stale_threshold_days || 14;
    const days = Math.floor((now - new Date(p.last_activity_at).getTime()) / 86400000);
    return days >= t;
  });

  // Group by PM (assigned PM preferred, else senior PM)
  const byPm = new Map<string, { companyId: string; projects: any[] }>();
  for (const p of stale) {
    const pmId = p.assigned_pm_id || p.senior_pm_id;
    if (!pmId) continue;
    if (!byPm.has(pmId)) byPm.set(pmId, { companyId: p.company_id, projects: [] });
    byPm.get(pmId)!.projects.push(p);
  }

  let notified = 0;
  for (const [pmId, payload] of byPm) {
    // Skip if we already nudged today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", pmId)
      .eq("type", "project_stale")
      .gte("created_at", todayStart.toISOString())
      .limit(1);
    if (existing && existing.length > 0) continue;

    const count = payload.projects.length;
    const sample = payload.projects.slice(0, 3).map((p: any) =>
      `${p.project_number || p.name || "Project"} — ${p.properties?.address || ""}`.trim()
    ).join("; ");
    const more = count > 3 ? ` (+${count - 3} more)` : "";

    const { error: insErr } = await supabase.from("notifications").insert({
      company_id: payload.companyId,
      user_id: pmId,
      type: "project_stale",
      title: `${count} stale project${count > 1 ? "s" : ""} need${count > 1 ? "" : "s"} attention`,
      message: `${sample}${more}`,
      link: `/projects?filter=stale`,
      metadata: { project_ids: payload.projects.map((p: any) => p.id) },
    });
    if (insErr) {
      console.error("notification insert failed", insErr);
    } else {
      notified++;
    }
  }

  return new Response(
    JSON.stringify({ stale_projects: stale.length, pms_notified: notified }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
