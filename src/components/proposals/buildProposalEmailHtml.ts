export interface ProposalEmailStyleConfig {
  accentColor?: string;
  accentForeground?: string;
  fontFamily?: string;
  buttonRadius?: string;
  bodyColor?: string;
  headingColor?: string;
  bodyFontSize?: string;
}

export interface ProposalEmailTemplateContent {
  subject?: string;
  greeting?: string;
  bodyText?: string;
  ctaText?: string;
  signoff?: string;
}

export interface ProposalEmailParams {
  clientName: string;
  proposalTitle: string;
  proposalNumber?: string;
  propertyAddress: string;
  preparedFor?: string;
  totalAmount: string;
  logoUrl?: string;
  companyAddress?: string;
  depositAmount: string;
  clientLink: string;
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  items: { name: string; total: string; isOptional: boolean }[];
  style?: ProposalEmailStyleConfig;
  greetingText?: string;
  bodyText?: string;
  ctaText?: string;
  signoffText?: string;
}

export const DEFAULT_PROPOSAL_EMAIL_TEMPLATE: Required<ProposalEmailTemplateContent> = {
  subject: "Proposal {{PROPOSAL_NUMBER}} · {{PROJECT_TITLE}}",
  greeting: "Dear {{CLIENT_NAME}},",
  bodyText:
    "We've put together a detailed scope and fee proposal for your project at {{PROPERTY_ADDRESS}}. Everything is outlined below — review the services, pricing, and terms, then sign electronically when you're ready.",
  ctaText: "Review & Sign Proposal",
  signoff:
    "Questions about scope or pricing? Reply to this email and we'll get back to you the same day.",
};

export const DEFAULT_PROPOSAL_EMAIL_STYLE: Required<ProposalEmailStyleConfig> = {
  accentColor: "#d7df23",
  accentForeground: "#1f2937",
  fontFamily: "Arial, Helvetica, sans-serif",
  buttonRadius: "8px",
  bodyColor: "#334155",
  headingColor: "#1e293b",
  bodyFontSize: "15px",
};

/**
 * Single source of truth for resolving email styles from company settings.
 * Every caller (gallery, send dialog, hooks, client page) MUST use this
 * so the rendered email is identical everywhere.
 */
export function resolveEmailStyle(
  savedStyle?: { accent_color?: string; font_family?: string; button_radius?: string; body_color?: string; heading_color?: string; body_font_size?: string } | null,
): ProposalEmailStyleConfig {
  return {
    accentColor: savedStyle?.accent_color || DEFAULT_PROPOSAL_EMAIL_STYLE.accentColor,
    accentForeground: DEFAULT_PROPOSAL_EMAIL_STYLE.accentForeground,
    fontFamily: savedStyle?.font_family || DEFAULT_PROPOSAL_EMAIL_STYLE.fontFamily,
    buttonRadius: savedStyle?.button_radius || DEFAULT_PROPOSAL_EMAIL_STYLE.buttonRadius,
    bodyColor: savedStyle?.body_color || DEFAULT_PROPOSAL_EMAIL_STYLE.bodyColor,
    headingColor: savedStyle?.heading_color || DEFAULT_PROPOSAL_EMAIL_STYLE.headingColor,
    bodyFontSize: savedStyle?.body_font_size || DEFAULT_PROPOSAL_EMAIL_STYLE.bodyFontSize,
  };
}

function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value),
    template,
  );
}

export function resolveProposalEmailTemplate(
  overrides: ProposalEmailTemplateContent | undefined,
  variables: Record<string, string>,
): Required<ProposalEmailTemplateContent> {
  const cleanOverrides = Object.fromEntries(
    Object.entries(overrides ?? {}).filter(([, value]) => value !== undefined),
  ) as ProposalEmailTemplateContent;

  const merged = {
    ...DEFAULT_PROPOSAL_EMAIL_TEMPLATE,
    ...cleanOverrides,
  };

  return {
    subject: replaceTemplateVariables(merged.subject, variables),
    greeting: replaceTemplateVariables(merged.greeting, variables),
    bodyText: replaceTemplateVariables(merged.bodyText, variables),
    ctaText: replaceTemplateVariables(merged.ctaText, variables),
    signoff: replaceTemplateVariables(merged.signoff, variables),
  };
}

