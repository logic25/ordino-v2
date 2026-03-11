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
  attachments,
}: {
  to: string;
  from: string;
  subject: string;
  body: string;
  attachments?: { filename: string; mimeType: string; base64Data: string }[];
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
  ];

  // Add attachments
  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      parts.push(`--${boundary}`);
      parts.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
      parts.push("Content-Transfer-Encoding: base64");
      parts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      parts.push("");
      // Split base64 into 76-char lines for MIME compliance
      const b64 = att.base64Data;
      for (let i = 0; i < b64.length; i += 76) {
        parts.push(b64.slice(i, i + 76));
      }
    }
  }

  parts.push(`--${boundary}--`);

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
  hasProposalAttachment,
  logoUrl,
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
  hasProposalAttachment: boolean;
  logoUrl: string | null;
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

  const attachmentNote = hasProposalAttachment
    ? `<p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6;">📎 A copy of your fully executed proposal is attached to this email for your records.</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="background:#1e293b;padding:24px 32px;border-radius:12px 12px 0 0;">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:40px;max-width:180px;margin-bottom:12px;display:block;" />` : ""}
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${companyName}</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Welcome to Your Project</p>
    </div>

    <!-- Body Card -->
    <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px;font-size:15px;color:#1e293b;line-height:1.6;">Hi ${clientName},</p>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
        Thank you for choosing <strong>${companyName}</strong>. We're excited to get started on <strong>${projectTitle}</strong>${propertyAddress ? ` at <strong>${propertyAddress}</strong>` : ""}.
      </p>

      ${attachmentNote}

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

  // Service-role auth check
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      .select("name, email, phone, settings, logo_url")
      .eq("id", (proposal as any).company_id)
      .single();

    const companySettings = ((company as any)?.settings || {}) as any;
    const companyName = company?.name || "Our Team";
    const companyEmail = companySettings.company_email?.trim() || company?.email || "";
    const companyPhone = companySettings.company_phone?.trim() || company?.phone || "";

    // Get PM info
    const pm = (proposal as any).assigned_pm;
    const pmName = pm ? [pm.first_name, pm.last_name].filter(Boolean).join(" ") : companyName;
    
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

    // Get PIS link — check by proposal_id first, then by project_id
    let pisLink: string | null = null;
    let rfiToken: string | null = null;

    const { data: rfiByProposal } = await supabaseAdmin
      .from("rfi_requests")
      .select("access_token")
      .eq("proposal_id", proposal_id)
      .maybeSingle();
    rfiToken = (rfiByProposal as any)?.access_token || null;

    if (!rfiToken && (proposal as any).project_id) {
      const { data: rfiByProject } = await supabaseAdmin
        .from("rfi_requests")
        .select("access_token")
        .eq("project_id", (proposal as any).project_id)
        .maybeSingle();
      rfiToken = (rfiByProject as any)?.access_token || null;
    }

    if (rfiToken) {
      pisLink = `https://ordinov3.lovable.app/rfi?token=${rfiToken}`;
    }

    // Only attach the proposal if it's fully executed (both parties signed)
    let proposalAttachment: { filename: string; mimeType: string; base64Data: string } | null = null;
    const isFullyExecuted = !!(proposal as any).signed_at && !!(proposal as any).client_signed_at;

    if (isFullyExecuted) {
      try {
        const proposalNum = (proposal as any).proposal_number || "draft";
        let fileData: Blob | null = null;
        let mimeType = "application/pdf";
        let ext = "pdf";

        const { data: pdfData, error: pdfErr } = await supabaseAdmin.storage
          .from("documents")
          .download(`proposals/${proposal_id}/signed_proposal.pdf`);
        
        if (pdfData && !pdfErr) {
          fileData = pdfData;
        } else {
          const { data: htmlData, error: htmlErr } = await supabaseAdmin.storage
            .from("documents")
            .download(`proposals/${proposal_id}/signed_proposal.html`);
          if (htmlData && !htmlErr) {
            fileData = htmlData;
            mimeType = "text/html";
            ext = "html";
          }
        }

        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          proposalAttachment = {
            filename: `Proposal_${proposalNum}_Executed.${ext}`,
            mimeType,
            base64Data: base64,
          };
        }
      } catch (attachErr) {
        console.error("Could not attach signed proposal:", attachErr);
      }
    } else {
      console.log("Skipping proposal attachment — not fully executed (signed_at:", (proposal as any).signed_at, "client_signed_at:", (proposal as any).client_signed_at, ")");
    }

    // Find a Gmail connection to send from
    let gmailConnection: any = null;

    if (pm?.id) {
      const { data: pmConn } = await supabaseAdmin
        .from("gmail_connections")
        .select("*")
        .eq("user_id", pm.id)
        .maybeSingle();
      if (pmConn) gmailConnection = pmConn;
    }

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

    // Resolve client name
    let clientName = (proposal as any).client_name;
    if (!clientName && (proposal as any).client_id) {
      const { data: primaryContact } = await supabaseAdmin
        .from("client_contacts")
        .select("name, first_name, last_name")
        .eq("client_id", (proposal as any).client_id)
        .eq("is_primary", true)
        .maybeSingle();
      if (primaryContact) {
        clientName = [primaryContact.first_name, primaryContact.last_name].filter(Boolean).join(" ") || primaryContact.name;
      }
    }
    if (!clientName) clientName = "Valued Client";

    const propertyAddress = (proposal as any).properties?.address || "";
    let projectTitle = (proposal as any).title || "Your Project";
    const titleIncludesAddress = propertyAddress && projectTitle.includes(propertyAddress);

    const subject = `Welcome to ${companyName} — ${projectTitle}`;
    const bodyPropertyAddress = titleIncludesAddress ? "" : propertyAddress;

    const htmlBody = buildWelcomeEmailHtml({
      clientName,
      companyName,
      pmName,
      pmEmail,
      pmPhone,
      projectTitle,
      propertyAddress: bodyPropertyAddress,
      pisLink,
      companyEmail,
      companyPhone,
      hasProposalAttachment: !!proposalAttachment,
      logoUrl: (company as any)?.logo_url || null,
    });

    const attachments = proposalAttachment ? [proposalAttachment] : [];

    const raw = createMimeMessage({
      to: clientEmail,
      from: gmailConnection.email_address,
      subject,
      body: htmlBody,
      attachments,
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
      JSON.stringify({ success: true, message_id: sendData.id, has_attachment: !!proposalAttachment }),
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