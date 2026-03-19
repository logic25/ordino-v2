import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Eye } from "lucide-react";
import { useCompanySettings } from "@/hooks/useCompanySettings";

/** Company info resolved from settings — used in every template */
interface CoInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  logoUrl: string | null;
}

/** Fake client / project data used as sample placeholders */
const SAMPLE = {
  clientName: "John Smith",
  projectTitle: "Alt-1 Interior Renovation",
  propertyAddress: "456 Park Avenue, New York, NY",
  proposalNumber: "031926-1",
  coNumber: "CO#1",
  invoiceNumber: "INV-00042",
  pmName: "Sarah Johnson",
  pmEmail: "sarah@company.com",
  pmPhone: "(555) 555-5678",
};

// ── Shared design tokens ──
const ACCENT = "hsl(65 69% 54%)";
const ACCENT_FG = "hsl(220 20% 10%)";
const HEADING = "#1e293b";
const BODY = "#334155";
const MUTED = "#94a3b8";
const BORDER = "#e2e8f0";
const CARD_BG = "#f8fafc";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

function makeContactLine(co: CoInfo) {
  const parts: string[] = [];
  if (co.phone) parts.push(co.phone);
  if (co.email) parts.push(co.email);
  return parts.join(" · ");
}

/** Shared outer shell used by every template */
function shell({
  co,
  docLabel,
  docNumber,
  body,
}: {
  co: CoInfo;
  docLabel: string;
  docNumber?: string;
  body: string;
}) {
  const contactLine = makeContactLine(co);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CARD_BG};font-family:${FONT};">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="background:#ffffff;padding:28px 32px;border-radius:12px 12px 0 0;border:1px solid ${BORDER};border-bottom:none;">
      <table style="width:100%;" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top;">
          ${co.logoUrl ? `<img src="${co.logoUrl}" alt="${co.name}" style="max-height:44px;display:block;" />` : `<span style="font-size:18px;font-weight:700;color:${ACCENT};">${co.name}</span>`}
          ${co.address ? `<p style="margin:6px 0 0;color:${MUTED};font-size:11px;line-height:1.4;">${co.address}</p>` : ""}
          ${contactLine ? `<p style="margin:2px 0 0;color:${MUTED};font-size:11px;">${contactLine}</p>` : ""}
        </td>
        ${docNumber ? `<td style="vertical-align:top;text-align:right;white-space:nowrap;width:140px;">
          <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};font-weight:600;">${docLabel}</p>
          <p style="margin:2px 0 0;font-size:20px;font-weight:800;color:${HEADING};letter-spacing:-0.3px;line-height:1;">${docNumber}</p>
        </td>` : `<td style="vertical-align:top;text-align:right;">
          <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};font-weight:600;">${docLabel}</p>
        </td>`}
      </tr></table>
    </div>
    <!-- Accent line -->
    <div style="height:3px;background:${ACCENT};margin:0 48px;"></div>
    <!-- Body -->
    <div style="background:#ffffff;padding:32px;border:1px solid ${BORDER};border-top:none;border-radius:0 0 12px 12px;">
      ${body}
    </div>
    <!-- Footer -->
    ${contactLine ? `<div style="text-align:center;padding:16px;font-size:11px;color:${MUTED};">${contactLine}</div>` : ""}
  </div>