export function buildProposalEmailHtml({
  clientName,
  proposalTitle,
  proposalNumber,
  propertyAddress,
  preparedFor,
  totalAmount,
  depositAmount,
  clientLink,
  companyName,
  companyEmail,
  companyPhone,
  logoUrl,
  companyAddress,
  items,
  style,
  greetingText,
  bodyText,
  ctaText,
  signoffText,
}: ProposalEmailParams): string {
  const resolvedStyle: Required<ProposalEmailStyleConfig> = {
    accentColor: style?.accentColor ?? DEFAULT_PROPOSAL_EMAIL_STYLE.accentColor,
    accentForeground: style?.accentForeground ?? DEFAULT_PROPOSAL_EMAIL_STYLE.accentForeground,
    fontFamily: style?.fontFamily ?? DEFAULT_PROPOSAL_EMAIL_STYLE.fontFamily,
    buttonRadius: style?.buttonRadius ?? DEFAULT_PROPOSAL_EMAIL_STYLE.buttonRadius,
    bodyColor: style?.bodyColor ?? DEFAULT_PROPOSAL_EMAIL_STYLE.bodyColor,
    headingColor: style?.headingColor ?? DEFAULT_PROPOSAL_EMAIL_STYLE.headingColor,
    bodyFontSize: style?.bodyFontSize ?? DEFAULT_PROPOSAL_EMAIL_STYLE.bodyFontSize,
  };

  const fallbackTemplate = resolveProposalEmailTemplate(undefined, {
    COMPANY_NAME: companyName,
    CLIENT_NAME: clientName,
    PROJECT_TITLE: proposalTitle,
    PROPERTY_ADDRESS: propertyAddress || "your project",
    PROPOSAL_NUMBER: proposalNumber ? `#${proposalNumber}` : "",
    AMOUNT: totalAmount,
  });

  const documentAccent = resolvedStyle.accentColor;
  const documentAccentForeground = resolvedStyle.accentForeground;
  const emailBodyColor = resolvedStyle.bodyColor;
  const emailHeadingColor = resolvedStyle.headingColor;
  const emailBodyFontSize = resolvedStyle.bodyFontSize;
  const resolvedGreeting = greetingText || fallbackTemplate.greeting;
  const resolvedBodyText = bodyText || fallbackTemplate.bodyText;
  const resolvedCtaText = ctaText || fallbackTemplate.ctaText;
  const resolvedSignoffText = signoffText || fallbackTemplate.signoff;

  const serviceRows = items
    .filter((item) => !item.isOptional)
    .map(
      (item) =>
        `<tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${emailHeadingColor};">${item.name}</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:${emailHeadingColor};">${item.total}</td></tr>`,
    )
    .join("");

  const optionalRows = items
    .filter((item) => item.isOptional)
    .map(
      (item) =>
        `<tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#94a3b8;font-style:italic;">${item.name} (optional)</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:#94a3b8;">${item.total}</td></tr>`,
    )
    .join("");

  const contactLine = [companyPhone, companyEmail].filter(Boolean).join(" · ");
  const ctaSection = resolvedCtaText
    ? `<div style="text-align:center;margin:32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr>
            <td align="center" bgcolor="${documentAccent}" style="background:${documentAccent};border-radius:${resolvedStyle.buttonRadius};">
              <a href="${clientLink}" style="display:inline-block;background:${documentAccent};color:${documentAccentForeground};text-decoration:none;padding:14px 44px;border-radius:${resolvedStyle.buttonRadius};font-size:16px;line-height:16px;font-weight:700;letter-spacing:0.2px;font-family:${resolvedStyle.fontFamily};">
                ${resolvedCtaText}
              </a>
            </td>
          </tr>
        </table>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;text-align:center;line-height:1.5;font-family:${resolvedStyle.fontFamily};">
        The link above also includes a Project Information Sheet — please fill it out at your convenience so we can begin work on your behalf.
      </p>`
    : "";

  const signoffSection = resolvedSignoffText
    ? `<p style="margin:24px 0 0;font-size:15px;color:#334155;line-height:1.6;">${resolvedSignoffText}</p>
       <p style="margin:16px 0 0;font-size:15px;color:#1e293b;">Best regards,<br/><strong>${companyName}</strong></p>`
    : `<p style="margin:16px 0 0;font-size:15px;color:#1e293b;">Best regards,<br/><strong>${companyName}</strong></p>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:${resolvedStyle.fontFamily};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;margin:0;padding:0;font-family:${resolvedStyle.fontFamily};">
    <tr>
      <td align="center" style="padding:32px 16px;font-family:${resolvedStyle.fontFamily};">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;font-family:${resolvedStyle.fontFamily};">
          <tr>
            <td style="background:#ffffff;padding:28px 32px 0 32px;border:1px solid #e2e8f0;border-bottom:none;border-radius:12px 12px 0 0;overflow:hidden;font-family:${resolvedStyle.fontFamily};">
              <table role="presentation" style="width:100%;table-layout:fixed;" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:top;width:70%;padding-right:20px;font-family:${resolvedStyle.fontFamily};">
                    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" width="320" style="display:block;max-width:320px;max-height:64px;height:auto;border:0;outline:none;text-decoration:none;" />` : `<span style="font-size:18px;font-weight:700;color:${documentAccent};font-family:${resolvedStyle.fontFamily};">${companyName}</span>`}
                    ${companyAddress ? `<p style="margin:10px 0 0;color:#94a3b8;font-size:11px;line-height:1.4;max-width:280px;font-family:${resolvedStyle.fontFamily};">${companyAddress}</p>` : ""}
                    ${contactLine ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:11px;line-height:1.4;max-width:280px;word-break:break-word;font-family:${resolvedStyle.fontFamily};">${contactLine}</p>` : ""}
                  </td>
                  ${proposalNumber ? `<td style="vertical-align:top;text-align:right;white-space:nowrap;width:30%;font-family:${resolvedStyle.fontFamily};">
                    <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600;font-family:${resolvedStyle.fontFamily};">Proposal</p>
                    <p style="margin:2px 0 0;font-size:20px;font-weight:800;color:#1e293b;letter-spacing:-0.3px;line-height:1;font-family:${resolvedStyle.fontFamily};">#${proposalNumber}</p>
                  </td>` : ""}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:0 48px;">
              <div style="height:3px;line-height:3px;font-size:3px;background:${documentAccent};">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;font-family:${resolvedStyle.fontFamily};">
              ${preparedFor ? `
              <table role="presentation" style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;font-family:${resolvedStyle.fontFamily};">
                    <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:600;font-family:${resolvedStyle.fontFamily};">Prepared For</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;font-weight:600;font-family:${resolvedStyle.fontFamily};">${preparedFor}</p>
                  </td>
                  <td style="width:16px;">&nbsp;</td>
                  <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;font-family:${resolvedStyle.fontFamily};">
                    <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:600;font-family:${resolvedStyle.fontFamily};">Project</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#1e293b;font-weight:600;font-family:${resolvedStyle.fontFamily};">${proposalTitle}</p>
                    ${propertyAddress ? `<p style="margin:2px 0 0;font-size:12px;color:#64748b;font-family:${resolvedStyle.fontFamily};">${propertyAddress}</p>` : ""}
                  </td>
                </tr>
              </table>
              ` : ""}

              <p style="margin:0 0 16px;font-size:${emailBodyFontSize};color:${emailHeadingColor};line-height:1.6;font-family:${resolvedStyle.fontFamily};">${resolvedGreeting}</p>
              <p style="margin:0 0 24px;font-size:${emailBodyFontSize};color:${emailBodyColor};line-height:1.6;font-family:${resolvedStyle.fontFamily};">
                ${resolvedBodyText}
              </p>

              <table role="presentation" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;border-collapse:separate;" cellpadding="0" cellspacing="0" border="0">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.8px;font-weight:600;font-family:${resolvedStyle.fontFamily};">Service</th>
                    <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.8px;font-weight:600;font-family:${resolvedStyle.fontFamily};">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${serviceRows}
                  ${optionalRows}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="2" style="border-top:1px solid #e2e8f0;padding:14px 16px;font-family:${resolvedStyle.fontFamily};">
                      <table role="presentation" style="width:100%;" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                         <td style="font-size:15px;font-weight:700;color:${emailHeadingColor};font-family:${resolvedStyle.fontFamily};">Total</td>
                          <td style="font-size:18px;font-weight:800;color:${emailHeadingColor};text-align:right;font-family:${resolvedStyle.fontFamily};">${totalAmount}</td>
                        </tr>
                        <tr>
                          <td style="font-size:13px;color:#94a3b8;padding-top:4px;font-family:${resolvedStyle.fontFamily};">Retainer Due</td>
                          <td style="font-size:14px;font-weight:600;color:#94a3b8;text-align:right;padding-top:4px;font-family:${resolvedStyle.fontFamily};">${depositAmount}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </tfoot>
              </table>

              ${ctaSection}
              ${signoffSection}
            </td>
          </tr>
          ${contactLine ? `<tr><td style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;font-family:${resolvedStyle.fontFamily};">${contactLine}</td></tr>` : ""}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
