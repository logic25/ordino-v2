import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Design tokens (mirrors buildBrandedEmailHtml.ts) ──
const HEADING = "#1e293b";
const BODY_COLOR = "#334155";
const MUTED = "#94a3b8";
const BORDER = "#e2e8f0";
const CARD_BG = "#f8fafc";

const DEFAULT_STYLE = {
  accentColor: "#16a34a",
  fontFamily: "Arial, Helvetica, sans-serif",
  buttonRadius: "8px",
  bodyColor: BODY_COLOR,
  headingColor: HEADING,
  bodyFontSize: "14px",
};

interface StyleResolved {
  accentColor: string;
  fontFamily: string;
  buttonRadius: string;
  bodyColor: string;
  headingColor: string;
  bodyFontSize: string;
}

function resolveStyle(raw: any): StyleResolved {
  if (!raw) return DEFAULT_STYLE as StyleResolved;
  return {
    accentColor: raw.accent_color || raw.accentColor || DEFAULT_STYLE.accentColor,
    fontFamily: raw.font_family || raw.fontFamily || DEFAULT_STYLE.fontFamily,
    buttonRadius: raw.button_radius || raw.buttonRadius || DEFAULT_STYLE.buttonRadius,
    bodyColor: raw.body_color || raw.bodyColor || DEFAULT_STYLE.bodyColor,
    headingColor: raw.heading_color || raw.headingColor || DEFAULT_STYLE.headingColor,
    bodyFontSize: raw.body_font_size || raw.bodyFontSize || DEFAULT_STYLE.bodyFontSize,
  };
}

// Default templates per type
const TEMPLATE_DEFAULTS: Record<string, { subject: string; greeting: string; body_text: string; cta_text: string; signoff: string }> = {
  bug_report: {
    subject: "🐛 New Bug: {{BUG_TITLE}}",
    greeting: "Hi {{USER_NAME}},",
    body_text: "A new bug has been reported:",
    cta_text: "View in Help Center",
    signoff: "",
  },
  bug_comment: {
    subject: "💬 Comment on Bug: {{BUG_TITLE}}",
    greeting: "Hi {{USER_NAME}},",
    body_text: "{{COMMENTER_NAME}} commented on a bug report:",
    cta_text: "View Bug",
    signoff: "",
  },
  bug_resolved: {
    subject: "✅ Bug Resolved: {{BUG_TITLE}}",
    greeting: "Hi {{USER_NAME}},",
    body_text: "The following bug has been resolved:",
    cta_text: "View in Help Center",
    signoff: "",
  },
  bug_status_change: {
    subject: "{{STATUS_ICON}} {{STATUS_LABEL}}: {{BUG_TITLE}}",
    greeting: "Hi {{USER_NAME}},",
    body_text: "The following bug has been {{STATUS_ACTION}}:",
    cta_text: "View in Help Center",
    signoff: "",
  },
};

function resolveTemplate(
  templateId: string,
  overrides: any,
  variables: Record<string, string>,
) {
  const defaults = TEMPLATE_DEFAULTS[templateId] || TEMPLATE_DEFAULTS.bug_report;
  const raw = {
    subject: overrides?.subject || defaults.subject,
    greeting: overrides?.greeting || defaults.greeting,
    body_text: overrides?.body_text || defaults.body_text,
    cta_text: overrides?.cta_text || defaults.cta_text,
    signoff: overrides?.signoff || defaults.signoff,
  };
  const replace = (text: string) =>
    Object.entries(variables).reduce((t, [k, v]) => t.split(`{{${k}}}`).join(v), text);
  return {
    subject: replace(raw.subject),
    greeting: replace(raw.greeting),
    body_text: replace(raw.body_text),
    cta_text: replace(raw.cta_text),
    signoff: replace(raw.signoff),
  };
}

