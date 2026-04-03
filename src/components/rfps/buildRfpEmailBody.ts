import { format } from "date-fns";
import { getProjectPhotoUrl } from "@/hooks/useProjectSheets";
import type { Rfp } from "@/hooks/useRfps";

interface AssembledContent {
  rfp: Rfp | null;
  sections: string[];
  companyInfo: any;
  staffBios: any[];
  notableProjects: any[];
  narratives: any[];
  pricing: any;
  certs: any[];
  coverLetter?: string;
  logoUrl?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
}

const COLORS = {
  accent: "#b5cc18",       // chartreuse brand accent
  accentDark: "#8fa313",   // darker accent for links
  charcoal: "#1a1a1a",
  text: "#2d2d2d",
  textSecondary: "#6b6b6b",
  border: "#e8e8e8",
  borderLight: "#f0f0f0",
  bg: "#fafafa",
  white: "#ffffff",
  green: "#16a34a",
  blue: "#2563eb",
  amber: "#d97706",
};

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function sectionHeading(title: string): string {
  return `<tr><td style="padding:28px 0 12px">
    <div style="font-family:${FONT};font-size:13px;font-weight:600;letter-spacing:0.3px;color:${COLORS.charcoal};padding-bottom:8px;border-bottom:1px solid ${COLORS.border}">${title}</div>
  </td></tr>`;
}

function coverLetterHtml(text: string): string {
  return `
    ${sectionHeading("Cover Letter")}
    <tr><td style="padding:8px 0 24px">
      <div style="font-family:${FONT};font-size:14px;line-height:1.75;color:${COLORS.text};white-space:pre-wrap">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>
    </td></tr>`;
}

function companyInfoHtml(data: any): string {
  const content = data?.content as Record<string, any> | undefined;
  if (!content) return "";
  const fields = [
    { label: "Legal Name", value: content.legal_name },
    { label: "Address", value: content.address },
    { label: "Phone", value: content.phone },
    { label: "Email", value: content.email },
    { label: "Tax ID", value: content.tax_id },
    { label: "Founded", value: content.founded_year },
    { label: "Staff Count", value: content.staff_count },
    { label: "Website", value: content.website },
  ].filter((f) => f.value);
  if (!fields.length) return "";

  const rows = fields.map(
    (f) => `<td style="padding:10px 16px;vertical-align:top;width:50%">
      <div style="font-family:${FONT};font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${COLORS.textSecondary};font-weight:500">${f.label}</div>
      <div style="font-family:${FONT};font-size:14px;color:${COLORS.text};margin-top:4px;font-weight:500">${String(f.value)}</div>
    </td>`
  );

  const tableRows: string[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    tableRows.push(`<tr>${rows[i]}${rows[i + 1] || "<td></td>"}</tr>`);
  }

  return `
    ${sectionHeading("Company Information")}
    <tr><td style="padding:4px 0 24px">
      <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${COLORS.borderLight};border-radius:8px;border-collapse:separate;background:${COLORS.bg}">
        ${tableRows.join("")}
      </table>
    </td></tr>`;
}

function staffBiosHtml(bios: any[]): string {
  if (!bios.length) return "";
  const items = bios.map((item) => {
    const c = item.content as any;
    const meta: string[] = [];
    if (c.title) meta.push(c.title);
    if (c.years_experience) meta.push(`${c.years_experience} yrs experience`);
    if (c.hourly_rate) meta.push(`$${Number(c.hourly_rate).toLocaleString()}/hr`);
    return `<tr><td style="padding:14px 16px;border:1px solid ${COLORS.borderLight};border-radius:8px;background:${COLORS.white}">
      <div style="font-family:${FONT};font-size:15px;font-weight:600;color:${COLORS.charcoal}">${c.name || "—"}</div>
      <div style="font-family:${FONT};font-size:12px;color:${COLORS.textSecondary};margin-top:3px">${meta.join(" · ")}</div>
      ${c.bio ? `<div style="font-family:${FONT};font-size:13px;color:${COLORS.text};margin-top:8px;line-height:1.65">${c.bio}</div>` : ""}
    </td></tr>
    <tr><td style="height:8px"></td></tr>`;
  });
  return `${sectionHeading("Key Personnel")}${items.join("")}`;
}

