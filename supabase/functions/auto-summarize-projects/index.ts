// auto-summarize-projects: hybrid summarizer.
//   - Cron mode (no body or {mode:"cron"}): iterates active projects per company and generates an AI summary for each.
//   - Event mode ({projectId, companyId}): debounced regen for a single project after high-signal events.
// Auth: x-cron-secret header. Invoked by pg_cron (nightly) and by DB triggers via pg_net.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Skip event-driven regen if last AI summary was created within this many minutes
const DEBOUNCE_MINUTES = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 200 });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve cron secret (env or vault fallback)
    let resolvedCronSecret = cronSecret;
    if (!resolvedCronSecret) {
      const { data: vaultRow } = await admin
        .schema("vault" as any)
        .from("decrypted_secrets")
        .select("decrypted_secret")
        .eq("name", "cron_secret")
        .maybeSingle();
      resolvedCronSecret = (vaultRow as any)?.decrypted_secret || "";
    }

    const callerSecret = req.headers.get("x-cron-secret");
    if (!resolvedCronSecret || callerSecret !== resolvedCronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mode: "cron" | "event" = body?.projectId ? "event" : "cron";

    // Helper to call summarize-project for one project
    const summarize = async (projectId: string, companyId: string, actorUserId?: string) => {
      const res = await fetch(`${supabaseUrl}/functions/v1/summarize-project`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": resolvedCronSecret,
        },
        body: JSON.stringify({
          projectId,
          companyId,
          actorUserId,
          persist: true,
          source: mode === "cron" ? "ai_weekly" : "ai_on_demand",
        }),
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, json };
    };

    if (mode === "event") {
      const { projectId, companyId } = body;
      if (!projectId || !companyId) {
        return new Response(JSON.stringify({ error: "projectId and companyId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Debounce: skip if a fresh AI summary exists
      const since = new Date(Date.now() - DEBOUNCE_MINUTES * 60_000).toISOString();
      const { data: recent } = await admin
        .from("project_notes")
        .select("id")
        .eq("project_id", projectId)
        .in("source", ["ai_on_demand", "ai_weekly"])
        .gte("created_at", since)
        .limit(1);
      if (recent && recent.length > 0) {
        return new Response(JSON.stringify({ skipped: true, reason: "debounced" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Pick an actor (project PM or first admin) for audit attribution
      const { data: proj } = await admin
        .from("projects").select("assigned_pm_id").eq("id", projectId).maybeSingle();
      let actorUserId: string | undefined;
      if (proj?.assigned_pm_id) {
        const { data: pm } = await admin
          .from("profiles").select("user_id").eq("id", proj.assigned_pm_id).maybeSingle();
        actorUserId = pm?.user_id || undefined;
      }

      const result = await summarize(projectId, companyId, actorUserId);
      return new Response(JSON.stringify({ mode, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cron mode: weekly digest for ACTIVE projects that are actually moving.
    // The digest is an "ai_weekly" note, so this should run ~weekly per project,
    // not nightly — and only for projects with recent activity. Quiet/dormant
    // projects don't burn tokens (and on-demand summaries cover anyone who needs
    // a fresh one sooner). Deterministic order (most-recently-active first) +
    // a 500 hard cap as a safety net.
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const { data: activeProjects, error } = await admin
      .from("projects")
      .select("id, company_id, assigned_pm_id, updated_at")
      .in("status", ["open", "on_hold"]);
    if (error) throw error;

    // Freshness gate: skip projects already given a weekly digest in the last 7 days.
    const { data: freshNotes } = await admin
      .from("project_notes")
      .select("project_id")
      .eq("source", "ai_weekly")
      .gte("created_at", sevenDaysAgo);
    const summarizedRecently = new Set((freshNotes || []).map((n: any) => n.project_id));

    // Activity gate: only summarize projects with real activity (any non-weekly
    // note) in the window. Combined with updated_at as a fallback signal.
    const { data: activityNotes } = await admin
      .from("project_notes")
      .select("project_id")
      .neq("source", "ai_weekly")
      .gte("created_at", sevenDaysAgo);
    const hadActivity = new Set((activityNotes || []).map((n: any) => n.project_id));

    const projects = (activeProjects || [])
      .filter((p: any) =>
        !summarizedRecently.has(p.id) &&
        (hadActivity.has(p.id) || (p.updated_at && p.updated_at >= sevenDaysAgo)))
      .sort((a: any, b: any) => (b.updated_at || "").localeCompare(a.updated_at || ""))
      .slice(0, 500);

    const totalActive = (activeProjects || []).length;
    console.log(`auto-summarize cron: ${totalActive} active, summarizing ${projects.length} due+active (skipped ${totalActive - projects.length})`);

    const results: any[] = [];
    for (const p of projects || []) {
      let actorUserId: string | undefined;
      if (p.assigned_pm_id) {
        const { data: pm } = await admin
          .from("profiles").select("user_id").eq("id", p.assigned_pm_id).maybeSingle();
        actorUserId = pm?.user_id || undefined;
      }
      const r = await summarize(p.id, p.company_id, actorUserId);
      results.push({ project_id: p.id, ok: r.ok });
      // tiny delay to avoid rate limits
      await new Promise((res) => setTimeout(res, 200));
    }

    return new Response(JSON.stringify({ mode, active: totalActive, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("auto-summarize-projects error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
