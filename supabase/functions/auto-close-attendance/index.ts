// Nightly cron: closes any attendance_logs rows left open past their log_date.
// Caps total_minutes at 600 (10 hrs) so forgotten sessions don't pollute hours reports.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const MAX_MINUTES = 600; // 10 hours cap for auto-closed sessions

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  // Auth: accept either the cron secret header or service-role bearer
  const cronSecret = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  const isCron = expected && cronSecret === expected;
  const isService = authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;

  if (!isCron && !isService) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Find every open session whose log_date is before today (UTC)
  const today = new Date().toISOString().slice(0, 10);
  const { data: openLogs, error: fetchErr } = await supabase
    .from("attendance_logs")
    .select("id, user_id, company_id, log_date, clock_in")
    .is("clock_out", null)
    .lt("log_date", today);

  if (fetchErr) {
    console.error("[auto-close-attendance] fetch failed", fetchErr);
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = openLogs ?? [];
  let closed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    // End of log_date at 23:59:59 UTC. Good enough for analytics; UI shows "Auto-closed".
    const endOfDay = new Date(`${row.log_date}T23:59:59Z`).toISOString();
    const clockInMs = new Date(row.clock_in).getTime();
    const endMs = new Date(endOfDay).getTime();
    let totalMinutes = Math.max(0, Math.round((endMs - clockInMs) / 60000));
    if (totalMinutes > MAX_MINUTES) totalMinutes = MAX_MINUTES;

    const { error: updErr } = await supabase
      .from("attendance_logs")
      .update({
        clock_out: endOfDay,
        total_minutes: totalMinutes,
        auto_closed: true,
        notes: "Auto-closed by system — original clock-out missing",
      })
      .eq("id", row.id);

    if (updErr) {
      errors.push(`${row.id}: ${updErr.message}`);
    } else {
      closed += 1;
    }
  }

  // Best-effort log to automation_logs
  try {
    await supabase.from("automation_logs").insert({
      action_taken: "attendance_auto_close",
      result: errors.length ? "partial" : "success",
      metadata: {
        scanned: rows.length,
        closed,
        errors: errors.slice(0, 20),
      },
    });
  } catch (_) {
    // non-critical
  }

  return new Response(
    JSON.stringify({ scanned: rows.length, closed, errors }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