function notableProjectsHtml(projects: any[]): string {
  if (!projects.length) return "";
  const items = projects.map((proj) => {
    const props = proj.properties as any;
    const isSheet = proj._isSheet;
    const title = isSheet ? proj._title : (props?.address || "Unknown");
    const photos: string[] = proj.photos || [];
    const completionDate = proj.completion_date;

    const metaParts: string[] = [];
    if (props?.borough && !isSheet) metaParts.push(props.borough);
    if (props?.address && isSheet) metaParts.push(props.address);
    if (proj.client_name) metaParts.push(proj.client_name);
    if (proj.estimated_value) metaParts.push(`$${proj.estimated_value.toLocaleString()}`);
    if (proj.application_type) metaParts.push(proj.application_type);
    if (completionDate) metaParts.push(`Completed ${format(new Date(completionDate), "MMM yyyy")}`);

    const photoHtml = photos.filter((p: string) => !p.endsWith(".pdf")).slice(0, 4).map((p: string) => {
      const url = getProjectPhotoUrl(p);
      return `<td style="width:25%;padding:4px"><img src="${url}" alt="Project photo" style="width:100%;border-radius:6px;display:block" /></td>`;
    });

    const refHtml = proj.reference_contact_name
      ? `<div style="margin-top:10px;padding:10px 14px;background:${COLORS.bg};border:1px solid ${COLORS.borderLight};border-radius:6px;font-family:${FONT};font-size:12px;color:${COLORS.text}">
          <strong>Reference:</strong> ${proj.reference_contact_name}${proj.reference_contact_title ? `, ${proj.reference_contact_title}` : ""}${proj.reference_contact_phone ? ` — ${proj.reference_contact_phone}` : ""}${proj.reference_contact_email ? ` — ${proj.reference_contact_email}` : ""}
        </div>`
      : "";

    return `<tr><td style="padding:14px 16px;border:1px solid ${COLORS.borderLight};border-radius:8px;background:${COLORS.white}">
      <div style="font-family:${FONT};font-size:15px;font-weight:600;color:${COLORS.charcoal}">${title}${isSheet ? ' <span style="font-size:10px;color:' + COLORS.accent + ';font-weight:500">[Custom]</span>' : ""}</div>
      ${metaParts.length ? `<div style="font-family:${FONT};font-size:12px;color:${COLORS.textSecondary};margin-top:4px">${metaParts.join(" · ")}</div>` : ""}
      ${proj.description ? `<div style="font-family:${FONT};font-size:13px;color:${COLORS.text};margin-top:8px;line-height:1.65">${proj.description}</div>` : ""}
      ${photoHtml.length ? `<table cellpadding="0" cellspacing="0" width="100%" style="margin-top:10px"><tr>${photoHtml.join("")}</tr></table>` : ""}
      ${refHtml}
    </td></tr>
    <tr><td style="height:8px"></td></tr>`;
  });
  return `${sectionHeading("Notable Projects & References")}${items.join("")}`;
}

function narrativesHtml(narratives: any[]): string {
  if (!narratives.length) return "";
  const items = narratives.map((item) => {
    const text = (item.content as any)?.text || "";
    return `<tr><td style="padding:12px 0 20px">
      <div style="font-family:${FONT};font-size:14px;font-weight:600;color:${COLORS.charcoal};margin-bottom:6px">${item.title}</div>
      <div style="font-family:${FONT};font-size:13px;color:${COLORS.text};line-height:1.75;white-space:pre-wrap">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>
    </td></tr>`;
  });
  return `${sectionHeading("Narratives & Approach")}${items.join("")}`;
}

function pricingHtml(data: any): string {
  const content = data?.content as any;
  if (!content?.labor_classifications?.length) return "";
  const headerRow = `<tr style="background:${COLORS.bg}">
    <th style="text-align:left;padding:10px 14px;font-family:${FONT};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:${COLORS.textSecondary};font-weight:600">Classification</th>
    <th style="text-align:right;padding:10px 14px;font-family:${FONT};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:${COLORS.textSecondary};font-weight:600">Regular</th>
    <th style="text-align:right;padding:10px 14px;font-family:${FONT};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:${COLORS.textSecondary};font-weight:600">Overtime</th>
    <th style="text-align:right;padding:10px 14px;font-family:${FONT};font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:${COLORS.textSecondary};font-weight:600">Double Time</th>
  </tr>`;
  const rows = content.labor_classifications.map((lc: any) =>
    `<tr style="border-top:1px solid ${COLORS.borderLight}">
      <td style="padding:8px 14px;font-family:${FONT};font-size:13px;font-weight:500;color:${COLORS.charcoal}">${lc.title}</td>
      <td style="text-align:right;padding:8px 14px;font-family:${FONT};font-size:13px;color:${COLORS.text}">$${Number(lc.regular).toLocaleString()}</td>
      <td style="text-align:right;padding:8px 14px;font-family:${FONT};font-size:13px;color:${COLORS.text}">$${Number(lc.overtime).toLocaleString()}</td>
      <td style="text-align:right;padding:8px 14px;font-family:${FONT};font-size:13px;color:${COLORS.text}">$${Number(lc.doubletime).toLocaleString()}</td>
    </tr>`
  ).join("");
  const escalation = content.annual_escalation
    ? `<tr><td colspan="4" style="padding:10px 14px;font-family:${FONT};font-size:12px;color:${COLORS.textSecondary}">Annual escalation: <strong>${(content.annual_escalation * 100).toFixed(0)}%</strong></td></tr>`
    : "";
  return `${sectionHeading("Pricing / Rate Schedule")}
    <tr><td style="padding:4px 0 24px">
      <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${COLORS.borderLight};border-radius:8px;border-collapse:separate;background:${COLORS.white}">
        ${headerRow}${rows}${escalation}
      </table>
    </td></tr>`;
}

