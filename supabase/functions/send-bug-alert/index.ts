import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action, bug_title, bug_description, bug_priority, company_id, reporter_name } = body;

    if (!company_id || !bug_title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get first available gmail connection for sending
    const { data: connections } = await supabase
      .from("gmail_connections")
      .select("user_id, email_address, access_token, refresh_token, token_expires_at")
      .eq("company_id", company_id);

    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_gmail_connections" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sender = connections[0];

    // ── RESOLVED notification: email the reporter ──
    if (action === "resolved") {
      const { reporter_user_id, admin_notes } = body;
      if (!reporter_user_id) {
        return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_reporter_id" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: reporter } = await supabase
        .from("profiles")
        .select("email, display_name")
        .eq("id", reporter_user_id)
        .single();

      if (!reporter?.email) {
        return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_reporter_email" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resolvedHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #16a34a;">✅ Bug Resolved</h2>
          <p>Hi ${reporter.display_name || "there"},</p>
          <p>The bug you reported has been resolved:</p>
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
            <strong>${bug_title}</strong>
          </div>
          ${admin_notes ? `<div style="margin: 16px 0;"><strong>Resolution notes:</strong><div style="background: #f9f9f9; padding: 12px; border-radius: 6px; margin-top: 4px; white-space: pre-line;">${admin_notes}</div></div>` : ""}
          <p style="color: #888; font-size: 12px; margin-top: 16px;">
            View details in the <a href="https://ordinov3.lovable.app/help">Ordino Help Center</a>.
          </p>
        </div>
      `;

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({
            user_id: sender.user_id,
            to: reporter.email,
            subject: `✅ Bug Resolved: ${bug_title}`,
            html_body: resolvedHtml,
          }),
        });
        return new Response(JSON.stringify({ ok: true, sent: res.ok ? 1 : 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Failed to send resolved email:", e);
        return new Response(JSON.stringify({ ok: true, sent: 0, reason: "send_failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── NEW BUG notification: email admins/managers ──
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .eq("company_id", company_id)
      .eq("is_active", true)
      .in("role", ["admin", "manager"]);

    const adminEmails = (adminProfiles || []).filter((p: any) => p.email).map((p: any) => p.email);

    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_admin_emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priorityColor = bug_priority === "critical" ? "#dc2626" : bug_priority === "high" ? "#ea580c" : "#6b7280";

    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">🐛 New Bug Report</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #555;">Title</td>
            <td style="padding: 8px;">${bug_title}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #555;">Priority</td>
            <td style="padding: 8px;">
              <span style="background: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                ${bug_priority?.toUpperCase() || "MEDIUM"}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #555;">Reporter</td>
            <td style="padding: 8px;">${reporter_name || "Unknown"}</td>
          </tr>
        </table>
        <div style="background: #f9f9f9; padding: 12px; border-radius: 6px; margin-top: 8px; white-space: pre-line;">
          ${bug_description || "No description provided."}
        </div>
        <p style="color: #888; font-size: 12px; margin-top: 16px;">
          View and manage this bug in <a href="https://ordinov3.lovable.app/help">Ordino Help Center</a>.
        </p>
      </div>
    `;

    let sentCount = 0;
    for (const email of adminEmails) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({
            user_id: sender.user_id,
            to: email,
            subject: `🐛 Bug Report: ${bug_title}`,
            html_body: htmlBody,
          }),
        });
        if (res.ok) sentCount++;
      } catch (e) {
        console.error(`Failed to send bug alert to ${email}:`, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-bug-alert error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
