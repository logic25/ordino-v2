import { supabase } from "@/integrations/supabase/client";
import { buildBrandedEmailHtml, type TemplateOverride } from "@/lib/buildBrandedEmailHtml";

export interface BillingEmailAttachment {
  filename: string;
  /** Base64-encoded file contents (no data: prefix). */
  content: string;
  mime_type: string;
}

interface SendBillingEmailParams {
  to: string;
  cc?: string;
  subject: string;
  htmlBody: string;
  projectId?: string;
  proposalId?: string;
  changeOrderId?: string;
  invoiceId?: string;
  tagCategory?: string;
  attachments?: BillingEmailAttachment[];
}

export async function sendBillingEmail({
  to, cc, subject, htmlBody,
  projectId, proposalId, changeOrderId, invoiceId,
  tagCategory = "client",
  attachments,
}: SendBillingEmailParams) {
  const { data, error } = await supabase.functions.invoke("gmail-send", {
    body: {
      to,
      cc: cc || undefined,
      subject,
      html_body: htmlBody,
      project_id: projectId,
      proposal_id: proposalId,
      change_order_id: changeOrderId,
      invoice_id: invoiceId,
      tag_category: tagCategory,
      attachments: attachments && attachments.length ? attachments : undefined,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/** @deprecated — kept for backward compat; prefer buildBrandedEmailHtml */
export function wrapBillingEmailHtml({
  companyName,
  body,
  footer,
}: {
  companyName?: string;
  body: string;
  footer?: string;
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 640px; margin: 0 auto; padding: 20px;">
  ${companyName ? `<div style="font-size: 18px; font-weight: bold; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #333;">${companyName}</div>` : ""}
  <div style="white-space: pre-wrap;">${body}</div>
  ${footer ? `<div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 12px; color: #888;">${footer}</div>` : ""}
</body>
</html>`.trim();
}

/** Build branded reminder email using gallery template */
export function buildReminderEmail({
  invoiceNumber,
  totalDue,
  daysOverdue,
  clientName,
  companyName,
  customMessage,
  companyEmail,
  companyPhone,
  companyAddress,
  logoUrl,
  styleConfig,
  templateOverrides,
}: {
  invoiceNumber: string;
  totalDue: number;
  daysOverdue: number;
  clientName: string;
  companyName: string;
  customMessage?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  logoUrl?: string;
  styleConfig?: any;
  templateOverrides?: TemplateOverride;
}) {
  const amount = `$${totalDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const innerBodyHtml = `
    <table style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0"><tr>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;">
        <table style="width:100%;"><tr>
          <td style="text-align:center;">
            <p style="margin:0;font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:600;letter-spacing:0.8px;">Amount Due</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#1e293b;">${amount}</p>
          </td>
          <td style="text-align:center;">
            <p style="margin:0;font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:600;letter-spacing:0.8px;">Days Overdue</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#dc2626;">${daysOverdue}</p>
          </td>
        </tr></table>
      </td>
    </tr></table>
    ${customMessage ? `<p style="margin:0 0 24px;font-size:14px;color:#334155;line-height:1.6;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">${customMessage}</p>` : ""}`;

  const { subject, html: htmlBody } = buildBrandedEmailHtml({
    templateId: "reminder",
    templateOverrides,
    styleConfig,
    companyName,
    companyEmail,
    companyPhone,
    companyAddress,
    logoUrl,
    docLabel: "Payment Reminder",
    docNumber: invoiceNumber,
    variables: {
      CLIENT_NAME: clientName,
      INVOICE_NUMBER: invoiceNumber,
      AMOUNT: amount,
      DAYS_OVERDUE: String(daysOverdue),
    },
    innerBodyHtml,
  });

  return { subject, htmlBody };
}

/** Build branded demand letter email using gallery template */
export function buildDemandLetterEmail({
  invoiceNumber,
  totalDue,
  daysOverdue,
  clientName,
  companyName,
  letterText,
  companyEmail,
  companyPhone,
  companyAddress,
  logoUrl,
  styleConfig,
  templateOverrides,
}: {
  invoiceNumber: string;
  totalDue: number;
  daysOverdue: number;
  clientName: string;
  companyName: string;
  letterText: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  logoUrl?: string;
  styleConfig?: any;
  templateOverrides?: TemplateOverride;
}) {
  const amount = `$${totalDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  // For demand letters, the letterText IS the body — override the body_text
  const merged: TemplateOverride = {
    ...templateOverrides,
    body_text: letterText,
  };

  const { subject, html: htmlBody } = buildBrandedEmailHtml({
    templateId: "demand_letter",
    templateOverrides: merged,
    styleConfig,
    companyName,
    companyEmail,
    companyPhone,
    companyAddress,
    logoUrl,
    docLabel: "Formal Demand",
    docNumber: invoiceNumber,
    stripeColor: "#ef4444",
    variables: {
      CLIENT_NAME: clientName,
      INVOICE_NUMBER: invoiceNumber,
      AMOUNT: amount,
      DAYS_OVERDUE: String(daysOverdue),
    },
  });

  return { subject, htmlBody };
}
