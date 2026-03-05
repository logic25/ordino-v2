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

    const { bug_title, bug_description, bug_priority, company_id, reporter_name } = await req.json();

    if (!company_id || !bug_title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all gmail connections for this company's active profiles
    const { data: connections } = await supabase
      .from("gmail_connections")
      .select("user_id, email_address, access_token, refresh_token, token_expires_at")
      .eq("company_id", company_id);

    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_gmail_connections" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin profiles to know who to email
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .eq("company_id", company_id)
      .eq("is_active", true)
      .in("role", ["admin", "manager"]);

    const adminEmails = (adminProfiles || [])
      .filter((p: any) => p.email)
      .map((p: any) => p.email);

    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_admin_emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the first available gmail connection to send
    const sender = connections[0];
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
          View and manage this bug in <a href="${supabaseUrl.replace('.supabase.co', '')}/help">Ordino Help Center</a>.
        </p>
      </div>
    `;

    // Call gmail-send for each admin email
    let sentCount = 0;
    for (const email of adminEmails) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
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
