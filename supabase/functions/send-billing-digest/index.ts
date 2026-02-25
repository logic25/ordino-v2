import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all users with pending digest notifications
    const { data: prefs, error: prefsError } = await supabase
      .from("billing_notification_preferences")
      .select("*, profile:profiles!billing_notification_preferences_user_id_fkey (id, first_name, last_name, display_name, email:user_id)")
      .eq("is_enabled", true)
      .in("frequency", ["daily", "weekly"]);

    if (prefsError) throw prefsError;

    const now = new Date();
    const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][now.getDay()];

    const processed: string[] = [];

    for (const pref of prefs || []) {
      // Check if it's the right time for this user
      if (pref.frequency === "weekly" && pref.digest_day !== dayName) continue;

      // Get unprocessed queue entries for this user's company
      const { data: queueItems, error: qErr } = await supabase
        .from("billing_notification_queue")
        .select("*, billing_request:billing_requests(*, projects(id, name, project_number))")
        .eq("company_id", pref.company_id)
        .eq("processed", false);

      if (qErr || !queueItems || queueItems.length === 0) continue;

      // Build digest email
      const totalAmount = queueItems.reduce((sum: number, q: any) => {
        return sum + (q.billing_request?.total_amount || 0);
      }, 0);

      const dateRange = pref.frequency === "weekly"
        ? `${new Date(now.getTime() - 7 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : now.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const recipientName = pref.profile?.display_name || pref.profile?.first_name || "there";

      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(pref.profile?.email || pref.user_id);
      const recipientEmail = userData?.user?.email;
      if (!recipientEmail) continue;

      const projectGroups: Record<string, any[]> = {};
      for (const q of queueItems) {
        const br = q.billing_request;
        const key = br?.projects?.project_number || "Unknown";
        if (!projectGroups[key]) projectGroups[key] = [];
        projectGroups[key].push(br);
      }

      let detailsHtml = "";
      for (const [projNum, requests] of Object.entries(projectGroups)) {
        const projName = requests[0]?.projects?.name || "";
        detailsHtml += `<p style="font-weight:bold; margin-top:12px;">${projNum} – ${projName}</p>`;
        for (const br of requests) {
          const services = (br.services as any[]) || [];
          for (const svc of services) {
            detailsHtml += `<p style="margin-left:16px;">${svc.name} — $${Number(svc.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} — ${new Date(br.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>`;
          }
        }
      }

      const subject = `${pref.frequency === "weekly" ? "Weekly" : "Daily"} Billing Summary (${dateRange})`;
      const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 640px; margin: 0 auto; padding: 20px;">
  <p>Hello ${recipientName},</p>
  <p>Here's your ${pref.frequency} billing summary (${dateRange}):</p>
  <p><strong>Total billed: $${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} across ${queueItems.length} billing requests</strong></p>
  <div style="margin: 16px 0;">${detailsHtml}</div>
  <p>Thanks,<br/>Green Light Expediting</p>
</body>
</html>`.trim();

      // Send
      await supabase.functions.invoke("gmail-send", {
        body: { to: recipientEmail, subject, html_body: htmlBody },
      });

      // Mark as processed
      const queueIds = queueItems.map((q: any) => q.id);
      await supabase
        .from("billing_notification_queue")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .in("id", queueIds);

      processed.push(pref.user_id);
    }

    return new Response(JSON.stringify({ success: true, processed_users: processed.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
