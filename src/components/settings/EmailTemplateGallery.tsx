import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Eye, ExternalLink } from "lucide-react";
import { useCompanySettings } from "@/hooks/useCompanySettings";

// --- Sample data for previews ---
const SAMPLE = {
  companyName: "Green Light Expediting",
  companyEmail: "info@greenlightexp.com",
  companyPhone: "(212) 555-1234",
  companyAddress: "123 Broadway, New York, NY 10001",
  clientName: "John Smith",
  projectTitle: "Alt-1 Interior Renovation",
  propertyAddress: "456 Park Avenue, New York, NY",
  proposalNumber: "031926-1",
  coNumber: "CO#1",
  invoiceNumber: "INV-00042",
  pmName: "Sarah Johnson",
  pmEmail: "sarah@greenlightexp.com",
  pmPhone: "(212) 555-5678",
};

function buildSampleProposalEmail(logoUrl?: string | null) {
  const accent = "hsl(65 69% 54%)";
  const accentFg = "hsl(220 20% 10%)";
  const contactLine = `${SAMPLE.companyPhone} · ${SAMPLE.companyEmail}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;padding:28px 32px;border-radius:12px 12px 0 0;border:1px solid #e2e8f0;border-bottom:none;">
      <table style="width:100%;" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top;">
          ${logoUrl ? `<img src="${logoUrl}" alt="${SAMPLE.companyName}" style="max-height:44px;display:block;" />` : `<span style="font-size:18px;font-weight:700;color:${accent};">${SAMPLE.companyName}</span>`}
          <p style="margin:6px 0 0;color:#94a3b8;font-size:11px;">${SAMPLE.companyAddress}</p>
          <p style="margin:2px 0 0;color:#94a3b8;font-size:11px;">${contactLine}</p>
        </td>
        <td style="vertical-align:top;text-align:right;white-space:nowrap;width:140px;">
          <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600;">Proposal</p>
          <p style="margin:2px 0 0;font-size:20px;font-weight:800;color:#1e293b;letter-spacing:-0.3px;line-height:1;">#${SAMPLE.proposalNumber}</p>
        </td>
      </tr></table>
    </div>
    <div style="height:3px;background:${accent};"></div>
    <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
      <table style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;">
          <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:600;">Prepared For</p>
          <p style="margin:4px 0 0;font-size:14px;color:#1e293b;font-weight:600;">${SAMPLE.clientName}</p>
        </td>
        <td style="width:16px;"></td>
        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;">
          <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;font-weight:600;">Project</p>
          <p style="margin:4px 0 0;font-size:14px;color:#1e293b;font-weight:600;">${SAMPLE.projectTitle}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#64748b;">${SAMPLE.propertyAddress}</p>
        </td>
      </tr></table>
      <p style="margin:0 0 16px;font-size:15px;color:#1e293b;line-height:1.6;">Dear John,</p>
      <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">Thank you for the opportunity to work with you. We've prepared a proposal for your review.</p>
      <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f8fafc;">
            <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.8px;font-weight:600;">Service</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:0.8px;font-weight:600;">Amount</th>
          </tr></thead>
          <tbody>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">DOB Filing &amp; Expediting</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:#1e293b;">$3,500</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">Architectural Plans</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:#1e293b;">$2,800</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#94a3b8;font-style:italic;">Energy Code (optional)</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:#94a3b8;">$950</td></tr>
          </tbody>
        </table>
        <div style="border-top:2px solid #e2e8f0;padding:14px 16px;">
          <table style="width:100%;"><tr><td style="font-size:15px;font-weight:700;color:#1e293b;">Total</td><td style="font-size:18px;font-weight:800;color:#1e293b;text-align:right;">$6,300</td></tr>
          <tr><td style="font-size:13px;color:#94a3b8;padding-top:4px;">Retainer Due</td><td style="font-size:14px;font-weight:600;color:#94a3b8;text-align:right;padding-top:4px;">$3,150</td></tr></table>
        </div>
      </div>
      <div style="text-align:center;margin:32px 0;">
        <a href="#" style="display:inline-block;background:${accent};color:${accentFg};text-decoration:none;padding:14px 44px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.2px;">Review &amp; Sign Proposal</a>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;text-align:center;line-height:1.5;">The link above also includes a Project Information Sheet — please fill it out at your convenience so we can begin work on your behalf.</p>
      <p style="margin:24px 0 0;font-size:15px;color:#334155;line-height:1.6;">Please don't hesitate to reach out if you have any questions.</p>
      <p style="margin:16px 0 0;font-size:15px;color:#1e293b;">Best regards,<br/><strong>${SAMPLE.companyName}</strong></p>
    </div>
    <div style="text-align:center;padding:16px;font-size:11px;color:#94a3b8;">${contactLine}</div>
  </div>
</body></html>`;
}