function buildBrandedShell(opts: {
  style: StyleResolved;
  logoUrl?: string;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  docLabel: string;
  innerHtml: string;
  stripeColor?: string;
}) {
  const { style, logoUrl, companyName, companyAddress, companyPhone, companyEmail, docLabel, innerHtml, stripeColor } = opts;
  const accent = stripeColor || style.accentColor;
  const font = style.fontFamily;
  const contactLine = [companyPhone, companyEmail].filter(Boolean).join(" · ");
  const logoLockup = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" width="320" style="display:block;max-width:320px;max-height:64px;height:auto;border:0;" />`
    : `<span style="font-size:18px;font-weight:700;color:${accent};font-family:${font};">${companyName}</span>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CARD_BG};font-family:${font};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CARD_BG};font-family:${font};">
    <tr>
      <td align="center" style="padding:32px 16px;font-family:${font};">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;font-family:${font};">
          <tr>
            <td style="background:#ffffff;padding:28px 32px 0 32px;border:1px solid ${BORDER};border-bottom:none;border-radius:12px 12px 0 0;font-family:${font};">
              <table role="presentation" style="width:100%;table-layout:fixed;" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top;width:70%;padding-right:20px;font-family:${font};">
                    ${logoLockup}
                    ${companyAddress ? `<p style="margin:10px 0 0;color:${MUTED};font-size:11px;line-height:1.4;max-width:280px;font-family:${font};">${companyAddress}</p>` : ""}
                    ${contactLine ? `<p style="margin:4px 0 0;color:${MUTED};font-size:11px;line-height:1.4;max-width:280px;word-break:break-word;font-family:${font};">${contactLine}</p>` : ""}
                  </td>
                  <td style="vertical-align:top;text-align:right;width:30%;font-family:${font};">
                    <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};font-weight:600;font-family:${font};">${docLabel}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:0 48px;">
              <div style="height:3px;line-height:3px;font-size:3px;background:${accent};">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid ${BORDER};border-top:none;border-radius:0 0 12px 12px;font-family:${font};">
              ${innerHtml}
            </td>
          </tr>
          ${contactLine ? `<tr><td style="text-align:center;padding:16px;font-size:11px;color:${MUTED};font-family:${font};">${contactLine}</td></tr>` : ""}
        </table>
      </td>
    </tr>
  </table>
</body></html>`;
}

