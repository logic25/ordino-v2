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

    const projectList = projects || [];

    // Run the heavy loop in the background so we don't hit the 150s request timeout.
    const work = (async () => {
      let ok = 0, skipped = 0, failed = 0;
      for (const p of projectList) {
        try {
          if (!force) {
            const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
            const { data: recent } = await admin
              .from("project_notes")
              .select("id")
              .eq("project_id", p.id)
              .in("source", ["ai_on_demand", "ai_weekly", "ai_auto"])
              .gte("created_at", since)
              .limit(1);
            if (recent && recent.length > 0) { skipped++; continue; }
          }

          let actorUserId: string | undefined = user.id;
          if (p.assigned_pm_id) {
            const { data: pm } = await admin
              .from("profiles").select("user_id").eq("id", p.assigned_pm_id).maybeSingle();
            actorUserId = pm?.user_id || user.id;
          }

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
          if (res.ok) ok++; else failed++;
        } catch (e) {
          failed++;
          console.error("backfill project failed", p.id, e);
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      console.log(`backfill-project-summaries done: ok=${ok} skipped=${skipped} failed=${failed} total=${projectList.length}`);
    })();

    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work);
    } else {
      work.catch((e) => console.error("backfill background error", e));
    }

    return new Response(
      JSON.stringify({
        queued: true,
        total: projectList.length,
        message: `Backfill started for ${projectList.length} projects. This runs in the background and may take a few minutes.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e: any) {
    console.error("backfill-project-summaries error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
