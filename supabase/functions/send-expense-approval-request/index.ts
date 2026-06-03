import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Design tokens (mirrors src/lib/buildBrandedEmailHtml.ts) ──
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

function resolveStyle(raw: any) {
  if (!raw) return DEFAULT_STYLE;
  return {
    accentColor: raw.accent_color || raw.accentColor || DEFAULT_STYLE.accentColor,
    fontFamily: raw.font_family || raw.fontFamily || DEFAULT_STYLE.fontFamily,
    buttonRadius: raw.button_radius || raw.buttonRadius || DEFAULT_STYLE.buttonRadius,
    bodyColor: raw.body_color || raw.bodyColor || DEFAULT_STYLE.bodyColor,
    headingColor: raw.heading_color || raw.headingColor || DEFAULT_STYLE.headingColor,
    bodyFontSize: raw.body_font_size || raw.bodyFontSize || DEFAULT_STYLE.bodyFontSize,
  };
}

function buildBrandedShell(opts: {
  style: any;
  logoUrl?: string;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  docLabel: string;
  docNumber?: string;
  innerHtml: string;
  stripeColor?: string;
}) {
  const { style, logoUrl, companyName, companyAddress, companyPhone, companyEmail, docLabel, docNumber, innerHtml, stripeColor } = opts;
  const accent = style.accentColor;
  const font = style.fontFamily;
  const stripe = stripeColor || accent;
  const contactLine = [companyPhone, companyEmail].filter(Boolean).join(" · ");
  const logoLockup = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" width="320" style="display:block;max-width:320px;max-height:64px;height:auto;border:0;" />`
    : `<span style="font-size:18px;font-weight:700;color:${accent};font-family:${font};">${companyName}</span>`;

  const docRightHtml = docNumber
    ? `<td style="vertical-align:top;text-align:right;white-space:nowrap;width:30%;font-family:${font};">
        <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};font-weight:600;font-family:${font};">${docLabel}</p>
        <p style="margin:2px 0 0;font-size:20px;font-weight:800;color:${HEADING};letter-spacing:-0.3px;line-height:1;font-family:${font};">${docNumber}</p>
      </td>`
    : `<td style="vertical-align:top;text-align:right;width:30%;font-family:${font};">
        <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};font-weight:600;font-family:${font};">${docLabel}</p>
      </td>`;

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
                  ${docRightHtml}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:0 48px;">
              <div style="height:3px;line-height:3px;font-size:3px;background:${stripe};">&nbsp;</div>
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

function fmtMoney(n: number) {
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { expense_id, approver_profile_ids } = await req.json();
    if (!expense_id) {
      return new Response(JSON.stringify({ error: "expense_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load expense + project
    const { data: exp, error: expErr } = await supabase
      .from("project_expenses")
      .select("*, projects(id, name, project_number, properties(address)), created_by_profile:profiles!project_expenses_created_by_fkey(display_name, first_name, last_name)")
      .eq("id", expense_id)
      .maybeSingle();
    if (expErr) throw expErr;
    if (!exp) {
      return new Response(JSON.stringify({ error: "expense not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve approver user emails
    let profileIds: string[] = Array.isArray(approver_profile_ids) ? approver_profile_ids : [];
    if (profileIds.length === 0) {
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_id", exp.company_id)
        .eq("role", "admin")
        .eq("is_active", true);
      profileIds = (admins || []).map((a: any) => a.id);
    }

    if (profileIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, reason: "no_approvers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: approvers } = await supabase
      .from("profiles")
      .select("id, user_id, first_name, last_name, display_name")
      .in("id", profileIds);

    const userIds = (approvers || []).map((a: any) => a.user_id).filter(Boolean);
    const emails: { email: string; name: string }[] = [];
    for (const uid of userIds) {
      const { data: u } = await supabase.auth.admin.getUserById(uid);
      const ap = (approvers || []).find((a: any) => a.user_id === uid);
      if (u?.user?.email && ap) {
        emails.push({
          email: u.user.email,
          name: ap.display_name || `${ap.first_name || ""} ${ap.last_name || ""}`.trim() || "Approver",
        });
      }
    }

    if (emails.length === 0) {
      return new Response(JSON.stringify({ ok: true, reason: "no_emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch company branding ──
    const { data: companyData } = await supabase
      .from("companies")
      .select("name, logo_url, address, phone, email, settings")
      .eq("id", exp.company_id)
      .maybeSingle();

    const companyName = companyData?.name || "Ordino";
    const settings = (companyData?.settings && typeof companyData.settings === "object" && !Array.isArray(companyData.settings)) ? companyData.settings as Record<string, any> : {};
    const style = resolveStyle(settings.email_style);
    const logoUrl = companyData?.logo_url || settings.company_logo_url || undefined;
    const companyAddress = settings.company_address || companyData?.address || "";
    const companyPhone = settings.company_phone || companyData?.phone || "";
    const companyEmail = settings.company_email || companyData?.email || "";

    // ── Expense details ──
    const project = (exp as any).projects || {};
    const projRef = `${project.project_number || ""} ${project.name || ""}`.trim() || "Project";
    const address = project.properties?.address || "";
    const requester = (exp as any).created_by_profile;
    const requesterName = requester?.display_name || `${requester?.first_name || ""} ${requester?.last_name || ""}`.trim() || "PM";
    const amount = fmtMoney(Number(exp.amount));
    const billable = fmtMoney(Number(exp.billable_amount));
    const markupPct = Number(exp.markup_pct) || 0;
    const link = `https://app.ordinocrm.com/dashboard?expense=${exp.id}`;
    const subject = `Expense Approval — ${amount} — ${projRef}`;

    // Stripe color: amber to denote approval urgency
    const stripeColor = "#f59e0b";

    const fontSize = style.bodyFontSize;
    const headingClr = style.headingColor;
    const bodyClr = style.bodyColor;
    const accent = style.accentColor;
    const btnRadius = style.buttonRadius;
    const font = style.fontFamily;

    const rowStyle = `padding:10px 14px;font-size:${fontSize};font-family:${font};`;
    const labelStyle = `${rowStyle}color:${MUTED};width:130px;`;
    const valueStyle = `${rowStyle}color:${headingClr};`;

    const detailsTable = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:8px;background:${CARD_BG};margin:8px 0 0;">
        <tr><td style="${labelStyle}">Project</td><td style="${valueStyle}">${projRef}</td></tr>
        ${address ? `<tr><td style="${labelStyle}">Address</td><td style="${valueStyle}">${address}</td></tr>` : ""}
        <tr><td style="${labelStyle}">Description</td><td style="${valueStyle}">${exp.description}</td></tr>
        ${exp.vendor ? `<tr><td style="${labelStyle}">Vendor</td><td style="${valueStyle}">${exp.vendor}</td></tr>` : ""}
        <tr><td style="${labelStyle}">Cost</td><td style="${valueStyle}font-weight:600;">${amount}</td></tr>
        ${markupPct > 0 ? `<tr><td style="${labelStyle}">Markup</td><td style="${valueStyle}">${markupPct}% · bills to client: <strong>${billable}</strong></td></tr>` : ""}
        <tr><td style="${labelStyle}">Requested by</td><td style="${valueStyle}">${requesterName}</td></tr>
      </table>`;

    const innerHtml = `
      <p style="margin:0 0 16px;font-size:${fontSize};color:${headingClr};line-height:1.6;font-family:${font};">Hi {{APPROVER_NAME}},</p>
      <p style="margin:0 0 8px;font-size:${fontSize};color:${bodyClr};line-height:1.6;font-family:${font};">
        <strong>${requesterName}</strong> is requesting approval to pay an expense.
      </p>
      ${detailsTable}
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="${link}" style="display:inline-block;background:${accent};color:#1a1a2e;text-decoration:none;padding:14px 44px;border-radius:${btnRadius};font-size:16px;font-weight:700;letter-spacing:0.2px;font-family:${font};">Review &amp; Approve</a>
      </div>
      <p style="margin:24px 0 0;font-size:${fontSize};color:${bodyClr};line-height:1.6;font-family:${font};">
        Approving releases the expense back to the PM to pay and mark as paid. Denying notifies them with your reason.
      </p>
      <p style="margin:16px 0 0;font-size:${fontSize};color:${headingClr};font-family:${font};">— ${companyName}</p>
    `;

    const sentTo: string[] = [];
    for (const r of emails) {
      try {
        const personalizedInner = innerHtml.replace("{{APPROVER_NAME}}", r.name);
        const html = buildBrandedShell({
          style,
          logoUrl,
          companyName,
          companyAddress,
          companyPhone,
          companyEmail,
          docLabel: "Expense Approval",
          innerHtml: personalizedInner,
          stripeColor,
        });
        await supabase.functions.invoke("gmail-send", {
          body: { to: r.email, subject, html_body: html },
        });
        sentTo.push(r.email);
      } catch (err) {
        console.error("gmail-send failed for", r.email, err);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent_to: sentTo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
