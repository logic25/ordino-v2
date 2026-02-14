import { supabase } from "@/integrations/supabase/client";

interface SendBillingEmailParams {
  to: string;
  cc?: string;
  subject: string;
  htmlBody: string;
}

export async function sendBillingEmail({ to, cc, subject, htmlBody }: SendBillingEmailParams) {
  const { data, error } = await supabase.functions.invoke("gmail-send", {
    body: {
      to,
      cc: cc || undefined,
      subject,
      html_body: htmlBody,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Build a styled HTML wrapper for billing emails */
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

/** Build reminder email subject & HTML */
export function buildReminderEmail({
  invoiceNumber,
  totalDue,
  daysOverdue,
  clientName,
  companyName,
  customMessage,
  companyEmail,
  companyPhone,
}: {
  invoiceNumber: string;
  totalDue: number;
  daysOverdue: number;
  clientName: string;
  companyName: string;
  customMessage?: string;
  companyEmail?: string;
  companyPhone?: string;
}) {
  const amount = `$${totalDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const subject = `Payment Reminder — Invoice ${invoiceNumber} (${amount})`;

  const defaultBody = `Dear ${clientName},

This is a friendly reminder that payment of ${amount} for invoice ${invoiceNumber} is now ${daysOverdue} days past due.

We would appreciate your prompt attention to this matter. If payment has already been sent, please disregard this notice.

${customMessage ? `\n${customMessage}\n` : ""}
Thank you for your business.

Best regards,
${companyName}`;

  const footer = [
    companyEmail ? `Email: ${companyEmail}` : null,
    companyPhone ? `Phone: ${companyPhone}` : null,
  ].filter(Boolean).join(" | ");

  return {
    subject,
    htmlBody: wrapBillingEmailHtml({ companyName, body: defaultBody, footer }),
  };
}

/** Build demand letter email subject & HTML */
export function buildDemandLetterEmail({
  invoiceNumber,
  totalDue,
  daysOverdue,
  clientName,
  companyName,
  letterText,
  companyEmail,
  companyPhone,
}: {
  invoiceNumber: string;
  totalDue: number;
  daysOverdue: number;
  clientName: string;
  companyName: string;
  letterText: string;
  companyEmail?: string;
  companyPhone?: string;
}) {
  const amount = `$${totalDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const subject = `FORMAL DEMAND FOR PAYMENT — Invoice ${invoiceNumber} (${amount})`;

  const footer = [
    companyEmail ? `Email: ${companyEmail}` : null,
    companyPhone ? `Phone: ${companyPhone}` : null,
  ].filter(Boolean).join(" | ");

  return {
    subject,
    htmlBody: wrapBillingEmailHtml({ companyName, body: letterText, footer }),
  };
}
