import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) return null;
  return { access_token: data.access_token, expires_in: data.expires_in };
}

function createMimeMessage({
  to,
  from,
  subject,
  body,
}: {
  to: string;
  from: string;
  subject: string;
  body: string;
}) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `alt_${boundary}`;

  const plainBody = body.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const parts = [
    ...headers,
    "",
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    plainBody,
    `--${altBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    body,
    `--${altBoundary}--`,
    `--${boundary}--`,
  ];

  const message = parts.join("\r\n");
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildWelcomeEmailHtml({
  clientName,
  companyName,
  pmName,
  pmEmail,
  pmPhone,
  projectTitle,
  propertyAddress,
  pisLink,
  companyEmail,
  companyPhone,
}: {
  clientName: string;
  companyName: string;
  pmName: string;
  pmEmail: string;
  pmPhone: string;
  projectTitle: string;
  propertyAddress: string;
  pisLink: string | null;
  companyEmail: string;
  companyPhone: string;
}) {
  const footerParts = [
    companyEmail ? `<a href="mailto:${companyEmail}" style="color:#64748b;">${companyEmail}</a>` : null,
    companyPhone ? `<span style="color:#64748b;">${companyPhone}</span>` : null,
  ].filter(Boolean).join(" &nbsp;|&nbsp; ");

  const pisSection = pisLink
    ? `
      <div style="text-align:center;margin:28px 0;">
        <a href="${pisLink}" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
          Fill Out Project Information Sheet
        </a>
      </div>
      <p style="margin:0 0 24px;font-size:13px;color:#64748b;text-align:center;line-height:1.5;">
        Please fill this out to the best of your abilities so we can begin work on your behalf.
      </p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="background:#1e293b;padding:24px 32px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${companyName}</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Welcome to Your Project</p>
    </div>

    <!-- Body Card -->
    <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px;font-size:15px;color:#1e293b;line-height:1.6;">Hi ${clientName},</p>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
        Thank you for choosing <strong>${companyName}</strong>. We're excited to get started on <strong>${projectTitle}</strong>${propertyAddress ? ` at <strong>${propertyAddress}</strong>` : ""}.
      </p>

      <!-- PM Contact Card -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;font-weight:600;">Your Project Manager</p>
        <p style="margin:0;font-size:16px;font-weight:700;color:#1e293b;">${pmName}</p>
        ${pmEmail ? `<p style="margin:4px 0 0;font-size:14px;color:#334155;"><a href="mailto:${pmEmail}" style="color:#2563eb;text-decoration:none;">${pmEmail}</a></p>` : ""}
        ${pmPhone ? `<p style="margin:4px 0 0;font-size:14px;color:#334155;">${pmPhone}</p>` : ""}
      </div>

      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
        To get started, please fill out the attached Project Information Sheet to the best of your abilities. If you have any questions, don't hesitate to reach out${pmEmail ? ` at <a href="mailto:${pmEmail}" style="color:#2563eb;text-decoration:none;">${pmEmail}</a>` : ""}${pmPhone ? ` or ${pmPhone}` : ""}.
      </p>

      ${pisSection}

      <p style="margin:24px 0 0;font-size:15px;color:#1e293b;">
        Best regards,<br/><strong>${companyName}</strong>
      </p>
    </div>

    <!-- Footer -->
    ${footerParts ? `<div style="text-align:center;padding:16px;font-size:12px;">${footerParts}</div>` : ""}
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gmailClientId = Deno.env.get("GMAIL_CLIENT_ID");
    const gmailClientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");

    if (!gmailClientId || !gmailClientSecret) {
      return new Response(
        JSON.stringify({ error: "Gmail credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { proposal_id } = await req.json();
    if (!proposal_id) {
      return new Response(
        JSON.stringify({ error: "Missing proposal_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch proposal with relations
    const { data: proposal, error: proposalError } = await supabaseAdmin
      .from("proposals")
      .select(`
        *,
        properties (id, address, borough),
        assigned_pm:profiles!proposals_assigned_pm_id_fkey (id, first_name, last_name, user_id)
      `)
      .eq("id", proposal_id)
      .single();

    if (proposalError || !proposal) {
      return new Response(
        JSON.stringify({ error: "Proposal not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientEmail = (proposal as any).client_email;
    if (!clientEmail) {
      return new Response(
        JSON.stringify({ error: "No client email on proposal" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company info
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name, email, phone, settings")
      .eq("id", (proposal as any).company_id)
      .single();

    const companySettings = ((company as any)?.settings || {}) as any;
    const companyName = company?.name || "Our Team";
    const companyEmail = companySettings.company_email?.trim() || company?.email || "";
    const companyPhone = companySettings.company_phone?.trim() || company?.phone || "";

    // Get PM info
    const pm = (proposal as any).assigned_pm;
    const pmName = pm ? [pm.first_name, pm.last_name].filter(Boolean).join(" ") : companyName;
    
    // Get PM's profile for email/phone
    let pmEmail = companyEmail;
    let pmPhone = companyPhone;
    if (pm?.id) {
      const { data: pmProfile } = await supabaseAdmin
        .from("profiles")
        .select("email, phone")
        .eq("id", pm.id)
        .single();
      if (pmProfile?.email) pmEmail = pmProfile.email;
      if ((pmProfile as any)?.phone) pmPhone = (pmProfile as any).phone;
    }

    // Get PIS link
    let pisLink: string | null = null;
    const { data: rfi } = await supabaseAdmin
      .from("rfi_requests")
      .select("access_token")
      .eq("proposal_id", proposal_id)
      .maybeSingle();

    if ((rfi as any)?.access_token) {
      // Use the proposal's origin or a default
      const baseUrl = Deno.env.get("SITE_URL") || `https://${Deno.env.get("SUPABASE_URL")?.replace("https://", "").replace(".supabase.co", "")}-preview--lovable.app`;
      pisLink = `${baseUrl}/rfi/${(rfi as any).access_token}`;
    }

    // Find a Gmail connection to send from - use PM's connection or any company admin
    let gmailConnection: any = null;

    if (pm?.id) {
      const { data: pmConn } = await supabaseAdmin
        .from("gmail_connections")
        .select("*")
        .eq("user_id", pm.id)
        .maybeSingle();
      if (pmConn) gmailConnection = pmConn;
    }

    // Fallback: find any Gmail connection in the company
    if (!gmailConnection) {
      const { data: anyConn } = await supabaseAdmin
        .from("gmail_connections")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (anyConn) gmailConnection = anyConn;
    }

    if (!gmailConnection) {
      return new Response(
        JSON.stringify({ error: "No Gmail connection available to send email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh token if needed
    let accessToken = gmailConnection.access_token;
    const tokenExpiry = new Date(gmailConnection.token_expires_at || 0);
    if (tokenExpiry <= new Date()) {
      const refreshed = await refreshAccessToken(
        gmailConnection.refresh_token!,
        gmailClientId,
        gmailClientSecret
      );
      if (!refreshed) {
        return new Response(
          JSON.stringify({ error: "Gmail token refresh failed" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      accessToken = refreshed.access_token;
      await supabaseAdmin
        .from("gmail_connections")
        .update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("id", gmailConnection.id);
    }

    const clientName = (proposal as any).client_name || "Valued Client";
    const projectTitle = (proposal as any).title || "Your Project";
    const propertyAddress = (proposal as any).properties?.address || "";

    const htmlBody = buildWelcomeEmailHtml({
      clientName,
      companyName,
      pmName,
      pmEmail,
      pmPhone,
      projectTitle,
      propertyAddress,
      pisLink,
      companyEmail,
      companyPhone,
    });

    const subject = `Welcome to ${companyName} — ${projectTitle}`;

    const raw = createMimeMessage({
      to: clientEmail,
      from: gmailConnection.email_address,
      subject,
      body: htmlBody,
    });

    const sendRes = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      }
    );

    const sendData = await sendRes.json();
    if (sendData.error) {
      console.error("Gmail send error:", sendData.error);
      return new Response(
        JSON.stringify({ error: sendData.error.message || "Send failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message_id: sendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Welcome email error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
