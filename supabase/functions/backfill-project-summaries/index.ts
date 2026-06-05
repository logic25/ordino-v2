// backfill-project-summaries: one-shot admin endpoint to generate AI notes
// for every open project in the caller's company. Auth = user JWT (admin only).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders, status: 200 });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prof } = await admin
      .from("profiles").select("id, company_id, role").eq("user_id", user.id).maybeSingle();
    if (!prof?.company_id) {
      return new Response(JSON.stringify({ error: "No company" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const force: boolean = !!body?.force;

    const { data: projects, error: projErr } = await admin
      .from("projects")
      .select("id, assigned_pm_id, name, project_number")
      .eq("company_id", prof.company_id)
      .in("status", ["open"]);
    if (projErr) throw projErr;

    const results: any[] = [];
    let ok = 0, skipped = 0, failed = 0;

    for (const p of projects || []) {
      // Skip if a fresh AI note already exists, unless force=true
      if (!force) {
        const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
        const { data: recent } = await admin
          .from("project_notes")
          .select("id")
          .eq("project_id", p.id)
          .in("source", ["ai_on_demand", "ai_weekly", "ai_auto"])
          .gte("created_at", since)
          .limit(1);
        if (recent && recent.length > 0) {
          skipped++;
          results.push({ project_id: p.id, name: p.name, status: "skipped" });
          continue;
        }
      }

      let actorUserId: string | undefined;
      if (p.assigned_pm_id) {
        const { data: pm } = await admin
          .from("profiles").select("user_id").eq("id", p.assigned_pm_id).maybeSingle();
        actorUserId = pm?.user_id || user.id;
      } else {
        actorUserId = user.id;
      }

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/summarize-project`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
          },
          body: JSON.stringify({
            projectId: p.id,
            companyId: prof.company_id,
            actorUserId,
            persist: true,
            source: "ai_on_demand",
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          ok++;
          results.push({ project_id: p.id, name: p.name, status: "ok" });
        } else {
          failed++;
          results.push({ project_id: p.id, name: p.name, status: "failed", error: json?.error || res.status });
        }
      } catch (e: any) {
        failed++;
        results.push({ project_id: p.id, name: p.name, status: "failed", error: e?.message });
      }

      // Small delay to ease rate limits
      await new Promise((r) => setTimeout(r, 250));
    }

    return new Response(
      JSON.stringify({ total: (projects || []).length, ok, skipped, failed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("backfill-project-summaries error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
