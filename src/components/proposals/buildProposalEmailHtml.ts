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
}: ProposalEmailParams): string {
  const documentAccent = "hsl(65 69% 54%)";
  const documentAccentForeground = "hsl(220 20% 10%)";

  const serviceRows = items
    .filter(i => !i.isOptional)
    .map(i => `<tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">${i.name}</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:#1e293b;">${i.total}</td></tr>`)
    .join("");

  const optionalRows = items
    .filter(i => i.isOptional)
    .map(i => `<tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#94a3b8;font-style:italic;">${i.name} (optional)</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:#94a3b8;">${i.total}</td></tr>`)
    .join("");

  const contactLine = [companyPhone, companyEmail].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- White Header -->
    <div style="background:#ffffff;padding:28px 32px;border-radius:12px 12px 0 0;border:1px solid #e2e8f0;border-bottom:none;overflow:hidden;">
      <table style="width:100%;table-layout:fixed;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;width:70%;padding-right:20px;">
            ${logoUrl ? `<div style="max-width:320px;height:64px;overflow:hidden;"><img src="${logoUrl}" alt="${companyName}" style="display:block;max-width:100%;max-height:64px;width:auto;height:auto;object-fit:contain;object-position:left center;" /></div>` : `<span style="font-size:18px;font-weight:700;color:${documentAccent};">${companyName}</span>`}
            ${companyAddress ? `<p style="margin:10px 0 0;color:#94a3b8;font-size:11px;line-height:1.4;max-width:280px;">${companyAddress}</p>` : ""}
            ${contactLine ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:11px;line-height:1.4;max-width:280px;word-break:break-word;">${contactLine}</p>` : ""}
          </td>
          ${proposalNumber ? `<td style="vertical-align:top;text-align:right;white-space:nowrap;width:30%;">
            <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600;">Proposal</p>
            <p style="margin:2px 0 0;font-size:20px;font-weight:800;color:#1e293b;letter-spacing:-0.3px;line-height:1;">#${proposalNumber}</p>
          </td>` : ""}
        </tr>
      </table>
    </div>

    <!-- Green accent line -->
    <div style="height:3px;background:${documentAccent};margin:0 48px;"></div>

    <!-- Body Card -->
    <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">

      ${preparedFor ? `
      <table style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;">
            <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:600;">Prepared For</p>
            <p style="margin:4px 0 0;font-size:14px;color:#1e293b;font-weight:600;">${preparedFor}</p>
          </td>
          <td style="width:16px;"></td>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;">
            <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:600;">Project</p>
            <p style="margin:4px 0 0;font-size:14px;color:#1e293b;font-weight:600;">${proposalTitle}</p>
            ${propertyAddress ? `<p style="margin:2px 0 0;font-size:12px;color:#64748b;">${propertyAddress}</p>` : ""}
          </td>
        </tr>
      </table>
      ` : ""}

      <p style="margin:0 0 16px;font-size:15px;color:#1e293b;line-height:1.6;">Dear ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
        Thank you for the opportunity to work with you. We've prepared a proposal for your review.
      </p>

      <!-- Services Table -->
      <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.8px;font-weight:600;">Service</th>
              <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.8px;font-weight:600;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${serviceRows}
            ${optionalRows}
          </tbody>
        </table>
        <div style="border-top:1px solid #e2e8f0;padding:14px 16px;">
          <table style="width:100%;">
            <tr>
              <td style="font-size:15px;font-weight:700;color:#1e293b;">Total</td>
              <td style="font-size:18px;font-weight:800;color:#1e293b;text-align:right;">${totalAmount}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#94a3b8;padding-top:4px;">Retainer Due</td>
              <td style="font-size:14px;font-weight:600;color:#94a3b8;text-align:right;padding-top:4px;">${depositAmount}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${clientLink}" style="display:inline-block;background:${documentAccent};color:${documentAccentForeground};text-decoration:none;padding:14px 44px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.2px;">
          Review &amp; Sign Proposal
        </a>
      </div>

      <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;text-align:center;line-height:1.5;">
        The link above also includes a Project Information Sheet — please fill it out at your convenience so we can begin work on your behalf.
      </p>

      <p style="margin:24px 0 0;font-size:15px;color:#334155;line-height:1.6;">
        Please don't hesitate to reach out if you have any questions.
      </p>
      <p style="margin:16px 0 0;font-size:15px;color:#1e293b;">
        Best regards,<br/><strong>${companyName}</strong>
      </p>
    </div>

    <!-- Footer -->
    ${contactLine ? `<div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">${contactLine}</div>` : ""}
  </div>
</body>
</html>`;
}
