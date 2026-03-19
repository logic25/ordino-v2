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
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all users with digest preferences
    const { data: prefs, error: prefsError } = await supabase
      .from("billing_notification_preferences")
      .select("*, profile:profiles!billing_notification_preferences_user_id_fkey (id, first_name, last_name, display_name, email:user_id)")
      .eq("is_enabled", true)
      .in("frequency", ["daily", "weekly"]);

    if (prefsError) throw prefsError;

    const now = new Date();
    const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][now.getDay()];
    const accent = "#16a34a";

    const processed: string[] = [];

    for (const pref of prefs || []) {
      if (pref.frequency === "weekly" && pref.digest_day !== dayName) continue;

      // Get unprocessed queue entries
      const { data: queueItems, error: qErr } = await supabase
        .from("billing_notification_queue")
        .select("*, billing_request:billing_requests(*, projects(id, name, project_number), biller:profiles!billing_requests_created_by_fkey(display_name, first_name, last_name), billed_to:client_contacts!billing_requests_billed_to_contact_id_fkey(name))")
        .eq("company_id", pref.company_id)
        .eq("processed", false);

      if (qErr || !queueItems || queueItems.length === 0) continue;

      const totalAmount = queueItems.reduce((sum: number, q: any) => {
        return sum + (q.billing_request?.total_amount || 0);
      }, 0);

      const dateRange = pref.frequency === "weekly"
        ? `${new Date(now.getTime() - 7 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

      const recipientName = pref.profile?.display_name || pref.profile?.first_name || "there";

      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(pref.profile?.email || pref.user_id);
      const recipientEmail = userData?.user?.email;
      if (!recipientEmail) continue;

      // Group by project, track biller
      const projectGroups: Record<string, { projectName: string; items: any[] }> = {};
      for (const q of queueItems) {
        const br = q.billing_request;
        const key = br?.projects?.project_number || "Unknown";
        if (!projectGroups[key]) {
          projectGroups[key] = { projectName: br?.projects?.name || "", items: [] };
        }
        const billerProfile = br?.biller;
        const billerName = billerProfile?.display_name || `${billerProfile?.first_name || ""} ${billerProfile?.last_name || ""}`.trim() || "Unknown";
        const billedToName = br?.billed_to?.name || null;

        const services = (br.services as any[]) || [];
        for (const svc of services) {
          projectGroups[key].items.push({
            serviceName: svc.name,
            amount: svc.amount || svc.billed_amount || 0,
            billerName,
            billedToName,
            date: new Date(br.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
          });
        }
      }

      // Build project detail rows
      let projectRowsHtml = "";
      for (const [projNum, group] of Object.entries(projectGroups)) {
        projectRowsHtml += `
          <tr style="background:#f9fafb;">
            <td colspan="4" style="padding:10px 12px;font-size:13px;font-weight:700;color:#1a1a1a;border-bottom:1px solid #e5e7eb;">
              ${projNum} – ${group.projectName}
            </td>
          </tr>`;
        for (const item of group.items) {
          const amt = `$${Number(item.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
          projectRowsHtml += `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${item.serviceName}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666;">${item.billerName}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;font-weight:600;">${amt}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#888;">${item.date}</td>
          </tr>`;
        }
      }

      const totalFormatted = `$${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
      const periodLabel = pref.frequency === "weekly" ? "Weekly" : "Daily";
      const subject = `${periodLabel} Billing Summary — ${dateRange} — ${totalFormatted}`;

      const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="padding:20px 24px;border-bottom:3px solid ${accent};">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:18px;font-weight:700;color:#1a1a1a;">Green Light Expediting</td>
                <td align="right" style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">${periodLabel} Digest</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 8px;font-size:15px;color:#1a1a1a;">Hello ${recipientName},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#1a1a1a;">Here's your ${pref.frequency} billing summary for <strong>${dateRange}</strong>:</p>

            <!-- Summary card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:20px;">
              <tr>
                <td style="padding:16px;text-align:center;">
                  <div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Total Billed</div>
                  <div style="font-size:28px;font-weight:700;color:${accent};">${totalFormatted}</div>
                  <div style="font-size:13px;color:#666;margin-top:4px;">across ${queueItems.length} billing request${queueItems.length !== 1 ? "s" : ""}</div>
                </td>
              </tr>
            </table>

            <!-- Detail table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
              <tr style="background:#f9fafb;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Service</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Billed By</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Amount</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">When</th>
              </tr>
              ${projectRowsHtml}
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#999;text-align:center;">
            Green Light Expediting · Billing Digest
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
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
