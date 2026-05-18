/**
 * Shared branded email shell — mirrors the Email Template Gallery preview exactly.
 * All outgoing emails should use this shell for brand consistency.
 */

import { resolveEmailStyle, type EmailStyleConfig } from "@/lib/email/shared";

export type { EmailStyleConfig };

// ── Design tokens (must match EmailTemplateGallery.tsx) ──
const HEADING = "#1e293b";
const BODY_COLOR = "#334155";
const MUTED = "#94a3b8";
const BORDER = "#e2e8f0";
const CARD_BG = "#f8fafc";

const DEFAULT_STYLE = {
  accentColor: "#16a34a",
  accentTextColor: "#16a34a",
  fontFamily: "Arial, Helvetica, sans-serif",
  buttonRadius: "8px",
  bodyColor: BODY_COLOR,
  headingColor: HEADING,
  bodyFontSize: "14px",
};

export interface TemplateOverride {
  subject?: string;
  greeting?: string;
  body_text?: string;
  cta_text?: string;
  signoff?: string;
}

export interface BrandedEmailConfig {
  /** Template ID for looking up overrides */
  templateId: string;
  /** Template overrides from gallery settings */
  templateOverrides?: TemplateOverride;
  /** Style config — accepts either camelCase (resolved) or snake_case (raw from settings) */
  styleConfig?: ProposalEmailStyleConfig | { accent_color?: string; accent_text_color?: string; font_family?: string; button_radius?: string; body_color?: string; heading_color?: string; body_font_size?: string } | null;
  /** Company info */
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  logoUrl?: string;
  /** Document label shown in top-right (e.g. "Invoice", "Payment Reminder") */
  docLabel: string;
  /** Document number shown in top-right (e.g. "INV-00042") */
  docNumber?: string;
  /** Variable replacement map */
  variables: Record<string, string>;
  /** Override stripe color (defaults to accent) */
  stripeColor?: string;
  /** CTA link URL */
  ctaLink?: string;
  /** Inner body HTML to insert between greeting and signoff */
  innerBodyHtml?: string;
}

// Default templates per ID
const TEMPLATE_DEFAULTS: Record<string, Required<TemplateOverride>> = {
  invoice: {
    subject: "Invoice {{INVOICE_NUMBER}} — {{PROJECT_TITLE}}",
    greeting: "Dear {{CLIENT_NAME}},",
    body_text: "Here are the details for invoice {{INVOICE_NUMBER}}. Payment is due by {{DUE_DATE}}.",
    cta_text: "",
    signoff: "Payment can be made by check or wire transfer. Details are on the attached invoice. Questions? Just reply to this email.",
  },
  reminder: {
    subject: "Payment Reminder — {{INVOICE_NUMBER}}",
    greeting: "Dear {{CLIENT_NAME}},",
    body_text: "Invoice {{INVOICE_NUMBER}} for {{AMOUNT}} was due {{DAYS_OVERDUE}} days ago. If payment has already been sent, thank you — please disregard this notice. Otherwise, we'd appreciate prompt attention.",
    cta_text: "",
    signoff: "If there's an issue with this invoice, please let us know so we can resolve it.",
  },
  demand_letter: {
    subject: "FORMAL DEMAND — {{INVOICE_NUMBER}}",
    greeting: "Dear {{CLIENT_NAME}},",
    body_text: "Despite multiple prior communications, invoice {{INVOICE_NUMBER}} in the amount of {{AMOUNT}} remains unpaid and is now {{DAYS_OVERDUE}} days past due. This letter serves as a formal demand for immediate payment in full.",
    cta_text: "",
    signoff: "We expect payment within 10 business days of this notice. Failure to remit payment may result in further collection action. If you believe this is in error, contact us immediately.",
  },
  billing_digest: {
    subject: "Billing Summary — {{DATE_RANGE}}",
    greeting: "Hi {{USER_NAME}},",
    body_text: "Here's your billing summary for {{DATE_RANGE}}.",
    cta_text: "",
    signoff: "",
  },
  billing_alert: {
    subject: "Billing Alert: {{PROJECT_NUMBER}} — {{AMOUNT}}",
    greeting: "Hello {{USER_NAME}},",
    body_text: "New services have been sent to billing:",
    cta_text: "View Project",
    signoff: "",
  },
  partner_outreach: {
    subject: "Partnership Opportunity — {{RFP_TITLE}}",
    greeting: "Hello,",
    body_text: "Green Light Expediting is a NYC-based DOB filing and expediting firm. We're reaching out because we can provide inspection coordination, permit expediting, and compliance support for this RFP. We've handled similar scopes across Manhattan, Brooklyn, and Queens.",
    cta_text: "I'm Interested",
    signoff: "",
  },
  checklist_followup: {
    subject: "Action Needed — {{PROJECT_TITLE}}",
    greeting: "Hi {{CLIENT_NAME}},",
    body_text: "We need a few things from you before we can move forward with filing. These items are holding up your project — the sooner we receive them, the sooner we can submit to DOB.",
    cta_text: "",
    signoff: "You can reply to this email with the documents attached, or send them directly to your PM.",
  },
  welcome: {
    subject: "Welcome! Let's get started on {{PROJECT_TITLE}}",
    greeting: "Hi {{CLIENT_NAME}},",
    body_text: "Your proposal has been signed and your project is officially underway. Your Project Manager is {{PM_NAME}} — they'll be your main point of contact throughout the process.",
    cta_text: "Fill Out Project Information Sheet",
    signoff: "One thing we need from you to get moving: please fill out the Project Information Sheet below. This gives us the owner info, access details, and contacts we need to file on your behalf.",
  },
  co_signed: {
    subject: "Your Signed Change Order — {{CO_NUMBER}}",
    greeting: "Hi {{CLIENT_NAME}},",
    body_text: "Thank you for signing. Here is a summary for your records:",
    cta_text: "",
    signoff: "If you need a printable copy, please revisit the original link.",
  },
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
  pis_reminder: {
    subject: "Reminder: Project Information Sheet — {{PROJECT_TITLE}}",
    greeting: "Hi {{CLIENT_NAME}},",
    body_text: "This is a friendly reminder to complete the Project Information Sheet for {{PROJECT_TITLE}}{{PROPERTY_ADDRESS_LINE}}.",
    cta_text: "Complete PIS →",
    signoff: "If you've already submitted this, please disregard this message.",
  },
};