</body></html>`;
}

function infoCard(label: string, value: string, sub?: string) {
  return `<td style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px;padding:14px 18px;">
    <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${MUTED};font-weight:600;">${label}</p>
    <p style="margin:4px 0 0;font-size:14px;color:${HEADING};font-weight:600;">${value}</p>
    ${sub ? `<p style="margin:2px 0 0;font-size:12px;color:#64748b;">${sub}</p>` : ""}
  </td>`;
}

function ctaButton(text: string) {
  return `<div style="text-align:center;margin:32px 0;">
    <a href="#" style="display:inline-block;background:${ACCENT};color:${ACCENT_FG};text-decoration:none;padding:14px 44px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.2px;">${text}</a>
  </div>`;
}

function signoff(co: CoInfo) {
  return `<p style="margin:24px 0 0;font-size:15px;color:${BODY};line-height:1.6;">Please don't hesitate to reach out if you have any questions.</p>
  <p style="margin:16px 0 0;font-size:15px;color:${HEADING};">Best regards,<br/><strong>${co.name}</strong></p>`;
}

// ── Template builders ──

function buildProposal(co: CoInfo) {
  return shell({
    co,
    docLabel: "Proposal",
    docNumber: `#${SAMPLE.proposalNumber}`,
    body: `
      <table style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0"><tr>
        ${infoCard("Prepared For", SAMPLE.clientName)}
        <td style="width:16px;"></td>
        ${infoCard("Project", SAMPLE.projectTitle, SAMPLE.propertyAddress)}
      </tr></table>
      <p style="margin:0 0 16px;font-size:15px;color:${HEADING};line-height:1.6;">Dear John,</p>
      <p style="margin:0 0 24px;font-size:15px;color:${BODY};line-height:1.6;">Thank you for the opportunity to work with you. We've prepared a proposal for your review.</p>
      <div style="border:1px solid ${BORDER};border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:${CARD_BG};">
            <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">Service</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">Amount</th>
          </tr></thead>
          <tbody>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">DOB Filing &amp; Expediting</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:${HEADING};">$3,500</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">Architectural Plans</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:${HEADING};">$2,800</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${MUTED};font-style:italic;">Energy Code (optional)</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:${MUTED};">$950</td></tr>
          </tbody>
        </table>
        <div style="border-top:1px solid ${BORDER};padding:14px 16px;">
          <table style="width:100%;"><tr><td style="font-size:15px;font-weight:700;color:${HEADING};">Total</td><td style="font-size:18px;font-weight:800;color:${HEADING};text-align:right;">$6,300</td></tr>
          <tr><td style="font-size:13px;color:${MUTED};padding-top:4px;">Retainer Due</td><td style="font-size:14px;font-weight:600;color:${MUTED};text-align:right;padding-top:4px;">$3,150</td></tr></table>
        </div>
      </div>
      ${ctaButton("Review &amp; Sign Proposal")}
      <p style="margin:0 0 8px;font-size:13px;color:${MUTED};text-align:center;line-height:1.5;">The link above also includes a Project Information Sheet — please fill it out at your convenience.</p>
      ${signoff(co)}`,
  });
}

function buildChangeOrder(co: CoInfo) {
  return shell({
    co,
    docLabel: "Change Order",
    docNumber: SAMPLE.coNumber,
    body: `
      <table style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0"><tr>
        ${infoCard("Client", SAMPLE.clientName)}
        <td style="width:16px;"></td>
        ${infoCard("Project", SAMPLE.projectTitle, SAMPLE.propertyAddress)}
      </tr></table>
      <p style="margin:0 0 16px;font-size:15px;color:${HEADING};line-height:1.6;">Hi John,</p>
      <p style="margin:0 0 24px;font-size:15px;color:${BODY};line-height:1.6;">${co.name} has issued <strong>Change Order ${SAMPLE.coNumber}</strong> for your project. Please review the details below.</p>
      <div style="border:1px solid ${BORDER};border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:${CARD_BG};">
            <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">Detail</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;"></th>
          </tr></thead>
          <tbody>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${MUTED};font-weight:600;">Title</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">Additional Asbestos Abatement</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${MUTED};font-weight:600;">Services</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">Abatement monitoring for additional area</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${MUTED};font-weight:600;">Reason</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">Expanded scope after testing</td></tr>
          </tbody>
        </table>
        <div style="border-top:1px solid ${BORDER};padding:14px 16px;">
          <table style="width:100%;"><tr><td style="font-size:15px;font-weight:700;color:${HEADING};">Amount</td><td style="font-size:18px;font-weight:800;color:${HEADING};text-align:right;">$4,200</td></tr></table>
        </div>
      </div>
      ${ctaButton("Review &amp; Sign")}
      ${signoff(co)}`,
  });
}