function buildSampleChangeOrderEmail(logoUrl?: string | null) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;">
      <div style="background:#1c2127;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
        ${logoUrl ? `<img src="${logoUrl}" alt="" style="max-height:36px;margin-bottom:10px;display:block;" />` : ""}
        <h1 style="margin:0;font-size:18px;font-weight:800;letter-spacing:0.5px;">CHANGE ORDER</h1>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.8;">${SAMPLE.coNumber} · ${SAMPLE.propertyAddress}</p>
      </div>
      <div style="padding:24px;background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        <p style="margin:0 0 16px;">Hi ${SAMPLE.clientName},</p>
        <p style="margin:0 0 16px;">${SAMPLE.companyName} has issued <strong>Change Order ${SAMPLE.coNumber}</strong> for ${SAMPLE.propertyAddress}.</p>
        <table style="margin:0 0 16px;border-collapse:collapse;width:100%;">
          <tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#64748b;font-size:13px;">Title:</td><td style="padding:6px 0;font-size:13px;">Additional Asbestos Abatement</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#64748b;font-size:13px;">Amount:</td><td style="padding:6px 0;font-size:13px;font-weight:700;">$4,200</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#64748b;font-size:13px;">Services:</td><td style="padding:6px 0;font-size:13px;">Asbestos abatement monitoring for additional area</td></tr>
          <tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#64748b;font-size:13px;">Reason:</td><td style="padding:6px 0;font-size:13px;">Expanded scope after testing</td></tr>
        </table>
        <div style="text-align:center;margin:20px 0;">
          <a href="#" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;">Review &amp; Sign</a>
        </div>
        <p style="margin:16px 0 0;">Thank you,<br/>${SAMPLE.companyName}</p>
      </div>
    </div>
  </div>
</body></html>`;
}

function buildSampleWelcomeEmail(logoUrl?: string | null) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#1e293b;padding:24px 32px;border-radius:12px 12px 0 0;">
      ${logoUrl ? `<img src="${logoUrl}" alt="${SAMPLE.companyName}" style="max-height:40px;max-width:180px;margin-bottom:12px;display:block;" />` : ""}
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${SAMPLE.companyName}</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Welcome to Your Project</p>
    </div>
    <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px;font-size:15px;color:#1e293b;line-height:1.6;">Hi ${SAMPLE.clientName},</p>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">Thank you for choosing <strong>${SAMPLE.companyName}</strong>. We're excited to get started on <strong>${SAMPLE.projectTitle}</strong> at <strong>${SAMPLE.propertyAddress}</strong>.</p>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6;">📎 A copy of your fully executed proposal is attached to this email for your records.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;font-weight:600;">Your Project Manager</p>
        <p style="margin:0;font-size:16px;font-weight:700;color:#1e293b;">${SAMPLE.pmName}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#334155;"><a href="#" style="color:#2563eb;text-decoration:none;">${SAMPLE.pmEmail}</a></p>
        <p style="margin:4px 0 0;font-size:14px;color:#334155;">${SAMPLE.pmPhone}</p>
      </div>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">To get started, please fill out the attached Project Information Sheet. If you have any questions, don't hesitate to reach out.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="#" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.3px;">Fill Out Project Information Sheet</a>
      </div>
      <p style="margin:24px 0 0;font-size:15px;color:#1e293b;">Best regards,<br/><strong>${SAMPLE.companyName}</strong></p>
    </div>
    <div style="text-align:center;padding:16px;font-size:12px;"><a href="#" style="color:#64748b;">${SAMPLE.companyEmail}</a> &nbsp;|&nbsp; <span style="color:#64748b;">${SAMPLE.companyPhone}</span></div>
  </div>
</body></html>`;
}

