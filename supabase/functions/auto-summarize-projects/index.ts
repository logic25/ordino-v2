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

    // Cron mode: all active projects across all companies
    const { data: projects, error } = await admin
      .from("projects")
      .select("id, company_id, assigned_pm_id")
      .in("status", ["open", "on_hold"])
      .limit(500);
    if (error) throw error;

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

    return new Response(JSON.stringify({ mode, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("auto-summarize-projects error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