function buildWelcome(co: CoInfo) {
  return shell({
    co,
    docLabel: "Welcome",
    body: `
      <table style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0"><tr>
        ${infoCard("Project", SAMPLE.projectTitle, SAMPLE.propertyAddress)}
      </tr></table>
      <p style="margin:0 0 16px;font-size:15px;color:${HEADING};line-height:1.6;">Hi ${SAMPLE.clientName},</p>
      <p style="margin:0 0 20px;font-size:15px;color:${BODY};line-height:1.6;">Thank you for choosing <strong>${co.name}</strong>. We're excited to get started on <strong>${SAMPLE.projectTitle}</strong> at <strong>${SAMPLE.propertyAddress}</strong>.</p>
      <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6;">📎 A copy of your fully executed proposal is attached to this email for your records.</p>
      <div style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">Your Project Manager</p>
        <p style="margin:0;font-size:16px;font-weight:700;color:${HEADING};">${SAMPLE.pmName}</p>
        <p style="margin:4px 0 0;font-size:14px;color:${BODY};"><a href="#" style="color:hsl(65 69% 38%);text-decoration:none;">${SAMPLE.pmEmail}</a></p>
        <p style="margin:4px 0 0;font-size:14px;color:${BODY};">${SAMPLE.pmPhone}</p>
      </div>
      <p style="margin:0 0 20px;font-size:15px;color:${BODY};line-height:1.6;">To get started, please fill out the Project Information Sheet so we can begin work on your behalf.</p>
      ${ctaButton("Fill Out Project Information Sheet")}
      <p style="margin:16px 0 0;font-size:15px;color:${HEADING};">Best regards,<br/><strong>${co.name}</strong></p>`,
  });
}

function buildInvoice(co: CoInfo) {
  return shell({
    co,
    docLabel: "Invoice",
    docNumber: SAMPLE.invoiceNumber,
    body: `
      <table style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0"><tr>
        ${infoCard("Billed To", SAMPLE.clientName)}
        <td style="width:16px;"></td>
        ${infoCard("Project", SAMPLE.projectTitle, SAMPLE.propertyAddress)}
      </tr></table>
      <p style="margin:0 0 16px;font-size:15px;color:${HEADING};line-height:1.6;">Dear John,</p>
      <p style="margin:0 0 24px;font-size:15px;color:${BODY};line-height:1.6;">Please find the details for invoice <strong>${SAMPLE.invoiceNumber}</strong> below.</p>
      <div style="border:1px solid ${BORDER};border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:${CARD_BG};">
            <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">Detail</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;"></th>
          </tr></thead>
          <tbody>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${MUTED};font-weight:600;">Payment Terms</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};text-align:right;">Net 30</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${MUTED};font-weight:600;">Due Date</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};text-align:right;">April 18, 2026</td></tr>
          </tbody>
        </table>
        <div style="border-top:1px solid ${BORDER};padding:14px 16px;">
          <table style="width:100%;"><tr><td style="font-size:15px;font-weight:700;color:${HEADING};">Amount Due</td><td style="font-size:18px;font-weight:800;color:${HEADING};text-align:right;">$8,500</td></tr></table>
        </div>
      </div>
      <p style="margin:0 0 24px;font-size:15px;color:${BODY};line-height:1.6;">Thank you for your business.</p>
      <p style="margin:16px 0 0;font-size:15px;color:${HEADING};">Best regards,<br/><strong>${co.name}</strong></p>`,
  });
}

