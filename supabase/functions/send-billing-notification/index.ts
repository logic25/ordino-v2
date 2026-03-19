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
    const { billing_request_id, recipient_email, recipient_name, project, services, total_price, billed_by, billed_to_contact } = await req.json();

    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const projectRef = project
      ? `${project.number || "—"} – ${project.name || "—"}`
      : "—";

    const totalFormatted = `$${Number(total_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    const accent = "#16a34a";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    // Build service rows
    let serviceRowsHtml = "";
    for (const s of (services || [])) {
      const price = `$${Number(s.price || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
      serviceRowsHtml += `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;">${s.name || "—"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:right;font-weight:600;">${price}</td>
        </tr>`;
      if (s.description) {
        serviceRowsHtml += `
        <tr>
          <td colspan="2" style="padding:2px 12px 8px;font-size:12px;color:#666;border-bottom:1px solid #f0f0f0;">${s.description}</td>
        </tr>`;
      }
    }

    const subject = `Billing Alert: ${projectRef} — ${totalFormatted}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="padding:20px 24px;border-bottom:3px solid ${accent};">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:18px;font-weight:700;color:#1a1a1a;">Green Light Expediting</td>
                <td align="right" style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Billing Alert</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 16px;font-size:15px;color:#1a1a1a;">Hello ${recipient_name},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#1a1a1a;">New services have been sent to billing:</p>

            <!-- Meta info card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;margin-bottom:20px;">
              <tr>
                <td style="padding:14px 16px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:4px;">Project</td>
                      <td style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:4px;">Billed By</td>
                      ${billed_to_contact ? `<td style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:4px;">Billed To</td>` : ""}
                      <td align="right" style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:4px;">Date</td>
                    </tr>
                    <tr>
                      <td style="font-size:14px;font-weight:600;color:#1a1a1a;">${projectRef}</td>
                      <td style="font-size:14px;font-weight:600;color:#1a1a1a;">${billed_by || "—"}</td>
                      ${billed_to_contact ? `<td style="font-size:14px;font-weight:600;color:#1a1a1a;">${billed_to_contact}</td>` : ""}
                      <td align="right" style="font-size:14px;color:#666;">${dateStr} ${timeStr}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Services table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
              <tr style="background:#f9fafb;">
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Service</th>
                <th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Amount</th>
              </tr>
              ${serviceRowsHtml}
              <tr style="background:#f9fafb;">
                <td style="padding:12px;font-size:15px;font-weight:700;color:#1a1a1a;">Total</td>
                <td style="padding:12px;text-align:right;font-size:15px;font-weight:700;color:${accent};">${totalFormatted}</td>
              </tr>
            </table>

            ${project?.id ? `
            <div style="margin-top:24px;text-align:center;">
              <a href="https://ordinov3.lovable.app/projects/${project.id}" style="display:inline-block;padding:12px 28px;background:${accent};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View Project</a>
            </div>` : ""}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:#999;text-align:center;">
            Green Light Expediting · Billing Notifications
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

    const { error } = await supabase.functions.invoke("gmail-send", {
      body: { to: recipient_email, subject, html_body: htmlBody },
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
