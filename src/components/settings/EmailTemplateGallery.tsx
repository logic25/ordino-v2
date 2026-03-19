import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Save, RotateCcw, Palette, Type, Loader2 } from "lucide-react";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { toast } from "sonner";

// ── Types ──

interface CoInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  logoUrl: string | null;
}

interface StyleConfig {
  accentColor: string;
  fontFamily: string;
  buttonRadius: string;
}

interface TemplateOverride {
  subject: string;
  greeting: string;
  body_text: string;
  cta_text: string;
  signoff: string;
}

// ── Defaults ──

const DEFAULT_STYLE: StyleConfig = {
  accentColor: "#c5d636",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
  buttonRadius: "8px",
};

const FONT_OPTIONS = [
  { label: "System (Apple/SF)", value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif" },
  { label: "Georgia (Serif)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
];

const RADIUS_OPTIONS = [
  { label: "Sharp", value: "0px" },
  { label: "Rounded", value: "8px" },
  { label: "Pill", value: "24px" },
];

// ── Template definitions ──

interface TemplateDef {
  id: string;
  name: string;
  description: string;
  category: "client" | "internal" | "partner";
  defaults: TemplateOverride;
}

const TEMPLATES: TemplateDef[] = [
  {
    id: "proposal",
    name: "Proposal Delivery",
    description: "Sent when a proposal is emailed to a client for review & signing",
    category: "client",
    defaults: {
      subject: "Your Proposal is Ready — {{PROPOSAL_NUMBER}}",
      greeting: "Dear {{CLIENT_NAME}},",
      body_text: "Thank you for the opportunity to work with you. We've prepared a proposal for your review.",
      cta_text: "Review & Sign Proposal",
      signoff: "Please don't hesitate to reach out if you have any questions.",
    },
  },
  {
    id: "change_order",
    name: "Change Order",
    description: "Sent when a CO is emailed to a client for signing",
    category: "client",
    defaults: {
      subject: "Change Order {{CO_NUMBER}} — {{PROJECT_TITLE}}",
      greeting: "Hi {{CLIENT_NAME}},",
      body_text: "{{COMPANY_NAME}} has issued Change Order {{CO_NUMBER}} for your project. Please review the details below.",
      cta_text: "Review & Sign",
      signoff: "Please don't hesitate to reach out if you have any questions.",
    },
  },
  {
    id: "welcome",
    name: "Welcome / Onboarding",
    description: "Sent after a proposal is executed — introduces the PM and PIS link",
    category: "client",
    defaults: {
      subject: "Welcome! Let's get started on {{PROJECT_TITLE}}",
      greeting: "Hi {{CLIENT_NAME}},",
      body_text: "Thank you for choosing {{COMPANY_NAME}}. We're excited to get started on {{PROJECT_TITLE}} at {{PROPERTY_ADDRESS}}.",
      cta_text: "Fill Out Project Information Sheet",
      signoff: "To get started, please fill out the Project Information Sheet so we can begin work on your behalf.",
    },
  },
  {
    id: "invoice",
    name: "Invoice Delivery",
    description: "Sent when an invoice is emailed to a client",
    category: "client",
    defaults: {
      subject: "Invoice {{INVOICE_NUMBER}} — {{PROJECT_TITLE}}",
      greeting: "Dear {{CLIENT_NAME}},",
      body_text: "Please find the details for invoice {{INVOICE_NUMBER}} below.",
      cta_text: "",
      signoff: "Thank you for your business.",
    },
  },
  {
    id: "reminder",
    name: "Payment Reminder",
    description: "Sent for overdue invoices from the collections view",
    category: "client",
    defaults: {
      subject: "Payment Reminder — {{INVOICE_NUMBER}}",
      greeting: "Dear {{CLIENT_NAME}},",
      body_text: "This is a friendly reminder that payment of {{AMOUNT}} for invoice {{INVOICE_NUMBER}} is now {{DAYS_OVERDUE}} days past due.",
      cta_text: "",
      signoff: "We would appreciate your prompt attention to this matter. If payment has already been sent, please disregard this notice.",
    },
  },
  {
    id: "billing_digest",
    name: "Billing Digest",
    description: "Weekly/daily billing summary sent to internal users",
    category: "internal",
    defaults: {
      subject: "Billing Summary — {{DATE_RANGE}}",
      greeting: "Hi {{USER_NAME}},",
      body_text: "Here's your weekly billing summary for {{DATE_RANGE}}.",
      cta_text: "View in Ordino",
      signoff: "",
    },
  },
  {
    id: "partner_outreach",
    name: "Partner / RFP Outreach",
    description: "Sent to potential partners for RFP collaboration",
    category: "partner",
    defaults: {
      subject: "Partnership Opportunity — {{RFP_TITLE}}",
      greeting: "Hello,",
      body_text: "We'd like to offer our firm's inspection and filing support for this upcoming requirement. Our team has extensive experience with compliance and filings.",
      cta_text: "I'm Interested",
      signoff: "",
    },
  },
];

const categoryLabels: Record<string, string> = { client: "Client-Facing", internal: "Internal", partner: "Partner" };
const categoryColors: Record<string, string> = {
  client: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  internal: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  partner: "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

// ── Design tokens for preview ──
const HEADING = "#1e293b";
const BODY_COLOR = "#334155";
const MUTED = "#94a3b8";
const BORDER = "#e2e8f0";
const CARD_BG = "#f8fafc";

// ── Preview builder ──

function buildPreviewHtml(
  template: TemplateDef,
  overrides: TemplateOverride,
  style: StyleConfig,
  co: CoInfo,
): string {
  const accent = style.accentColor;
  const font = style.fontFamily;
  const btnRadius = style.buttonRadius;

  // Resolve variables for preview
  const resolve = (text: string) =>
    text
      .replace(/\{\{COMPANY_NAME\}\}/g, co.name)
      .replace(/\{\{CLIENT_NAME\}\}/g, "John Smith")
      .replace(/\{\{PROJECT_TITLE\}\}/g, "Alt-1 Interior Renovation")
      .replace(/\{\{PROPERTY_ADDRESS\}\}/g, "456 Park Avenue, New York, NY")
      .replace(/\{\{PROPOSAL_NUMBER\}\}/g, "#031926-1")
      .replace(/\{\{CO_NUMBER\}\}/g, "CO#1")
      .replace(/\{\{INVOICE_NUMBER\}\}/g, "INV-00042")
      .replace(/\{\{AMOUNT\}\}/g, "$8,500.00")
      .replace(/\{\{DAYS_OVERDUE\}\}/g, "15")
      .replace(/\{\{DATE_RANGE\}\}/g, "Mar 12 – Mar 19")
      .replace(/\{\{USER_NAME\}\}/g, "Sarah")
      .replace(/\{\{RFP_TITLE\}\}/g, "Facade Inspection & Safety Program")
      .replace(/\{\{PM_NAME\}\}/g, "Sarah Johnson")
      .replace(/\{\{PM_EMAIL\}\}/g, "sarah@company.com")
      .replace(/\{\{PM_PHONE\}\}/g, "(555) 555-5678");

  const contactLine = [co.phone, co.email].filter(Boolean).join(" · ");
  const greeting = resolve(overrides.greeting);
  const bodyText = resolve(overrides.body_text);
  const ctaText = resolve(overrides.cta_text);
  const signoffText = resolve(overrides.signoff);

  // Accent foreground: if accent is light, use dark text
  const accentFg = "#1a1a2e";

  const docLabels: Record<string, { label: string; number?: string }> = {
    proposal: { label: "Proposal", number: "#031926-1" },
    change_order: { label: "Change Order", number: "CO#1" },
    welcome: { label: "Welcome" },
    invoice: { label: "Invoice", number: "INV-00042" },
    reminder: { label: "Payment Reminder", number: "INV-00042" },
    billing_digest: { label: "Billing Summary", number: "Weekly" },
    partner_outreach: { label: "RFP Outreach" },
  };

  const doc = docLabels[template.id] || { label: template.name };
  const logoLockup = co.logoUrl
    ? `<div style="max-width:320px;height:64px;display:flex;align-items:center;overflow:hidden;">
         <img src="${co.logoUrl}" alt="${co.name}" style="display:block;max-width:100%;max-height:64px;width:auto;height:auto;object-fit:contain;object-position:left center;" />
       </div>`
    : `<span style="font-size:18px;font-weight:700;color:${accent};">${co.name}</span>`;

  // Template-specific body content
  const templateBody = buildTemplateBody(template.id, { greeting, bodyText, ctaText, signoffText, accent, accentFg, btnRadius, co });

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CARD_BG};font-family:${font};overflow-x:hidden;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;padding:28px 32px;border-radius:12px 12px 0 0;border:1px solid ${BORDER};border-bottom:none;overflow:hidden;">
      <table style="width:100%;table-layout:fixed;" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top;width:70%;padding-right:20px;">
          ${logoLockup}
          ${co.address ? `<p style="margin:10px 0 0;color:${MUTED};font-size:11px;line-height:1.4;max-width:280px;">${co.address}</p>` : ""}
          ${contactLine ? `<p style="margin:4px 0 0;color:${MUTED};font-size:11px;line-height:1.4;max-width:280px;word-break:break-word;">${contactLine}</p>` : ""}
        </td>
        ${doc.number ? `<td style="vertical-align:top;text-align:right;white-space:nowrap;width:30%;">
          <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};font-weight:600;">${doc.label}</p>
          <p style="margin:2px 0 0;font-size:20px;font-weight:800;color:${HEADING};letter-spacing:-0.3px;line-height:1;">${doc.number}</p>
        </td>` : `<td style="vertical-align:top;text-align:right;width:30%;">
          <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${MUTED};font-weight:600;">${doc.label}</p>
        </td>`}
      </tr></table>
    </div>
    <div style="height:3px;background:${accent};margin:0 48px;"></div>
    <div style="background:#ffffff;padding:32px;border:1px solid ${BORDER};border-top:none;border-radius:0 0 12px 12px;font-family:${font};">
      ${templateBody}
    </div>
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

function ctaBtn(text: string, accent: string, accentFg: string, radius: string) {
  if (!text) return "";
  return `<div style="text-align:center;margin:32px 0;">
    <a href="#" style="display:inline-block;background:${accent};color:${accentFg};text-decoration:none;padding:14px 44px;border-radius:${radius};font-size:16px;font-weight:700;letter-spacing:0.2px;">${text}</a>
  </div>`;
}

function buildTemplateBody(
  templateId: string,
  ctx: {
    greeting: string;
    bodyText: string;
    ctaText: string;
    signoffText: string;
    accent: string;
    accentFg: string;
    btnRadius: string;
    co: CoInfo;
  },
): string {
  const { greeting, bodyText, ctaText, signoffText, accent, accentFg, btnRadius, co } = ctx;

  const greetingHtml = `<p style="margin:0 0 16px;font-size:15px;color:${HEADING};line-height:1.6;">${greeting}</p>`;
  const bodyHtml = `<p style="margin:0 0 24px;font-size:15px;color:${BODY_COLOR};line-height:1.6;">${bodyText}</p>`;
  const ctaHtml = ctaBtn(ctaText, accent, accentFg, btnRadius);
  const signoffHtml = signoffText
    ? `<p style="margin:24px 0 0;font-size:15px;color:${BODY_COLOR};line-height:1.6;">${signoffText}</p>
       <p style="margin:16px 0 0;font-size:15px;color:${HEADING};">Best regards,<br/><strong>${co.name}</strong></p>`
    : `<p style="margin:16px 0 0;font-size:15px;color:${HEADING};">— ${co.name}</p>`;

  switch (templateId) {
    case "proposal":
      return `
        <table style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0"><tr>
          ${infoCard("Prepared For", "John Smith")}
          <td style="width:16px;"></td>
          ${infoCard("Project", "Alt-1 Interior Renovation", "456 Park Avenue, New York, NY")}
        </tr></table>
        ${greetingHtml}${bodyHtml}
        <div style="border:1px solid ${BORDER};border-radius:8px;overflow:hidden;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:${CARD_BG};">
              <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">Service</th>
              <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">Amount</th>
            </tr></thead>
            <tbody>
              <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">DOB Filing &amp; Expediting</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:${HEADING};">$3,500</td></tr>
              <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">Architectural Plans</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;color:${HEADING};">$2,800</td></tr>
            </tbody>
          </table>
          <div style="border-top:1px solid ${BORDER};padding:14px 16px;">
            <table style="width:100%;"><tr><td style="font-size:15px;font-weight:700;color:${HEADING};">Total</td><td style="font-size:18px;font-weight:800;color:${HEADING};text-align:right;">$6,300</td></tr></table>
          </div>
        </div>
        ${ctaHtml}${signoffHtml}`;

    case "change_order":
      return `
        <table style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0"><tr>
          ${infoCard("Client", "John Smith")}
          <td style="width:16px;"></td>
          ${infoCard("Project", "Alt-1 Interior Renovation", "456 Park Avenue, New York, NY")}
        </tr></table>
        ${greetingHtml}${bodyHtml}
        <div style="border:1px solid ${BORDER};border-radius:8px;overflow:hidden;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:${CARD_BG};"><th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">Detail</th><th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;"></th></tr></thead>
            <tbody>
              <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${MUTED};font-weight:600;">Title</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">Additional Asbestos Abatement</td></tr>
              <tr><td style="padding:10px 16px;font-size:13px;color:${MUTED};font-weight:600;">Reason</td><td style="padding:10px 16px;font-size:14px;color:${HEADING};">Expanded scope after testing</td></tr>
            </tbody>
          </table>
          <div style="border-top:1px solid ${BORDER};padding:14px 16px;">
            <table style="width:100%;"><tr><td style="font-size:15px;font-weight:700;color:${HEADING};">Amount</td><td style="font-size:18px;font-weight:800;color:${HEADING};text-align:right;">$4,200</td></tr></table>
          </div>
        </div>
        ${ctaHtml}${signoffHtml}`;

    case "welcome":
      return `
        <table style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0"><tr>
          ${infoCard("Project", "Alt-1 Interior Renovation", "456 Park Avenue, New York, NY")}
        </tr></table>
        ${greetingHtml}${bodyHtml}
        <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6;">📎 A copy of your fully executed proposal is attached to this email for your records.</p>
        <div style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">Your Project Manager</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:${HEADING};">Sarah Johnson</p>
          <p style="margin:4px 0 0;font-size:14px;color:${BODY_COLOR};">sarah@company.com · (555) 555-5678</p>
        </div>
        ${ctaHtml}${signoffHtml}`;

    case "invoice":
      return `
        <table style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0"><tr>
          ${infoCard("Billed To", "John Smith")}
          <td style="width:16px;"></td>
          ${infoCard("Project", "Alt-1 Interior Renovation", "456 Park Avenue, New York, NY")}
        </tr></table>
        ${greetingHtml}${bodyHtml}
        <div style="border:1px solid ${BORDER};border-radius:8px;overflow:hidden;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:${CARD_BG};"><th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">Detail</th><th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;"></th></tr></thead>
            <tbody>
              <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${MUTED};font-weight:600;">Payment Terms</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};text-align:right;">Net 30</td></tr>
              <tr><td style="padding:10px 16px;font-size:13px;color:${MUTED};font-weight:600;">Due Date</td><td style="padding:10px 16px;font-size:14px;color:${HEADING};text-align:right;">April 18, 2026</td></tr>
            </tbody>
          </table>
          <div style="border-top:1px solid ${BORDER};padding:14px 16px;">
            <table style="width:100%;"><tr><td style="font-size:15px;font-weight:700;color:${HEADING};">Amount Due</td><td style="font-size:18px;font-weight:800;color:${HEADING};text-align:right;">$8,500</td></tr></table>
          </div>
        </div>
        ${signoffHtml}`;

    case "reminder":
      return `
        <table style="width:100%;margin-bottom:24px;" cellpadding="0" cellspacing="0"><tr>
          ${infoCard("Client", "John Smith")}
          <td style="width:16px;"></td>
          ${infoCard("Invoice", "INV-00042", "15 days past due")}
        </tr></table>
        ${greetingHtml}${bodyHtml}
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
        ${signoffHtml}`;

    case "billing_digest":
      return `
        ${greetingHtml}${bodyHtml}
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
              <tr><td style="padding:10px 16px;font-size:14px;color:${HEADING};">Expediting</td><td style="padding:10px 16px;font-size:13px;color:#64748b;">2026-0018</td><td style="padding:10px 16px;font-size:14px;text-align:right;color:${HEADING};">$8,400</td></tr>
            </tbody>
          </table>
        </div>
        ${ctaHtml}${signoffHtml}`;

    case "partner_outreach":
      return `
        ${greetingHtml}${bodyHtml}
        <div style="border:1px solid ${BORDER};border-radius:8px;overflow:hidden;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:${CARD_BG};"><th colspan="2" style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;color:${MUTED};letter-spacing:0.8px;font-weight:600;">RFP Details</th></tr></thead>
            <tbody>
              <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${MUTED};font-weight:600;width:120px;">Title</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">Facade Inspection &amp; Safety Program</td></tr>
              <tr><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:${MUTED};font-weight:600;">Agency</td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;color:${HEADING};">NYC Dept. of Buildings</td></tr>
              <tr><td style="padding:10px 16px;font-size:13px;color:${MUTED};font-weight:600;">Est. Value</td><td style="padding:10px 16px;font-size:14px;font-weight:700;color:${HEADING};">$85,000</td></tr>
            </tbody>
          </table>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="#" style="display:inline-block;background:${accent};color:${accentFg};text-decoration:none;padding:14px 36px;border-radius:${btnRadius};font-size:16px;font-weight:700;">${ctaText}</a>
          <span style="display:inline-block;width:12px;"></span>
          <a href="#" style="display:inline-block;background:#ffffff;color:${MUTED};text-decoration:none;padding:14px 36px;border-radius:${btnRadius};font-size:16px;font-weight:600;border:1px solid ${BORDER};">Pass</a>
        </div>
        ${signoffHtml}`;

    default:
      return `${greetingHtml}${bodyHtml}${ctaHtml}${signoffHtml}`;
  }
}

// ── Main component ──

export function EmailTemplateGallery() {
  const { data: company } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const [activeTemplateId, setActiveTemplateId] = useState(TEMPLATES[0].id);
  const [tab, setTab] = useState<"content" | "style">("content");

  // Resolve company info
  const coInfo: CoInfo = useMemo(() => ({
    name: company?.name || "Your Company",
    email: company?.email || company?.settings?.company_email || "",
    phone: company?.phone || company?.settings?.company_phone || "",
    address: company?.address || company?.settings?.company_address || "",
    logoUrl: company?.logo_url || company?.settings?.company_logo_url || null,
  }), [company]);

  // Load saved style
  const savedStyle = company?.settings?.email_style;
  const [style, setStyle] = useState<StyleConfig>({
    accentColor: savedStyle?.accent_color || DEFAULT_STYLE.accentColor,
    fontFamily: savedStyle?.font_family || DEFAULT_STYLE.fontFamily,
    buttonRadius: savedStyle?.button_radius || DEFAULT_STYLE.buttonRadius,
  });

  // Load saved overrides per template
  const savedOverrides = company?.settings?.email_template_overrides;
  const [overrides, setOverrides] = useState<Record<string, TemplateOverride>>({});

  // Sync from settings when company data loads
  useEffect(() => {
    if (company?.settings) {
      const s = company.settings;
      if (s.email_style) {
        setStyle({
          accentColor: s.email_style.accent_color || DEFAULT_STYLE.accentColor,
          fontFamily: s.email_style.font_family || DEFAULT_STYLE.fontFamily,
          buttonRadius: s.email_style.button_radius || DEFAULT_STYLE.buttonRadius,
        });
      }
      if (s.email_template_overrides) {
        const loaded: Record<string, TemplateOverride> = {};
        for (const t of TEMPLATES) {
          const saved = s.email_template_overrides[t.id];
          if (saved) {
            loaded[t.id] = {
              subject: saved.subject ?? t.defaults.subject,
              greeting: saved.greeting ?? t.defaults.greeting,
              body_text: saved.body_text ?? t.defaults.body_text,
              cta_text: saved.cta_text ?? t.defaults.cta_text,
              signoff: saved.signoff ?? t.defaults.signoff,
            };
          }
        }
        setOverrides(loaded);
      }
    }
  }, [company?.settings]);

  const activeTemplate = TEMPLATES.find((t) => t.id === activeTemplateId)!;

  const getOverride = useCallback(
    (templateId: string): TemplateOverride => {
      const tmpl = TEMPLATES.find((t) => t.id === templateId)!;
      return overrides[templateId] || { ...tmpl.defaults };
    },
    [overrides],
  );

  const currentOverride = getOverride(activeTemplateId);

  const updateField = (field: keyof TemplateOverride, value: string) => {
    setOverrides((prev) => ({
      ...prev,
      [activeTemplateId]: { ...getOverride(activeTemplateId), [field]: value },
    }));
  };

  const resetTemplate = () => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[activeTemplateId];
      return next;
    });
  };

  const resetStyle = () => setStyle({ ...DEFAULT_STYLE });

  const previewHtml = useMemo(
    () => buildPreviewHtml(activeTemplate, currentOverride, style, coInfo),
    [activeTemplate, currentOverride, style, coInfo],
  );

  const handleSave = async () => {
    if (!company?.companyId) return;

    const templateOverridesPayload: Record<string, any> = {};
    for (const t of TEMPLATES) {
      const ov = overrides[t.id];
      if (ov) {
        templateOverridesPayload[t.id] = {
          subject: ov.subject,
          greeting: ov.greeting,
          body_text: ov.body_text,
          cta_text: ov.cta_text,
          signoff: ov.signoff,
        };
      }
    }

    try {
      await updateSettings.mutateAsync({
        companyId: company.companyId,
        settings: {
          email_style: {
            accent_color: style.accentColor,
            font_family: style.fontFamily,
            button_radius: style.buttonRadius,
          },
          email_template_overrides: templateOverridesPayload as any,
        },
      });
      toast.success("Email template settings saved");
    } catch {
      toast.error("Failed to save template settings");
    }
  };

  const isDirty = useMemo(() => {
    const savedStyleStr = JSON.stringify(savedStyle || {});
    const currentStyleStr = JSON.stringify({
      accent_color: style.accentColor,
      font_family: style.fontFamily,
      button_radius: style.buttonRadius,
    });
    if (savedStyleStr !== currentStyleStr) return true;
    if (JSON.stringify(savedOverrides || {}) !== JSON.stringify(
      Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, v]))
    )) return true;
    return false;
  }, [style, overrides, savedStyle, savedOverrides]);

  // Available template variables for help text
  const variableHints: Record<string, string> = {
    "{{COMPANY_NAME}}": "Your company name",
    "{{CLIENT_NAME}}": "Client's name",
    "{{PROJECT_TITLE}}": "Project name",
    "{{PROPERTY_ADDRESS}}": "Property address",
    "{{PROPOSAL_NUMBER}}": "Proposal #",
    "{{CO_NUMBER}}": "Change order #",
    "{{INVOICE_NUMBER}}": "Invoice #",
    "{{AMOUNT}}": "Dollar amount",
    "{{DAYS_OVERDUE}}": "Days past due",
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5" /> Email Template Editor
          </h2>
          <p className="text-sm text-muted-foreground">Customize the text, subject lines, and design of outgoing emails</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
              Unsaved changes
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={updateSettings.isPending || !isDirty}
          >
            {updateSettings.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save All
          </Button>
        </div>
      </div>

      {/* Template selector */}
      <div className="flex gap-2 flex-wrap">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTemplateId(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              activeTemplateId === t.id
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Side-by-side layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        {/* Left: Editor */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">{activeTemplate.name}</CardTitle>
                <Badge variant="outline" className={`text-[10px] mt-1 ${categoryColors[activeTemplate.category]}`}>
                  {categoryLabels[activeTemplate.category]}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <div className="px-4 pt-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "content" | "style")}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="content" className="text-xs gap-1.5">
                  <Type className="h-3.5 w-3.5" /> Content
                </TabsTrigger>
                <TabsTrigger value="style" className="text-xs gap-1.5">
                  <Palette className="h-3.5 w-3.5" /> Style
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="h-[500px]">
            <CardContent className="pt-4 space-y-4">
              {tab === "content" ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Subject Line</Label>
                    <Input
                      value={currentOverride.subject}
                      onChange={(e) => updateField("subject", e.target.value)}
                      className="text-sm"
                      placeholder="Email subject..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Greeting</Label>
                    <Input
                      value={currentOverride.greeting}
                      onChange={(e) => updateField("greeting", e.target.value)}
                      className="text-sm"
                      placeholder="Dear {{CLIENT_NAME}},"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Body Text</Label>
                    <Textarea
                      value={currentOverride.body_text}
                      onChange={(e) => updateField("body_text", e.target.value)}
                      className="text-sm min-h-[100px]"
                      placeholder="Main message content..."
                    />
                  </div>
                  {activeTemplate.defaults.cta_text && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Button Text</Label>
                      <Input
                        value={currentOverride.cta_text}
                        onChange={(e) => updateField("cta_text", e.target.value)}
                        className="text-sm"
                        placeholder="Review & Sign"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Sign-off</Label>
                    <Textarea
                      value={currentOverride.signoff}
                      onChange={(e) => updateField("signoff", e.target.value)}
                      className="text-sm min-h-[60px]"
                      placeholder="Closing message..."
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={resetTemplate} className="text-xs text-muted-foreground">
                      <RotateCcw className="h-3 w-3 mr-1" /> Reset to Default
                    </Button>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Available Variables</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(variableHints).map(([variable, hint]) => (
                        <button
                          key={variable}
                          onClick={() => navigator.clipboard.writeText(variable).then(() => toast.success(`Copied ${variable}`))}
                          title={`${hint} — click to copy`}
                          className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-copy"
                        >
                          {variable}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={style.accentColor}
                        onChange={(e) => setStyle((s) => ({ ...s, accentColor: e.target.value }))}
                        className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                      />
                      <Input
                        value={style.accentColor}
                        onChange={(e) => setStyle((s) => ({ ...s, accentColor: e.target.value }))}
                        className="text-sm font-mono flex-1"
                        placeholder="#c5d636"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Used for the accent line, buttons, and highlights</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Font Family</Label>
                    <div className="grid gap-1.5">
                      {FONT_OPTIONS.map((f) => (
                        <button
                          key={f.value}
                          onClick={() => setStyle((s) => ({ ...s, fontFamily: f.value }))}
                          className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                            style.fontFamily === f.value
                              ? "border-primary bg-primary/5 text-primary font-medium"
                              : "border-border text-muted-foreground hover:border-primary/30"
                          }`}
                          style={{ fontFamily: f.value }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Button Corners</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {RADIUS_OPTIONS.map((r) => (
                        <button
                          key={r.value}
                          onClick={() => setStyle((s) => ({ ...s, buttonRadius: r.value }))}
                          className={`px-3 py-2 rounded-lg border text-xs transition-all ${
                            style.buttonRadius === r.value
                              ? "border-primary bg-primary/5 text-primary font-medium"
                              : "border-border text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          <div
                            className="w-full h-4 mb-1"
                            style={{
                              background: style.accentColor,
                              borderRadius: r.value,
                            }}
                          />
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <Button variant="ghost" size="sm" onClick={resetStyle} className="text-xs text-muted-foreground">
                    <RotateCcw className="h-3 w-3 mr-1" /> Reset Style
                  </Button>
                </>
              )}
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Right: Live preview */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground">Live Preview</CardTitle>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="px-1.5 py-0.5 rounded bg-muted font-mono">Subject:</span>
                <span className="truncate max-w-[300px]">
                  {currentOverride.subject
                    .replace(/\{\{COMPANY_NAME\}\}/g, coInfo.name)
                    .replace(/\{\{CLIENT_NAME\}\}/g, "John Smith")
                    .replace(/\{\{PROJECT_TITLE\}\}/g, "Alt-1 Interior Renovation")
                    .replace(/\{\{PROPOSAL_NUMBER\}\}/g, "#031926-1")
                    .replace(/\{\{CO_NUMBER\}\}/g, "CO#1")
                    .replace(/\{\{INVOICE_NUMBER\}\}/g, "INV-00042")
                    .replace(/\{\{AMOUNT\}\}/g, "$8,500.00")
                    .replace(/\{\{DAYS_OVERDUE\}\}/g, "15")
                    .replace(/\{\{DATE_RANGE\}\}/g, "Mar 12 – Mar 19")
                    .replace(/\{\{RFP_TITLE\}\}/g, "Facade Inspection")}
                </span>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <div className="bg-muted/20">
            <iframe
              srcDoc={previewHtml}
              title="Email Preview"
              className="w-full border-0"
              style={{ height: "600px" }}
              sandbox=""
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