function buildReminder(co: CoInfo) {
  return shell({
    co,
    docLabel: "Payment Reminder",
    docNumber: SAMPLE.invoiceNumber,
    body: `
      <table style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0"><tr>
        ${infoCard("Client", SAMPLE.clientName)}
        <td style="width:16px;"></td>
        ${infoCard("Invoice", SAMPLE.invoiceNumber, "15 days past due")}
      </tr></table>
      <p style="margin:0 0 16px;font-size:15px;color:${HEADING};line-height:1.6;">Dear John,</p>
      <p style="margin:0 0 24px;font-size:15px;color:${BODY};line-height:1.6;">This is a friendly reminder that payment of <strong>$8,500.00</strong> for invoice <strong>${SAMPLE.invoiceNumber}</strong> is now <strong>15 days</strong> past due.</p>
      <div style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;"><tr>
          <td style="text-align:center;">
            <p style="margin:0;font-size:10px;text-transform:uppercase;color:${MUTED};font-weight:600;letter-spacing:0.8px;">Amount Due</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:${HEADING};">$8,500.00</p>
          </td>
          <td style="text-align:center;">
            <p style="margin:0;font-size:10px;text-transform:uppercase;color:${MUTED};font-weight:600;letter-spacing:0.8px;">Days Overdue</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#dc2626;">15</p>
          </td>
        </tr></table>
      </div>
      <p style="margin:0 0 24px;font-size:15px;color:${BODY};line-height:1.6;">We would appreciate your prompt attention to this matter. If payment has already been sent, please disregard this notice.</p>
      ${signoff(co)}`,
  });
}

function buildDigest(co: CoInfo) {
  return shell({
    co,
    docLabel: "Billing Summary",
    docNumber: "Weekly",
    body: `
      <p style="margin:0 0 16px;font-size:15px;color:${HEADING};line-height:1.6;">Hi Sarah,</p>
      <p style="margin:0 0 24px;font-size:15px;color:${BODY};line-height:1.6;">Here's your weekly billing summary for <strong>Mar 12 – Mar 19</strong>.</p>
      <div style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;"><tr>
          <td style="text-align:center;">
            <p style="margin:0;font-size:10px;text-transform:uppercase;color:${MUTED};font-weight:600;letter-spacing:0.8px;">Total Billed</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:${HEADING};">$24,500</p>
          </td>
          <td style="text-align:center;">
            <p style="margin:0;font-size:10px;text-transform:uppercase;color:${MUTED};font-weight:600;letter-spacing:0.8px;">Requests</p>
            <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:${HEADING};">4</p>
          </td>
        </tr></table>
      </div>
      <div style="border:1px solid ${BORDER};border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:${CARD_BG};">
            <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">Service</th>
            <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">Project</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">Amount</th>
          </tr></thead>
          <tbody>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">DOB Filing</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">2026-0012</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:${HEADING};">$3,500</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">Architectural Plans</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">2026-0012</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:${HEADING};">$5,200</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">Expediting</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">2026-0018</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:${HEADING};">$8,400</td></tr>
            <tr><td style="padding:10px 16px;font-size:14px;color:${HEADING};">Environmental Testing</td><td style="padding:10px 16px;font-size:13px;color:#64748b;">2026-0018</td><td style="padding:10px 16px;font-size:14px;text-align:right;color:${HEADING};">$7,400</td></tr>
          </tbody>
        </table>
      </div>
      ${ctaButton("View in Ordino")}
      <p style="margin:16px 0 0;font-size:15px;color:${HEADING};">— ${co.name}</p>`,
  });
}