function buildSampleInvoiceEmail() {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.6;max-width:640px;margin:0 auto;padding:20px;">
  <div style="font-size:18px;font-weight:bold;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #333;">${SAMPLE.companyName}</div>
  <div style="white-space:pre-wrap;">Dear ${SAMPLE.clientName},

Please find attached invoice ${SAMPLE.invoiceNumber} for $8,500.00.

Payment terms: Net 30
Due date: April 18, 2026

Thank you for your business.

Best regards,
${SAMPLE.companyName}</div>
  <div style="margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:12px;color:#888;">Email: ${SAMPLE.companyEmail} | Phone: ${SAMPLE.companyPhone}</div>
</body></html>`;
}

function buildSampleReminderEmail() {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.6;max-width:640px;margin:0 auto;padding:20px;">
  <div style="font-size:18px;font-weight:bold;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #333;">${SAMPLE.companyName}</div>
  <div style="white-space:pre-wrap;">Dear ${SAMPLE.clientName},

This is a friendly reminder that payment of $8,500.00 for invoice ${SAMPLE.invoiceNumber} is now 15 days past due.

We would appreciate your prompt attention to this matter. If payment has already been sent, please disregard this notice.

Thank you for your business.

Best regards,
${SAMPLE.companyName}</div>
  <div style="margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:12px;color:#888;">Email: ${SAMPLE.companyEmail} | Phone: ${SAMPLE.companyPhone}</div>
</body></html>`;
}

