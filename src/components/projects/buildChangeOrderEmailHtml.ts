import { resolveEmailStyle, type ProposalEmailStyleConfig, DEFAULT_PROPOSAL_EMAIL_STYLE } from "@/components/proposals/buildProposalEmailHtml";

export { resolveEmailStyle };

export interface ChangeOrderEmailTemplateContent {
  subject?: string;
  greeting?: string;
  body_text?: string;
  cta_text?: string;
  signoff?: string;
}

const CO_DEFAULTS: Required<ChangeOrderEmailTemplateContent> = {
  subject: "Change Order {{CO_NUMBER}} — {{PROJECT_TITLE}}",
  greeting: "Hi {{CLIENT_NAME}},",
  body_text: "There's been a scope change on your project at {{PROPERTY_ADDRESS}}. We've documented the additional work and updated pricing below. Please review and sign to keep things moving.",
  cta_text: "Review & Sign",
  signoff: "If you have questions about this change, just reply to this email or call us directly.",
};

export function resolveChangeOrderEmailTemplate(
  overrides: ChangeOrderEmailTemplateContent | undefined,
  variables: Record<string, string>,
): Required<ChangeOrderEmailTemplateContent> {
  const raw: Required<ChangeOrderEmailTemplateContent> = {
    subject: overrides?.subject || CO_DEFAULTS.subject,
    greeting: overrides?.greeting || CO_DEFAULTS.greeting,
    body_text: overrides?.body_text || CO_DEFAULTS.body_text,
    cta_text: overrides?.cta_text || CO_DEFAULTS.cta_text,
    signoff: overrides?.signoff || CO_DEFAULTS.signoff,
  };

  const replace = (text: string) =>
    Object.entries(variables).reduce(
      (t, [k, v]) => t.replaceAll(`{{${k}}}`, v),
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

export interface ChangeOrderEmailParams {
  contactName: string;
  coNumber: string;
  coTitle: string;
  amount: string;
  description?: string;
  signingLink?: string | null;
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  logoUrl?: string;
  projectAddress?: string;
  depositPercentage?: number;
  depositAmount?: string;
  style?: ProposalEmailStyleConfig;
  template?: ChangeOrderEmailTemplateContent;
}

export function buildChangeOrderEmailHtml({
  contactName,
  coNumber,
  coTitle,
  amount,
  description,
  signingLink,
  companyName,
  companyEmail,
  companyPhone,
  companyAddress,
  logoUrl,
  projectAddress,
  depositPercentage,
  depositAmount,
  style,
  template,
}: ChangeOrderEmailParams): string {
  const s: Required<ProposalEmailStyleConfig> = {
    accentColor: style?.accentColor ?? DEFAULT_PROPOSAL_EMAIL_STYLE.accentColor,
    accentTextColor: style?.accentTextColor ?? style?.accentColor ?? DEFAULT_PROPOSAL_EMAIL_STYLE.accentTextColor,
    accentForeground: style?.accentForeground ?? DEFAULT_PROPOSAL_EMAIL_STYLE.accentForeground,
    fontFamily: style?.fontFamily ?? DEFAULT_PROPOSAL_EMAIL_STYLE.fontFamily,
    buttonRadius: style?.buttonRadius ?? DEFAULT_PROPOSAL_EMAIL_STYLE.buttonRadius,
    bodyColor: style?.bodyColor ?? DEFAULT_PROPOSAL_EMAIL_STYLE.bodyColor,
    headingColor: style?.headingColor ?? DEFAULT_PROPOSAL_EMAIL_STYLE.headingColor,
    bodyFontSize: style?.bodyFontSize ?? DEFAULT_PROPOSAL_EMAIL_STYLE.bodyFontSize,
  };

  const resolved = resolveChangeOrderEmailTemplate(template, {
    CLIENT_NAME: contactName,
    COMPANY_NAME: companyName,
    CO_NUMBER: coNumber,
    PROJECT_TITLE: coTitle,
    PROPERTY_ADDRESS: projectAddress || "your project",
    AMOUNT: amount,
  });

  const contactLine = [companyPhone, companyEmail].filter(Boolean).join(" · ");

  const detailRows = [
    `<tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:600;width:120px;font-family:${s.fontFamily};">Title</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${s.headingColor};font-family:${s.fontFamily};">${coTitle}</td></tr>`,
    `<tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:600;font-family:${s.fontFamily};">Amount</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;color:${s.headingColor};font-family:${s.fontFamily};">${amount}</td></tr>`,
    description ? `<tr><td style="padding:10px 16px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:600;font-family:${s.fontFamily};">Services</td><td style="padding:10px 16px;font-size:14px;color:${s.headingColor};font-family:${s.fontFamily};">${description}</td></tr>` : "",
  ].filter(Boolean).join("");

  const depositRow = depositPercentage && depositPercentage > 0 && depositAmount
    ? `<tr><td colspan="2" style="padding:14px 16px;border-top:1px solid #e2e8f0;font-family:${s.fontFamily};">
         <table role="presentation" style="width:100%;" cellpadding="0" cellspacing="0" border="0">
           <tr>
             <td style="font-size:13px;color:#94a3b8;font-family:${s.fontFamily};">Deposit Due (${depositPercentage}%)</td>
             <td style="font-size:14px;font-weight:600;color:#94a3b8;text-align:right;font-family:${s.fontFamily};">${depositAmount}</td>
           </tr>
         </table>
       </td></tr>`
    : "";

  const ctaSection = signingLink
    ? `<div style="text-align:center;margin:32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr>
            <td align="center" bgcolor="${s.accentColor}" style="background:${s.accentColor};border-radius:${s.buttonRadius};">
              <a href="${signingLink}" style="display:inline-block;background:${s.accentColor};color:${s.accentForeground};text-decoration:none;padding:14px 44px;border-radius:${s.buttonRadius};font-size:16px;line-height:16px;font-weight:700;letter-spacing:0.2px;font-family:${s.fontFamily};">
                ${resolved.cta_text}
              </a>
            </td>
          </tr>
        </table>
      </div>`
    : "";

  const signoffHtml = resolved.signoff
    ? `<p style="margin:16px 0 0;font-size:${s.bodyFontSize};color:${s.bodyColor};line-height:1.6;font-family:${s.fontFamily};">${resolved.signoff}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:${s.fontFamily};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;margin:0;padding:0;font-family:${s.fontFamily};">
    <tr>
      <td align="center" style="padding:32px 16px;font-family:${s.fontFamily};">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;font-family:${s.fontFamily};">
          <tr>
            <td style="background:#ffffff;padding:28px 32px 0 32px;border:1px solid #e2e8f0;border-bottom:none;border-radius:12px 12px 0 0;overflow:hidden;font-family:${s.fontFamily};">
              <table role="presentation" style="width:100%;table-layout:fixed;" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top;width:70%;padding-right:20px;font-family:${s.fontFamily};">
                    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" width="320" style="display:block;max-width:320px;max-height:64px;height:auto;border:0;outline:none;text-decoration:none;" />` : `<span style="font-size:18px;font-weight:700;color:${s.accentColor};font-family:${s.fontFamily};">${companyName}</span>`}
                    ${companyAddress ? `<p style="margin:10px 0 0;color:#94a3b8;font-size:11px;line-height:1.4;max-width:280px;font-family:${s.fontFamily};">${companyAddress}</p>` : ""}
                    ${contactLine ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:11px;line-height:1.4;max-width:280px;word-break:break-word;font-family:${s.fontFamily};">${contactLine}</p>` : ""}
                  </td>
                  <td style="vertical-align:top;text-align:right;white-space:nowrap;width:30%;font-family:${s.fontFamily};">
                    <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600;font-family:${s.fontFamily};">Change Order</p>
                    <p style="margin:2px 0 0;font-size:20px;font-weight:800;color:#1e293b;letter-spacing:-0.3px;line-height:1;font-family:${s.fontFamily};">${coNumber}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:0 48px;">
              <div style="height:3px;line-height:3px;font-size:3px;background:${s.accentColor};">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;font-family:${s.fontFamily};">
              
              <table role="presentation" style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;font-family:${s.fontFamily};">
                    <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:600;font-family:${s.fontFamily};">Client</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;font-weight:600;font-family:${s.fontFamily};">${contactName}</p>
                  </td>
                  <td style="width:16px;">&nbsp;</td>
                  <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;font-family:${s.fontFamily};">
                    <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:600;font-family:${s.fontFamily};">Project</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;font-weight:600;font-family:${s.fontFamily};">${coTitle}</p>
                    ${projectAddress ? `<p style="margin:2px 0 0;font-size:12px;color:#64748b;font-family:${s.fontFamily};">${projectAddress}</p>` : ""}
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-size:${s.bodyFontSize};color:${s.headingColor};line-height:1.6;font-family:${s.fontFamily};">${resolved.greeting}</p>
              <p style="margin:0 0 24px;font-size:${s.bodyFontSize};color:${s.bodyColor};line-height:1.6;font-family:${s.fontFamily};">
                ${resolved.body_text}
              </p>

              <table role="presentation" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;border-collapse:separate;" cellpadding="0" cellspacing="0" border="0">
                <tbody>
                  ${detailRows}
                </tbody>
                ${depositRow}
              </table>

              ${ctaSection}
              ${signoffHtml}

              <p style="margin:24px 0 0;font-size:${s.bodyFontSize};color:${s.headingColor};font-family:${s.fontFamily};">Thank you,<br/><strong>${companyName}</strong></p>
            </td>
          </tr>
          ${contactLine ? `<tr><td style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;font-family:${s.fontFamily};">${contactLine}</td></tr>` : ""}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