/**
 * Resolve a template's fields by merging gallery overrides with defaults,
 * then replacing {{VARIABLE}} placeholders.
 */
export function resolveTemplate(
  templateId: string,
  overrides: TemplateOverride | undefined,
  variables: Record<string, string>,
): Required<TemplateOverride> {
  const defaults = TEMPLATE_DEFAULTS[templateId] || {
    subject: "", greeting: "", body_text: "", cta_text: "", signoff: "",
  };

  const raw: Required<TemplateOverride> = {
    subject: overrides?.subject || defaults.subject,
    greeting: overrides?.greeting || defaults.greeting,
    body_text: overrides?.body_text || defaults.body_text,
    cta_text: overrides?.cta_text || defaults.cta_text,
    signoff: overrides?.signoff || defaults.signoff,
  };

  const replace = (text: string) =>
    Object.entries(variables).reduce(
      (t, [k, v]) => t.split(`{{${k}}}`).join(v),
      text,
    );

  return {
    subject: replace(raw.subject),
    greeting: replace(raw.greeting),
    body_text: replace(raw.body_text),
    cta_text: replace(raw.cta_text),
    signoff: replace(raw.signoff),
  };
}

/**
 * Build branded email HTML using the same shell as the Email Template Gallery.
 */
export function buildBrandedEmailHtml(config: BrandedEmailConfig): { subject: string; html: string } {
  const resolved = resolveEmailStyle(config.styleConfig as any);
  const accent = resolved.accentColor || DEFAULT_STYLE.accentColor;
  const font = resolved.fontFamily || DEFAULT_STYLE.fontFamily;
  const btnRadius = resolved.buttonRadius || DEFAULT_STYLE.buttonRadius;
  const headingClr = resolved.headingColor || DEFAULT_STYLE.headingColor;
  const bodyClr = resolved.bodyColor || DEFAULT_STYLE.bodyColor;
  const fontSize = resolved.bodyFontSize || DEFAULT_STYLE.bodyFontSize;

  const template = resolveTemplate(config.templateId, config.templateOverrides, config.variables);

  const contactLine = [config.companyPhone, config.companyEmail].filter(Boolean).join(" · ");

  const logoLockup = config.logoUrl
    ? `<img src="${config.logoUrl}" alt="${config.companyName}" width="320" style="display:block;max-width:320px;max-height:64px;height:auto;border:0;outline:none;text-decoration:none;" />`
    : `<span style="font-size:18px;font-weight:700;color:${accent};font-family:${font};">${config.companyName}</span>`;

  const stripeColor = config.stripeColor || (config.templateId === "demand_letter" ? "#ef4444"
    : config.templateId === "checklist_followup" ? "#f59e0b"
    : accent);

  // Build greeting
  const greetingHtml = `<p style="margin:0 0 16px;font-size:${fontSize};color:${headingClr};line-height:1.6;">${template.greeting}</p>`;

  // Build body text
  const bodyHtml = `<p style="margin:0 0 24px;font-size:${fontSize};color:${bodyClr};line-height:1.6;">${template.body_text}</p>`;

  // Build CTA button
  const ctaHtml = template.cta_text && config.ctaLink
    ? `<div style="text-align:center;margin:32px 0;">
        <a href="${config.ctaLink}" style="display:inline-block;background:${accent};color:#1a1a2e;text-decoration:none;padding:14px 44px;border-radius:${btnRadius};font-size:16px;font-weight:700;letter-spacing:0.2px;">${template.cta_text}</a>
      </div>`
    : "";

  // Build signoff
  const signoffHtml = template.signoff
    ? `<p style="margin:24px 0 0;font-size:${fontSize};color:${bodyClr};line-height:1.6;">${template.signoff}</p>
       <p style="margin:16px 0 0;font-size:${fontSize};color:${headingClr};">Best regards,<br/><strong>${config.companyName}</strong></p>`
    : `<p style="margin:16px 0 0;font-size:${fontSize};color:${headingClr};">— ${config.companyName}</p>`;

  // Doc label in top-right
  const docRightHtml = config.docNumber
    ? `<td style="vertical-align:top;text-align:right;white-space:nowrap;width:30%;font-family:${font};">
        <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};font-weight:600;font-family:${font};">${config.docLabel}</p>
        <p style="margin:2px 0 0;font-size:20px;font-weight:800;color:${headingClr};letter-spacing:-0.3px;line-height:1;font-family:${font};">${config.docNumber}</p>
      </td>`
    : `<td style="vertical-align:top;text-align:right;width:30%;font-family:${font};">
        <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};font-weight:600;font-family:${font};">${config.docLabel}</p>
      </td>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CARD_BG};font-family:${font};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CARD_BG};margin:0;padding:0;font-family:${font};">
    <tr>
      <td align="center" style="padding:32px 16px;font-family:${font};">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;font-family:${font};">
          <tr>
            <td style="background:#ffffff;padding:28px 32px 0 32px;border:1px solid ${BORDER};border-bottom:none;border-radius:12px 12px 0 0;overflow:hidden;font-family:${font};">
              <table role="presentation" style="width:100%;table-layout:fixed;" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top;width:70%;padding-right:20px;font-family:${font};">
                    ${logoLockup}
                    ${config.companyAddress ? `<p style="margin:10px 0 0;color:${MUTED};font-size:11px;line-height:1.4;max-width:280px;font-family:${font};">${config.companyAddress}</p>` : ""}
                    ${contactLine ? `<p style="margin:4px 0 0;color:${MUTED};font-size:11px;line-height:1.4;max-width:280px;word-break:break-word;font-family:${font};">${contactLine}</p>` : ""}
                  </td>
                  ${docRightHtml}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:0 48px;">
              <div style="height:3px;line-height:3px;font-size:3px;background:${stripeColor};">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid ${BORDER};border-top:none;border-radius:0 0 12px 12px;font-family:${font};">
              ${greetingHtml}
              ${bodyHtml}
              ${config.innerBodyHtml || ""}
              ${ctaHtml}
              ${signoffHtml}
            </td>
          </tr>
          ${contactLine ? `<tr><td style="text-align:center;padding:16px;font-size:11px;color:${MUTED};font-family:${font};">${contactLine}</td></tr>` : ""}
        </table>
      </td>
    </tr>
  </table>
</body></html>`;

  return { subject: template.subject, html };
}

/** Helper to build an info card (used in inner body sections) */
export function infoCard(label: string, value: string, sub?: string, headingClr: string = HEADING) {
  return `<td style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px;padding:14px 18px;">
    <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${MUTED};font-weight:600;">${label}</p>
    <p style="margin:4px 0 0;font-size:14px;color:${headingClr};font-weight:600;">${value}</p>
    ${sub ? `<p style="margin:2px 0 0;font-size:12px;color:#64748b;">${sub}</p>` : ""}
  </td>`;
}