function buildSampleBillingDigest() {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.6;max-width:640px;margin:0 auto;padding:20px;">
  <p>Hello Sarah,</p>
  <p>Here's your weekly billing summary (Mar 12 – Mar 19):</p>
  <p><strong>Total billed: $24,500.00 across 4 billing requests</strong></p>
  <div style="margin:16px 0;">
    <p style="font-weight:bold;margin-top:12px;">2026-0012 – Park Ave Renovation</p>
    <p style="margin-left:16px;">DOB Filing — $3,500.00 — Mar 14</p>
    <p style="margin-left:16px;">Architectural Plans — $5,200.00 — Mar 15</p>
    <p style="font-weight:bold;margin-top:12px;">2026-0018 – Broadway Office</p>
    <p style="margin-left:16px;">Expediting Services — $8,400.00 — Mar 16</p>
    <p style="margin-left:16px;">Environmental Testing — $7,400.00 — Mar 17</p>
  </div>
  <p>Thanks,<br/>${SAMPLE.companyName}</p>
</body></html>`;
}

function buildSamplePartnerOutreach(logoUrl?: string | null) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;background:#ffffff;border-radius:8px;overflow:hidden;">
${logoUrl ? `<tr><td style="padding:24px 32px 0 32px;"><img src="${logoUrl}" alt="Company Logo" style="max-height:48px;" /></td></tr>` : ""}
<tr><td style="padding:24px 32px 32px 32px;font-size:14px;line-height:1.7;color:#333;">
<p>We'd like to offer our firm's inspection and filing support for this upcoming LL11/FISP requirement. Our team has extensive experience with facade compliance and DOB filings.</p>
<p><strong>RFP Details</strong></p>
<p><strong>Title:</strong> Facade Inspection &amp; Safety Program — 123 Main St</p>
<p><strong>Agency:</strong> NYC Department of Buildings</p>
<p><strong>Due Date:</strong> April 15, 2026</p>
<p><strong>Est. Value:</strong> $85,000</p>
<p>Please let us know if you'd like to collaborate:</p>
<p><a href="#"><strong>I'm Interested</strong></a> &nbsp; | &nbsp; <a href="#">Pass</a></p>
<p><strong>Our Services</strong></p>
<ul><li>Facade Inspection — LL11/FISP compliance inspections</li><li>DOB Filing — Application preparation and submission</li><li>Expediting — Permit and approval tracking</li></ul>
<p>${SAMPLE.companyName}<br/>${SAMPLE.companyPhone} | ${SAMPLE.companyEmail} | greenlightexp.com</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  category: "client" | "internal" | "partner";
  buildHtml: (logoUrl?: string | null) => string;
}

const TEMPLATES: TemplateEntry[] = [
  { id: "proposal", name: "Proposal Delivery", description: "Sent when a proposal is emailed to a client for review & signing", category: "client", buildHtml: buildSampleProposalEmail },
  { id: "change_order", name: "Change Order", description: "Sent when a CO is emailed to a client for signing", category: "client", buildHtml: buildSampleChangeOrderEmail },
  { id: "welcome", name: "Welcome / Onboarding", description: "Sent after a proposal is executed — introduces the PM and PIS link", category: "client", buildHtml: buildSampleWelcomeEmail },
  { id: "invoice", name: "Invoice Delivery", description: "Sent when an invoice is emailed to a client", category: "client", buildHtml: buildSampleInvoiceEmail },
  { id: "reminder", name: "Payment Reminder", description: "Sent for overdue invoices from the collections view", category: "client", buildHtml: buildSampleReminderEmail },
  { id: "billing_digest", name: "Billing Digest", description: "Weekly/daily billing summary sent to internal users", category: "internal", buildHtml: buildSampleBillingDigest },
  { id: "partner_outreach", name: "Partner / RFP Outreach", description: "Sent to potential partners for RFP collaboration", category: "partner", buildHtml: buildSamplePartnerOutreach },
];

const categoryLabels: Record<string, string> = {
  client: "Client-Facing",
  internal: "Internal",
  partner: "Partner",
};

const categoryColors: Record<string, string> = {
  client: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  internal: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  partner: "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

export function EmailTemplateGallery() {
  const { data: company } = useCompanySettings();
  const logoUrl = (company as any)?.logo_url || (company as any)?.settings?.company_logo_url || null;

  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewTemplate = TEMPLATES.find(t => t.id === previewId);
  const previewHtml = useMemo(() => previewTemplate?.buildHtml(logoUrl) || "", [previewId, logoUrl]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> Email Template Gallery
        </CardTitle>
        <CardDescription>
          Preview all branded email templates your system sends. Click any template to see a full-size preview.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {TEMPLATES.map((t) => {
            const html = t.buildHtml(logoUrl);
            return (
              <button
                key={t.id}
                onClick={() => setPreviewId(t.id)}
                className="text-left group rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all overflow-hidden"
              >
                {/* Thumbnail */}
                <div className="relative h-[200px] overflow-hidden bg-muted/30 border-b border-border">
                  <iframe
                    srcDoc={html}
                    title={t.name}
                    className="w-[600px] h-[800px] origin-top-left pointer-events-none"
                    style={{ transform: "scale(0.38)", transformOrigin: "top left" }}
                    sandbox=""
                    tabIndex={-1}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-card/60" />
                  <div className="absolute top-2 right-2">
                    <Badge variant="outline" className={`text-[10px] ${categoryColors[t.category]}`}>
                      {categoryLabels[t.category]}
                    </Badge>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                    <div className="bg-background/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-1.5 text-sm font-medium shadow-lg">
                      <Eye className="h-4 w-4" /> Preview
                    </div>
                  </div>
                </div>
                {/* Info */}
                <div className="p-3">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Full-size preview dialog */}
        <Dialog open={!!previewId} onOpenChange={(open) => !open && setPreviewId(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
              <DialogTitle className="flex items-center gap-3">
                <Mail className="h-5 w-5" />
                {previewTemplate?.name}
                <Badge variant="outline" className={`text-[10px] ml-auto ${categoryColors[previewTemplate?.category || "client"]}`}>
                  {categoryLabels[previewTemplate?.category || "client"]}
                </Badge>
              </DialogTitle>
              <p className="text-xs text-muted-foreground">{previewTemplate?.description}</p>
            </DialogHeader>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4">
                <div className="border border-border rounded-lg overflow-hidden bg-white">
                  <iframe
                    srcDoc={previewHtml}
                    title={previewTemplate?.name || ""}
                    className="w-full border-0"
                    style={{ height: "700px" }}
                    sandbox=""
                  />
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
