// check-event-reminders: daily cron. For each APPROVED/REGISTERED event
// at +7 days or +1 day from today, write notifications for proposer + attendees,
// deduplicated via notifications(event_id, user_id, type).
// Auth: x-cron-secret header. Schedule: 0 10 * * * (10 AM UTC daily).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const caller = req.headers.get("x-cron-secret") || "";
  let expected = "";
  try {
    const { data } = await admin.rpc("internal_get_cron_secret");
    expected = (data as string) || "";
  } catch (e) {
    console.error("get cron secret failed:", (e as Error).message);
  }
  if (!expected || caller !== expected) return json({ error: "Unauthorized" }, 401);

  const today = new Date();
  const d7 = addDays(today, 7);
  const d1 = addDays(today, 1);

  const { data: events, error } = await admin
    .from("bd_events")
    .select("id, name, start_date, status, company_id, proposed_by, location")
    .in("status", ["APPROVED", "REGISTERED"])
    .in("start_date", [d7, d1]);
  if (error) return json({ error: error.message }, 500);

  let remindersSent = 0;
  const eventsChecked = (events || []).length;

  for (const ev of events || []) {
    const window = ev.start_date === d7 ? "7d" : "1d";
    const type = `event_reminder_${window}`;
    const title =
      window === "7d"
        ? `${ev.name} is in 7 days`
        : `${ev.name} is tomorrow`;
    const body =
      `Status: ${ev.status}. ` +
      (ev.status === "APPROVED"
        ? "Register if you haven't yet."
        : "You're registered — confirm logistics.");

    // attendees
    const { data: atts } = await admin
      .from("bd_event_attendees")
      .select("user_id")
      .eq("event_id", ev.id);

    const recipients = new Set<string>();
    if (ev.proposed_by) recipients.add(ev.proposed_by);
    (atts || []).forEach((a: any) => a.user_id && recipients.add(a.user_id));

    for (const userId of recipients) {
      const { data: existing } = await admin
        .from("notifications")
        .select("id")
        .eq("event_id", ev.id)
        .eq("user_id", userId)
        .eq("type", type)
        .maybeSingle();
      if (existing) continue;

      const { error: insErr } = await admin.from("notifications").insert({
        company_id: ev.company_id,
        user_id: userId,
        type,
        title,
        body,
        link: `/bd/events/${ev.id}`,
        event_id: ev.id,
      });
      if (insErr) {
        console.error("insert reminder failed:", insErr.message);
        continue;
      }
      remindersSent++;
    }
  }

  return json({ events_checked: eventsChecked, reminders_sent: remindersSent });
});