function certsHtml(certs: any[]): string {
  if (!certs.length) return "";
  const items = certs.map((item) => {
    const c = item.content as any;
    const expiry = c.expiration_date ? ` — Exp: ${format(new Date(c.expiration_date), "MMM yyyy")}` : "";
    return `<tr><td style="padding:14px 16px;border:1px solid ${COLORS.borderLight};border-radius:8px;background:${COLORS.white}">
      <div style="font-family:${FONT};font-size:15px;font-weight:600;color:${COLORS.charcoal}">${item.title}</div>
      <div style="font-family:${FONT};font-size:12px;color:${COLORS.textSecondary};margin-top:3px">${c.cert_type} #${c.cert_number} — ${c.issuing_agency}${expiry}</div>
    </td></tr>
    <tr><td style="height:8px"></td></tr>`;
  });
  return `${sectionHeading("Certifications & Licenses")}${items.join("")}`;
}

export function buildRfpEmailHtml(data: AssembledContent): string {
  const { rfp, sections, companyInfo, staffBios, notableProjects, narratives, pricing, certs, coverLetter, logoUrl, companyName, companyAddress, companyPhone, companyEmail, companyWebsite } = data;

  const headerParts: string[] = [];
  if (rfp?.rfp_number) headerParts.push(`RFP #${rfp.rfp_number}`);
  if (rfp?.agency) headerParts.push(rfp.agency);
  if (rfp?.due_date) headerParts.push(`Due: ${format(new Date(rfp.due_date), "MMM d, yyyy")}`);

  const sectionRenderers: Record<string, () => string> = {
    cover_letter: () => (coverLetter ? coverLetterHtml(coverLetter) : ""),
    company_info: () => companyInfoHtml(companyInfo),
    staff_bios: () => staffBiosHtml(staffBios),
    org_chart: () => "",
    notable_projects: () => notableProjectsHtml(notableProjects),
    narratives: () => narrativesHtml(narratives),
    pricing: () => pricingHtml(pricing),
    certifications: () => certsHtml(certs),
  };

  const bodyContent = sections.map((s) => sectionRenderers[s]?.() || "").filter(Boolean).join("");

  // Logo header
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName || 'Company'}" style="max-width:240px;max-height:60px;display:block" />`
    : (companyName ? `<div style="font-family:${FONT};font-size:22px;font-weight:700;color:${COLORS.charcoal};letter-spacing:-0.5px">${companyName}</div>` : "");

  // Footer info
  const footerParts: string[] = [];
  if (companyName) footerParts.push(companyName);
  if (companyAddress) footerParts.push(companyAddress);
  if (companyPhone) footerParts.push(companyPhone);
  if (companyEmail) footerParts.push(companyEmail);
  if (companyWebsite) footerParts.push(`<a href="${companyWebsite}" style="color:${COLORS.accentDark};text-decoration:none">${companyWebsite}</a>`);

  return `<div style="font-family:${FONT};max-width:680px;margin:0 auto;background:${COLORS.white};color:${COLORS.text}">
    <!-- Header -->
    <div style="padding:28px 32px 20px;border-bottom:3px solid ${COLORS.accent}">
      ${logoBlock}
    </div>

    <!-- Title bar -->
    <div style="padding:24px 32px 20px">
      <h1 style="margin:0;font-family:${FONT};font-size:20px;font-weight:700;color:${COLORS.charcoal};letter-spacing:-0.3px">RFP Response: ${rfp?.title || "Untitled"}</h1>
      ${headerParts.length ? `<div style="margin-top:8px;font-family:${FONT};font-size:13px;color:${COLORS.textSecondary}">${headerParts.join(" &nbsp;·&nbsp; ")}</div>` : ""}
    </div>

    <!-- Body -->
    <div style="padding:0 32px 32px">
      <table cellpadding="0" cellspacing="0" width="100%">
        ${bodyContent}
      </table>
    </div>

    <!-- Footer -->
    ${footerParts.length ? `<div style="padding:20px 32px;border-top:1px solid ${COLORS.border}">
      <div style="font-family:${FONT};font-size:11px;color:${COLORS.textSecondary};line-height:1.6">${footerParts.join(" &nbsp;·&nbsp; ")}</div>
    </div>` : ""}
  </div>`;
}
