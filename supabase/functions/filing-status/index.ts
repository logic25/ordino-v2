import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-agent-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate: service role key in Authorization header or shared agent secret
    const authHeader = req.headers.get("authorization") ?? "";
    const agentSecret = req.headers.get("x-agent-secret") ?? "";
    const expectedAgentSecret =
      Deno.env.get("DOB_AGENT_SECRET") ??
      Deno.env.get("FILING_AGENT_SECRET") ??
      "";

    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    const isAgentAuth = expectedAgentSecret && agentSecret === expectedAgentSecret;

    if (!isServiceRole && !isAgentAuth) {
      // Also allow JWT auth for browser-side status checks
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Use service role to write updates
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const queryRunId = url.searchParams.get("run_id");
    const {
      filing_run_id,
      status,
      step,
      error_message,
      agent_session_id,
      job_id,
      live_url,
      session_url,
      recording_url,
      screenshots: incomingScreenshots,
    } = body;
    const effectiveRunId = filing_run_id ?? queryRunId;

    if (!effectiveRunId) {
      return new Response(JSON.stringify({ error: "filing_run_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current run
    const { data: run, error: fetchError } = await supabase
      .from("filing_runs")
      .select("id, progress_log, status")
      .eq("id", effectiveRunId)
      .maybeSingle();

    if (fetchError || !run) {
      return new Response(JSON.stringify({ error: "Filing run not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build update
    const progressLog = Array.isArray(run.progress_log) ? [...run.progress_log] : [];
    if (step) {
      progressLog.push({
        step,
        status: status || "running",
        timestamp: new Date().toISOString(),
      });
    }

    const update: Record<string, any> = {
      progress_log: progressLog,
    };

    if (status) update.status = status;
    if (agent_session_id || job_id) update.agent_session_id = agent_session_id || job_id;
    if (error_message) update.error_message = error_message;
    if (live_url) update.live_url = live_url;
    if (session_url) update.session_url = session_url;
    if (recording_url) update.recording_url = recording_url;
    if (Array.isArray(incomingScreenshots) && incomingScreenshots.length > 0) {
      update.screenshots = incomingScreenshots;
    }

    if (status === "running" && !run.status?.includes("running")) {
      update.started_at = new Date().toISOString();
    }
    if (["completed", "failed", "review_needed"].includes(status)) {
      update.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("filing_runs")
      .update(update)
      .eq("id", effectiveRunId);

    if (updateError) {
      console.error("Failed to update filing_runs:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("filing-status error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
