import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all pending reminders that are due
    const now = new Date().toISOString();
    const { data: dueReminders, error: fetchError } = await supabaseAdmin
      .from("email_reminders")
      .select(`
        *,
        emails (id, thread_id, subject, from_email, from_name, replied_at)
      `)
      .eq("status", "pending")
      .lte("remind_at", now);

    if (fetchError) throw fetchError;

    if (!dueReminders || dueReminders.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No due reminders" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let autoCancelled = 0;

    for (const reminder of dueReminders) {
      const email = (reminder as any).emails;
      if (!email) continue;

      // For "no_reply" condition, check if thread has been replied to
      if (reminder.condition === "no_reply" && email.replied_at) {
        // Auto-cancel if already replied
        await supabaseAdmin
          .from("email_reminders")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
          })
          .eq("id", reminder.id);
        autoCancelled++;
        continue;
      }

      // For "no_reply", also check thread for any newer messages from the user
      if (reminder.condition === "no_reply" && email.thread_id) {
        const { data: threadReplies } = await supabaseAdmin
          .from("emails")
          .select("id, date")
          .eq("thread_id", email.thread_id)
          .eq("company_id", reminder.company_id)
          .gt("date", email.date || reminder.created_at)
          .limit(1);

        if (threadReplies && threadReplies.length > 0) {
          // Thread has activity, auto-cancel
          await supabaseAdmin
            .from("email_reminders")
            .update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
            })
            .eq("id", reminder.id);
          autoCancelled++;
          continue;
        }
      }

      // Mark as reminded
      await supabaseAdmin
        .from("email_reminders")
        .update({
          status: "reminded",
          reminded_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);

      processed++;
    }

    return new Response(
      JSON.stringify({
        processed,
        autoCancelled,
        total: dueReminders.length,
        message: `Processed ${processed} reminders, auto-cancelled ${autoCancelled}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
