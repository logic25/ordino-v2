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

    // ── RESOLVED notification: email the reporter + all admins/managers ──
    if (action === "resolved") {
      const { reporter_user_id, admin_notes } = body;

      // Collect all recipients: reporter + admins/managers
      const recipients: string[] = [];

      // Helper to get email from auth via profile's user_id
      const getEmailByProfileId = async (profileId: string): Promise<string | null> => {
        const { data: prof } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", profileId)
          .single();
        if (!prof?.user_id) return null;
        const { data: { user } } = await supabase.auth.admin.getUserById(prof.user_id);
        return user?.email || null;
      };

      if (reporter_user_id) {
        const email = await getEmailByProfileId(reporter_user_id);
        if (email) recipients.push(email);
      }

      // Always include admins/managers
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, user_id")
        .eq("company_id", company_id)
        .eq("is_active", true)
        .in("role", ["admin", "manager"]);

      for (const p of adminProfiles || []) {
        const { data: { user } } = await supabase.auth.admin.getUserById(p.user_id);
        const email = user?.email;
        if (email && !recipients.includes(email)) {
          recipients.push(email);
        }
      }

      if (recipients.length === 0) {
        return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_recipients" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resolvedHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: #16a34a; padding: 24px 32px;">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px;">✅ Bug Resolved</h2>
          </div>
          <div style="padding: 24px 32px;">
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">The following bug has been resolved:</p>
            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px 18px; margin: 16px 0; border-radius: 4px;">
              <strong style="color: #15803d; font-size: 15px;">${bug_title}</strong>
              ${bug_description ? `<p style="color: #4b5563; font-size: 13px; margin: 8px 0 0 0;">${bug_description.substring(0, 200)}</p>` : ""}
            </div>
            ${admin_notes ? `
              <div style="margin: 20px 0;">
                <strong style="color: #374151; font-size: 14px;">Resolution Notes</strong>
                <div style="background: #f9fafb; padding: 14px; border-radius: 6px; margin-top: 6px; white-space: pre-line; color: #4b5563; font-size: 14px; line-height: 1.5; border: 1px solid #e5e7eb;">${admin_notes}</div>
              </div>
            ` : ""}
            <div style="margin-top: 24px; text-align: center;">
              <a href="https://ordinov3.lovable.app/help" style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">View in Help Center</a>
            </div>
          </div>
          <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">Ordino • Bug Tracker Notification</p>
          </div>
        </div>
      `;

      let sentCount = 0;
      for (const email of recipients) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              user_id: sender.user_id,
              to: email,
              subject: `✅ Bug Resolved: ${bug_title}`,
              html_body: resolvedHtml,
            }),
          });
          if (res.ok) sentCount++;
        } catch (e) {
          console.error(`Failed to send resolved email to ${email}:`, e);
        }
      }

      return new Response(JSON.stringify({ ok: true, sent: sentCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── NEW BUG notification: email admins/managers ──
    const { data: newBugAdminProfiles } = await supabase
      .from("profiles")
      .select("id, user_id")
      .eq("company_id", company_id)
      .eq("is_active", true)
      .in("role", ["admin", "manager"]);

    const adminEmails: string[] = [];
    for (const p of newBugAdminProfiles || []) {
      const { data: { user } } = await supabase.auth.admin.getUserById(p.user_id);
      if (user?.email) adminEmails.push(user.email);
    }

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