function buildPartner(co: CoInfo) {
  return shell({
    co,
    docLabel: "RFP Outreach",
    body: `
      <p style="margin:0 0 16px;font-size:15px;color:${HEADING};line-height:1.6;">Hello,</p>
      <p style="margin:0 0 24px;font-size:15px;color:${BODY};line-height:1.6;">We'd like to offer our firm's inspection and filing support for this upcoming LL11/FISP requirement. Our team has extensive experience with facade compliance and DOB filings.</p>
      <div style="border:1px solid ${BORDER};border-radius:8px;overflow:hidden;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:${CARD_BG};">
            <th colspan="2" style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">RFP Details</th>
          </tr></thead>
          <tbody>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${MUTED};font-weight:600;width:120px;">Title</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">Facade Inspection &amp; Safety Program</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${MUTED};font-weight:600;">Agency</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">NYC Dept. of Buildings</td></tr>
            <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${MUTED};font-weight:600;">Due Date</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">April 15, 2026</td></tr>
            <tr><td style="padding:10px 16px;font-size:13px;color:${MUTED};font-weight:600;">Est. Value</td><td style="padding:10px 16px;font-size:14px;font-weight:700;color:${HEADING};">$85,000</td></tr>
          </tbody>
        </table>
      </div>
      <p style="margin:0 0 8px;font-size:15px;color:${BODY};line-height:1.6;">Please let us know if you'd like to collaborate:</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="#" style="display:inline-block;background:${ACCENT};color:${ACCENT_FG};text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:700;">I'm Interested</a>
        <span style="display:inline-block;width:12px;"></span>
        <a href="#" style="display:inline-block;background:#ffffff;color:${MUTED};text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:600;border:1px solid ${BORDER};">Pass</a>
      </div>
      <p style="margin:24px 0 0;font-size:15px;color:${HEADING};">— ${co.name}</p>`,
  });
}

// ── Template registry ──

interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  category: "client" | "internal" | "partner";
  buildHtml: (co: CoInfo) => string;
}

const TEMPLATES: TemplateEntry[] = [
  { id: "proposal", name: "Proposal Delivery", description: "Sent when a proposal is emailed to a client for review & signing", category: "client", buildHtml: buildProposal },
  { id: "change_order", name: "Change Order", description: "Sent when a CO is emailed to a client for signing", category: "client", buildHtml: buildChangeOrder },
  { id: "welcome", name: "Welcome / Onboarding", description: "Sent after a proposal is executed — introduces the PM and PIS link", category: "client", buildHtml: buildWelcome },
  { id: "invoice", name: "Invoice Delivery", description: "Sent when an invoice is emailed to a client", category: "client", buildHtml: buildInvoice },
  { id: "reminder", name: "Payment Reminder", description: "Sent for overdue invoices from the collections view", category: "client", buildHtml: buildReminder },
  { id: "billing_digest", name: "Billing Digest", description: "Weekly/daily billing summary sent to internal users", category: "internal", buildHtml: buildDigest },
  { id: "partner_outreach", name: "Partner / RFP Outreach", description: "Sent to potential partners for RFP collaboration", category: "partner", buildHtml: buildPartner },
];

const categoryLabels: Record<string, string> = { client: "Client-Facing", internal: "Internal", partner: "Partner" };
const categoryColors: Record<string, string> = {
  client: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  internal: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  partner: "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

export function EmailTemplateGallery() {
  const { data: company } = useCompanySettings();

  const coInfo: CoInfo = useMemo(() => ({
    name: company?.name || "Your Company",
    email: company?.email || company?.settings?.company_email || "",
    phone: company?.phone || company?.settings?.company_phone || "",
    address: company?.address || company?.settings?.company_address || "",
    logoUrl: company?.logo_url || company?.settings?.company_logo_url || null,
  }), [company]);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewTemplate = TEMPLATES.find((t) => t.id === previewId);
  const previewHtml = useMemo(() => previewTemplate?.buildHtml(coInfo) || "", [previewId, coInfo]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> Email Template Gallery
        </CardTitle>
        <CardDescription>
          Preview all branded email templates. Click any to see a full-size preview.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {TEMPLATES.map((t) => {
            const html = t.buildHtml(coInfo);
            return (
              <button
                key={t.id}
                onClick={() => setPreviewId(t.id)}
                className="text-left group rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all overflow-hidden"
              >
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
                <div className="p-3">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                </div>
              </button>
            );
          })}
        </div>

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
