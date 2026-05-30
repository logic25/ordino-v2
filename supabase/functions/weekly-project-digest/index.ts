// weekly-project-digest: runs weekly via pg_cron. For every open project in every
// company, calls summarize-project (persist=true, source='ai_weekly') so each project
// gets a fresh AI status note attached. Authenticates via x-cron-secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 200 });

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const callerSecret = req.headers.get("x-cron-secret");
    if (!cronSecret || callerSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Pull all open projects across companies (skip mock/test if status taxonomy filters needed later)
    const { data: projects, error } = await admin
      .from("projects")
      .select("id, company_id, assigned_pm_id, senior_pm_id, name, project_number")
      .eq("status", "open");

    if (error) throw error;

    const results: Array<{ projectId: string; ok: boolean; error?: string }> = [];
    const projectSummaries = new Map<string, { name: string; number: string | null; summary: string }>();

    // Process sequentially to respect AI gateway rate limits
    for (const p of projects || []) {
      try {
        // Pick an actor: assigned PM > senior PM > null. We need a user_id, so resolve from profile.
        let actorUserId: string | null = null;
        const pmProfileId = (p.assigned_pm_id || p.senior_pm_id) as string | null;
        if (pmProfileId) {
          const { data: prof } = await admin.from("profiles").select("user_id").eq("id", pmProfileId).maybeSingle();
          actorUserId = prof?.user_id ?? null;
        }

        const res = await fetch(`${supabaseUrl}/functions/v1/summarize-project`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": cronSecret,
          },
          body: JSON.stringify({
            projectId: p.id,
            persist: true,
            source: "ai_weekly",
            companyId: p.company_id,
            actorUserId,
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);

        projectSummaries.set(p.id, {
          name: p.name || "Untitled",
          number: p.project_number,
          summary: j.summary || "",
        });
        results.push({ projectId: p.id, ok: true });

        // Light pacing
        await new Promise((r) => setTimeout(r, 250));
      } catch (err: any) {
        console.error("weekly-project-digest project failed", p.id, err);
        results.push({ projectId: p.id, ok: false, error: err.message || String(err) });
      }
    }

    // Per-PM digest notification (one row per assigned PM with their projects)
    const byPm = new Map<string, { companyId: string; items: Array<{ name: string; number: string | null; summary: string }> }>();
    for (const p of projects || []) {
      const pmProfileId = (p.assigned_pm_id || p.senior_pm_id) as string | null;
      if (!pmProfileId) continue;
      const summary = projectSummaries.get(p.id);
      if (!summary) continue;
      const key = `${pmProfileId}:${p.company_id}`;
      if (!byPm.has(key)) byPm.set(key, { companyId: p.company_id, items: [] });
      byPm.get(key)!.items.push(summary);
    }

    for (const [key, { companyId, items }] of byPm.entries()) {
      const pmProfileId = key.split(":")[0];
      const { data: prof } = await admin.from("profiles").select("user_id").eq("id", pmProfileId).maybeSingle();
      if (!prof?.user_id) continue;

      const bodyLines = [
        `Weekly status for your ${items.length} open project${items.length === 1 ? "" : "s"}:`,
        "",
        ...items.slice(0, 25).flatMap((it) => [
          `▸ ${it.name}${it.number ? ` (#${it.number})` : ""}`,
          it.summary,
          "",
        ]),
      ];

      await admin.from("notifications").insert({
        company_id: companyId,
        user_id: prof.user_id,
        type: "weekly_project_digest",
        title: `Weekly digest — ${items.length} open project${items.length === 1 ? "" : "s"}`,
        body: bodyLines.join("\n").trim(),
        link: "/projects",
      });
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      failed: results.filter((r) => !r.ok).length,
      digestsSent: byPm.size,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("weekly-project-digest error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