function buildCommentsThread(comments: any[], style: StyleResolved) {
  if (!Array.isArray(comments) || comments.length === 0) return "";
  return `<div style="margin:20px 0;">
    <p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">💬 Recent Thread</p>
    ${comments.map((c: any) => `
      <div style="background:#f9fafb;padding:12px 14px;border-radius:6px;margin-top:6px;border:1px solid ${BORDER};">
        <div style="font-size:12px;color:#6b7280;margin-bottom:4px;"><strong>${c.commenter_name || "Someone"}</strong> · ${new Date(c.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
        <div style="color:#374151;font-size:14px;line-height:1.5;white-space:pre-line;">${c.message || ""}</div>
        ${Array.isArray(c.attachments) && c.attachments.length > 0 ? `<div style="margin-top:6px;">${c.attachments.map((a: any) => a.type?.startsWith("image/") ? `<img src="${a.url}" alt="${a.name}" style="max-height:80px;border-radius:4px;margin:2px;" />` : `<a href="${a.url}" style="color:${style.accentColor};font-size:12px;">📎 ${a.name}</a>`).join(" ")}</div>` : ""}
      </div>
    `).join("")}
  </div>`;
}

function formatDesc(desc: string | undefined) {
  if (!desc) return "";
  return desc
    .replace(/\*\*([^*]+):\*\*/g, "<strong>$1:</strong>")
    .replace(/\\n/g, "\n")
    .split("\n")
    .filter((l: string) => l.trim())
    .map((l: string) => `<div style="color:#4b5563;font-size:13px;line-height:1.6;">${l.trim()}</div>`)
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const isServiceRole = token && token === serviceRoleKey;

    let callerAuthId: string | null = null;
    if (!isServiceRole) {
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUser = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      callerAuthId = user.id;
    }

    const { data: callerProfile } = callerAuthId
      ? await supabase.from("profiles").select("id").eq("user_id", callerAuthId).single()
      : { data: null as { id: string } | null };

    const body = await req.json();
    const { action, bug_id, bug_title, bug_description, bug_priority, company_id, reporter_name } = body;
    const bugTag = bug_id ? ` [BUG-${bug_id.substring(0, 8)}]` : "";

    if (!company_id || !bug_title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch company branding ──
    const { data: companyData } = await supabase
      .from("companies")
      .select("name, logo_url, address, phone, email, settings")
      .eq("id", company_id)
      .single();

    const companyName = companyData?.name || "Ordino";
    const settings = (companyData?.settings && typeof companyData.settings === "object" && !Array.isArray(companyData.settings)) ? companyData.settings as Record<string, any> : {};
    const style = resolveStyle(settings.email_style);
    const templateOverrides = settings.email_template_overrides || {};
    const logoUrl = companyData?.logo_url || settings.company_logo_url || undefined;
    const companyAddress = settings.company_address || companyData?.address || "";
    const companyPhone = settings.company_phone || companyData?.phone || "";
    const companyEmail = settings.company_email || companyData?.email || "";

    // ── Gmail connection ──
    const { data: connections } = await supabase
      .from("gmail_connections")
      .select("user_id, email_address, access_token, refresh_token, token_expires_at")
      .eq("company_id", company_id);

    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_gmail_connections" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sender = (callerProfile && connections.find(c => c.user_id === callerProfile.id)) || connections[0];

    // ── Helper ──
    const getEmailByProfileId = async (profileId: string): Promise<string | null> => {
      const { data: prof } = await supabase.from("profiles").select("user_id").eq("id", profileId).single();
      if (!prof?.user_id) return null;
      const { data: { user: u } } = await supabase.auth.admin.getUserById(prof.user_id);
      return u?.email || null;
    };

    const getAdminEmails = async (): Promise<string[]> => {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, user_id")
        .eq("company_id", company_id)
        .eq("is_active", true)
        .eq("role", "admin");
      const emails: string[] = [];
      for (const p of adminProfiles || []) {
        const { data: { user: u } } = await supabase.auth.admin.getUserById(p.user_id);
        if (u?.email && !emails.includes(u.email)) emails.push(u.email);
      }
      return emails;
    };

    const sendEmails = async (recipients: string[], subject: string, html: string) => {
      let sentCount = 0;
      for (const email of recipients) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({ user_id: sender.user_id, to: email, subject, html_body: html }),
          });
          if (res.ok) sentCount++;
        } catch (e) {
          console.error(`Failed to send to ${email}:`, e);
        }
      }
      return sentCount;
    };

    const buildBody = (greetingText: string, bodyText: string, contentHtml: string, ctaText: string, signoffText: string) => {
      const greetingHtml = `<p style="margin:0 0 16px;font-size:${style.bodyFontSize};color:${style.headingColor};line-height:1.6;">${greetingText}</p>`;
      const bodyHtml = `<p style="margin:0 0 24px;font-size:${style.bodyFontSize};color:${style.bodyColor};line-height:1.6;">${bodyText}</p>`;
      const ctaHtml = ctaText
        ? `<div style="text-align:center;margin:32px 0;"><a href="https://ordinov3.lovable.app/help" style="display:inline-block;background:${style.accentColor};color:#1a1a2e;text-decoration:none;padding:14px 44px;border-radius:${style.buttonRadius};font-size:16px;font-weight:700;">${ctaText}</a></div>`
        : "";
      const signoffHtml = signoffText
        ? `<p style="margin:24px 0 0;font-size:${style.bodyFontSize};color:${style.bodyColor};line-height:1.6;">${signoffText}</p><p style="margin:16px 0 0;font-size:${style.bodyFontSize};color:${style.headingColor};">— ${companyName}</p>`
        : `<p style="margin:16px 0 0;font-size:${style.bodyFontSize};color:${style.headingColor};">— ${companyName}</p>`;
      return greetingHtml + bodyHtml + contentHtml + ctaHtml + signoffHtml;
    };

    // ── RESOLVED ──
    if (action === "resolved") {
      const { reporter_user_id, admin_notes, recent_comments } = body;
      const recipients: string[] = [];
      if (reporter_user_id) {
        const e = await getEmailByProfileId(reporter_user_id);
        if (e) recipients.push(e);
      }
      for (const e of await getAdminEmails()) {
        if (!recipients.includes(e)) recipients.push(e);
      }
      if (recipients.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const tpl = resolveTemplate("bug_resolved", templateOverrides.bug_resolved, { BUG_TITLE: bug_title, USER_NAME: "" });

      const contentHtml = `
        <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 18px;margin-bottom:24px;border-radius:4px;">
          <strong style="color:#15803d;font-size:15px;">${bug_title}</strong>
          ${bug_description ? `<div style="margin-top:10px;">${formatDesc(bug_description)}</div>` : ""}
        </div>
        ${admin_notes ? `<div style="margin-bottom:20px;"><p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">📝 Resolution Notes</p><div style="background:#f9fafb;padding:14px;border-radius:6px;border:1px solid ${BORDER};white-space:pre-line;color:#4b5563;font-size:14px;line-height:1.5;">${admin_notes}</div></div>` : ""}
        ${buildCommentsThread(recent_comments, style)}`;

      const innerHtml = buildBody(tpl.greeting, tpl.body_text, contentHtml, tpl.cta_text, tpl.signoff);
      const html = buildBrandedShell({ style, logoUrl, companyName, companyAddress, companyPhone, companyEmail, docLabel: "Bug Resolved", innerHtml });
      const sent = await sendEmails(recipients, tpl.subject + bugTag, html);
      return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── STATUS CHANGE (reopened, in_progress, ready_for_review) ──
    if (action === "reopened" || action === "in_progress" || action === "ready_for_review") {
      const { reopened_by_name, reporter_user_id, admin_notes, recent_comments } = body;
      const recipients: string[] = [];
      if (reporter_user_id) {
        const e = await getEmailByProfileId(reporter_user_id);
        if (e) recipients.push(e);
      }
      for (const e of await getAdminEmails()) {
        if (!recipients.includes(e)) recipients.push(e);
      }
      if (recipients.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const isReopened = action === "reopened";
      const isReady = action === "ready_for_review";
      const statusIcon = isReopened ? "🔄" : isReady ? "👀" : "🔧";
      const statusLabel = isReopened ? "Bug Reopened" : isReady ? "Bug Ready for Review" : "Bug In Progress";
      const statusAction = isReopened ? "reopened" : isReady ? "marked as ready for review" : "moved to In Progress";
      const cardBorderColor = isReopened ? "#ea580c" : isReady ? "#7c3aed" : "#2563eb";
      const cardBg = isReopened ? "#fff7ed" : isReady ? "#f5f3ff" : "#eff6ff";
      const titleColor = isReopened ? "#c2410c" : isReady ? "#6d28d9" : "#1d4ed8";

      const tpl = resolveTemplate("bug_status_change", templateOverrides.bug_status_change, {
        BUG_TITLE: bug_title, USER_NAME: "", STATUS_ICON: statusIcon, STATUS_LABEL: statusLabel, STATUS_ACTION: statusAction,
      });

      const byLine = isReopened && reopened_by_name ? ` by <strong>${reopened_by_name}</strong>` : "";
      const contentHtml = `
        <div style="background:${cardBg};border-left:4px solid ${cardBorderColor};padding:14px 18px;margin-bottom:24px;border-radius:4px;">
          <strong style="color:${titleColor};font-size:15px;">${bug_title}</strong>
          ${bug_description ? `<div style="margin-top:10px;">${formatDesc(bug_description)}</div>` : ""}
        </div>
        ${isReady && admin_notes ? `<div style="margin-bottom:20px;"><p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">📝 What was changed</p><div style="background:#f9fafb;padding:14px;border-radius:6px;border:1px solid ${BORDER};white-space:pre-line;color:#4b5563;font-size:14px;line-height:1.5;">${admin_notes}</div></div>` : ""}
        ${buildCommentsThread(recent_comments, style)}`;

      const bodyWithBy = tpl.body_text.replace(/:$/, byLine + ":");
      const innerHtml = buildBody(tpl.greeting, bodyWithBy, contentHtml, tpl.cta_text, tpl.signoff);
      const html = buildBrandedShell({ style, logoUrl, companyName, companyAddress, companyPhone, companyEmail, docLabel: statusLabel, innerHtml });
      const sent = await sendEmails(recipients, tpl.subject + bugTag, html);
      return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── COMMENT ──
    if (action === "comment") {
      const { commenter_user_id, commenter_name, comment_message, reporter_user_id, comment_attachments, recent_comments } = body;
      const recipients: string[] = [];
      const commenterIsReporter = commenter_user_id === reporter_user_id;

      if (commenterIsReporter) {
        for (const e of await getAdminEmails()) {
          if (!recipients.includes(e)) recipients.push(e);
        }
      } else {
        if (reporter_user_id) {
          const e = await getEmailByProfileId(reporter_user_id);
          if (e) recipients.push(e);
        }
      }
      if (recipients.length === 0) return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const tpl = resolveTemplate("bug_comment", templateOverrides.bug_comment, {
        BUG_TITLE: bug_title, USER_NAME: "", COMMENTER_NAME: commenter_name || "Someone",
      });

      const attachmentsHtml = Array.isArray(comment_attachments) && comment_attachments.length > 0
        ? `<div style="margin:12px 0;"><strong style="color:#374151;font-size:13px;">Attachments:</strong><div style="margin-top:8px;">${comment_attachments.map((att: any) =>
            att.type?.startsWith("image/")
              ? `<a href="${att.url}" target="_blank"><img src="${att.url}" alt="${att.name}" style="max-height:120px;max-width:200px;border-radius:6px;border:1px solid ${BORDER};margin:4px 4px 4px 0;" /></a>`
              : `<a href="${att.url}" target="_blank" style="color:${style.accentColor};font-size:13px;">📎 ${att.name}</a><br/>`
          ).join("")}</div></div>`
        : "";

      const contentHtml = `
        <div style="background:${CARD_BG};border-left:4px solid ${style.accentColor};padding:14px 18px;margin-bottom:16px;border-radius:4px;">
          <strong style="color:${style.headingColor};font-size:15px;">${bug_title}</strong>
        </div>
        ${buildCommentsThread(recent_comments, style)}
        ${attachmentsHtml}`;

      const innerHtml = buildBody(tpl.greeting, tpl.body_text, contentHtml, tpl.cta_text, tpl.signoff);
      const html = buildBrandedShell({ style, logoUrl, companyName, companyAddress, companyPhone, companyEmail, docLabel: "Bug Comment", innerHtml });
      const sent = await sendEmails(recipients, tpl.subject + bugTag, html);
      return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── NEW BUG REPORT (default) ──
    const adminEmails = await getAdminEmails();
    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_admin_emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tpl = resolveTemplate("bug_report", templateOverrides.bug_report, {
      BUG_TITLE: bug_title, USER_NAME: "",
    });

    const priorityColor = bug_priority === "critical" ? "#dc2626" : bug_priority === "high" ? "#ea580c" : "#6b7280";
    const contentHtml = `
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:14px 18px;margin-bottom:24px;border-radius:4px;">
        <strong style="color:#b91c1c;font-size:15px;">${bug_title}</strong>
        <div style="margin-top:8px;color:#4b5563;font-size:13px;line-height:1.6;">
          <div><strong>Priority:</strong> <span style="color:${priorityColor};font-weight:600;">${(bug_priority || "medium").toUpperCase()}</span></div>
          <div><strong>Reporter:</strong> ${reporter_name || "Unknown"}</div>
          ${bug_description ? `<div style="margin-top:8px;">${formatDesc(bug_description)}</div>` : ""}
        </div>
      </div>`;

    const innerHtml = buildBody(tpl.greeting, tpl.body_text, contentHtml, tpl.cta_text, tpl.signoff);
    const html = buildBrandedShell({ style, logoUrl, companyName, companyAddress, companyPhone, companyEmail, docLabel: "Bug Report", innerHtml });
    const sent = await sendEmails(adminEmails, tpl.subject + bugTag, html);
    return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("send-bug-alert error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
