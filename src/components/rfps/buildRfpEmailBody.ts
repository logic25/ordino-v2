import { format } from "date-fns";
import { getProjectPhotoEmailUrls } from "@/hooks/useProjectSheets";
import type { Rfp } from "@/hooks/useRfps";

interface AssembledContent {
  rfp: Rfp | null;
  sections: string[];
  companyInfo: any;
  staffBios: any[];
  notableProjects: any[];
  narratives: any[];
  firmHistory: any[];
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

/* ── Brand palette ── */
const C = {
  accent: "#b5cc18",
  charcoal: "#1a1a1a",
  text: "#333333",
  secondary: "#888888",
  rule: "#e0e0e0",
  ruleLight: "#f0f0f0",
  bg: "#f8f8f8",
  white: "#ffffff",
};

const F = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/* ── Helpers ── */
function heading(title: string): string {
  return `<tr><td style="padding:36px 0 14px">
    <div style="font-family:${F};font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.secondary}">${title}</div>
    <div style="margin-top:8px;height:1px;background:${C.rule}"></div>
  </td></tr>`;
}

function pill(label: string): string {
  return `<span style="display:inline-block;font-family:${F};font-size:10px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:${C.charcoal};background:${C.bg};border:1px solid ${C.rule};border-radius:100px;padding:3px 10px;margin-right:6px">${label}</span>`;
}

/* ── Section renderers ── */

function coverLetterHtml(text: string): string {
  return `
    ${heading("Cover Letter")}
    <tr><td style="padding:4px 0 28px">
      <div style="font-family:${F};font-size:14px;line-height:1.8;color:${C.text};white-space:pre-wrap">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>
    </td></tr>`;
}

function firmOverviewHtml(firmHistory: any[]): string {
  if (!firmHistory.length) return "";
  // Combine all firm_history entries into one flowing overview
  const blocks = firmHistory.map((item) => {
    const text = (item.content as any)?.text || "";
    const title = item.title || "";
    return `${title ? `<div style="font-family:${F};font-size:15px;font-weight:600;color:${C.charcoal};margin-bottom:6px">${title}</div>` : ""}
      <div style="font-family:${F};font-size:14px;line-height:1.8;color:${C.text};margin-bottom:16px;white-space:pre-wrap">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>`;
  });
  return `
    ${heading("About Our Firm")}
    <tr><td style="padding:4px 0 12px">
      ${blocks.join("")}
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
    { label: "Employees", value: content.staff_count },
    { label: "Website", value: content.website },
  ].filter((f) => f.value);
  if (!fields.length) return "";

  const rows = fields.map(
    (f) => `<td style="padding:12px 20px;vertical-align:top;width:50%">
      <div style="font-family:${F};font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${C.secondary};font-weight:600">${f.label}</div>
      <div style="font-family:${F};font-size:14px;color:${C.charcoal};margin-top:4px;font-weight:500">${String(f.value)}</div>
    </td>`
  );

  const tableRows: string[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    const border = i > 0 ? `border-top:1px solid ${C.ruleLight};` : "";
    tableRows.push(`<tr style="${border}">${rows[i]}${rows[i + 1] || "<td></td>"}</tr>`);
  }

  return `
    ${heading("Company Details")}
    <tr><td style="padding:4px 0 28px">
      <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${C.rule};border-radius:12px;border-collapse:separate;overflow:hidden">
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
    if (c.years_experience) meta.push(`${c.years_experience} years`);
    if (c.hourly_rate) meta.push(`$${Number(c.hourly_rate).toLocaleString()}/hr`);
    return `<tr><td style="padding:16px 20px;border:1px solid ${C.rule};border-radius:12px">
      <div style="font-family:${F};font-size:15px;font-weight:600;color:${C.charcoal};letter-spacing:-0.2px">${c.name || "—"}</div>
      <div style="font-family:${F};font-size:12px;color:${C.secondary};margin-top:4px">${meta.join(" · ")}</div>
      ${c.bio ? `<div style="font-family:${F};font-size:13px;color:${C.text};margin-top:10px;line-height:1.7">${c.bio}</div>` : ""}
    </td></tr>
    <tr><td style="height:10px"></td></tr>`;
  });
  return `${heading("Key Personnel")}${items.join("")}`;
}

function notableProjectsHtml(projects: any[], photoUrls: Map<string, string>): string {
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
      const url = photoUrls.get(p) || "";
      return `<td style="width:25%;padding:4px"><img src="${url}" alt="Project photo" style="width:100%;border-radius:8px;display:block" /></td>`;
    });

    const refHtml = proj.reference_contact_name
      ? `<div style="margin-top:12px;padding:10px 14px;background:${C.bg};border:1px solid ${C.ruleLight};border-radius:8px;font-family:${F};font-size:12px;color:${C.text}">
          <strong style="color:${C.charcoal}">Reference:</strong> ${proj.reference_contact_name}${proj.reference_contact_title ? `, ${proj.reference_contact_title}` : ""}${proj.reference_contact_phone ? ` — ${proj.reference_contact_phone}` : ""}${proj.reference_contact_email ? ` — ${proj.reference_contact_email}` : ""}
        </div>`
      : "";

    return `<tr><td style="padding:18px 20px;border:1px solid ${C.rule};border-radius:12px">
      <div style="font-family:${F};font-size:15px;font-weight:600;color:${C.charcoal};letter-spacing:-0.2px">${title}${isSheet ? ' <span style="font-size:10px;color:' + C.accent + ';font-weight:500">[Custom]</span>' : ""}</div>
      ${metaParts.length ? `<div style="font-family:${F};font-size:12px;color:${C.secondary};margin-top:4px">${metaParts.join(" · ")}</div>` : ""}
      ${proj.description ? `<div style="font-family:${F};font-size:13px;color:${C.text};margin-top:10px;line-height:1.7">${proj.description}</div>` : ""}
      ${photoHtml.length ? `<table cellpadding="0" cellspacing="0" width="100%" style="margin-top:12px"><tr>${photoHtml.join("")}</tr></table>` : ""}
      ${refHtml}
    </td></tr>
    <tr><td style="height:10px"></td></tr>`;
  });
  return `${heading("Notable Projects & References")}${items.join("")}`;
}

function narrativesHtml(narratives: any[]): string {
  if (!narratives.length) return "";
  const items = narratives.map((item) => {
    const text = (item.content as any)?.text || "";
    return `<tr><td style="padding:8px 0 20px">
      <div style="font-family:${F};font-size:15px;font-weight:600;color:${C.charcoal};margin-bottom:6px;letter-spacing:-0.2px">${item.title}</div>
      <div style="font-family:${F};font-size:13px;color:${C.text};line-height:1.8;white-space:pre-wrap">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>
    </td></tr>`;
  });
  return `${heading("Narratives & Approach")}${items.join("")}`;
}

function pricingHtml(data: any): string {
  const content = data?.content as any;
  if (!content?.labor_classifications?.length) return "";
  const thStyle = `text-align:left;padding:12px 16px;font-family:${F};font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${C.secondary};font-weight:600;border-bottom:1px solid ${C.rule}`;
  const headerRow = `<tr>
    <th style="${thStyle}">Classification</th>
    <th style="${thStyle};text-align:right">Regular</th>
    <th style="${thStyle};text-align:right">Overtime</th>
    <th style="${thStyle};text-align:right">Double Time</th>
  </tr>`;
  const rows = content.labor_classifications.map((lc: any, i: number) => {
    const bg = i % 2 === 0 ? C.white : C.bg;
    return `<tr style="background:${bg}">
      <td style="padding:10px 16px;font-family:${F};font-size:13px;font-weight:500;color:${C.charcoal}">${lc.title}</td>
      <td style="text-align:right;padding:10px 16px;font-family:${F};font-size:13px;color:${C.text}">$${Number(lc.regular).toLocaleString()}</td>
      <td style="text-align:right;padding:10px 16px;font-family:${F};font-size:13px;color:${C.text}">$${Number(lc.overtime).toLocaleString()}</td>
      <td style="text-align:right;padding:10px 16px;font-family:${F};font-size:13px;color:${C.text}">$${Number(lc.doubletime).toLocaleString()}</td>
    </tr>`;
  }).join("");
  const escalation = content.annual_escalation
    ? `<tr><td colspan="4" style="padding:10px 16px;font-family:${F};font-size:12px;color:${C.secondary};border-top:1px solid ${C.rule}">Annual Escalation: <strong style="color:${C.charcoal}">${(content.annual_escalation * 100).toFixed(0)}%</strong></td></tr>`
    : "";
  return `${heading("Pricing / Rate Schedule")}
    <tr><td style="padding:4px 0 28px">
      <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${C.rule};border-radius:12px;border-collapse:separate;overflow:hidden">
        ${headerRow}${rows}${escalation}
      </table>
    </td></tr>`;
}

function certsHtml(certs: any[]): string {
  if (!certs.length) return "";
  const items = certs.map((item) => {
    const c = item.content as any;
    const expiry = c.expiration_date ? ` · Exp: ${format(new Date(c.expiration_date), "MMM yyyy")}` : "";
    return `<tr><td style="padding:14px 20px;border:1px solid ${C.rule};border-radius:12px">
      <div style="font-family:${F};font-size:15px;font-weight:600;color:${C.charcoal};letter-spacing:-0.2px">${item.title}</div>
      <div style="font-family:${F};font-size:12px;color:${C.secondary};margin-top:4px">${c.cert_type} #${c.cert_number} · ${c.issuing_agency}${expiry}</div>
    </td></tr>
    <tr><td style="height:10px"></td></tr>`;
  });
  return `${heading("Certifications & Licenses")}${items.join("")}`;
}

/* ── Main builder ── */

export async function buildRfpEmailHtml(data: AssembledContent): Promise<string> {
  const { rfp, sections, companyInfo, staffBios, notableProjects, narratives, firmHistory, pricing, certs, coverLetter, logoUrl, companyName, companyAddress, companyPhone, companyEmail, companyWebsite } = data;

  // Pre-resolve signed URLs for all notable-project photos. The bucket is
  // private; emails go to external partners, so we mint year-long signed URLs.
  const allPhotoPaths = Array.from(new Set(
    (notableProjects || []).flatMap((p: any) => (p.photos || []) as string[])
      .filter((p: string) => p && !p.endsWith(".pdf"))
  ));
  const photoUrls = await getProjectPhotoEmailUrls(allPhotoPaths);

  const sectionRenderers: Record<string, () => string> = {
    cover_letter: () => (coverLetter ? coverLetterHtml(coverLetter) : ""),
    firm_overview: () => firmOverviewHtml(firmHistory),
    company_info: () => companyInfoHtml(companyInfo),
    staff_bios: () => staffBiosHtml(staffBios),
    org_chart: () => "",
    notable_projects: () => notableProjectsHtml(notableProjects, photoUrls),
    narratives: () => narrativesHtml(narratives),
    pricing: () => pricingHtml(pricing),
    certifications: () => certsHtml(certs),
  };

  const bodyContent = sections.map((s) => sectionRenderers[s]?.() || "").filter(Boolean).join("");

  // Header: logo or company name
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName || 'Company'}" style="max-width:320px;max-height:72px;display:block" />`
    : (companyName ? `<div style="font-family:${F};font-size:20px;font-weight:700;color:${C.charcoal};letter-spacing:-0.5px">${companyName}</div>` : "");

  // RFP meta pills
  const pills: string[] = [];
  if (rfp?.rfp_number) pills.push(pill(`RFP #${rfp.rfp_number}`));
  if (rfp?.agency) pills.push(pill(rfp.agency));
  if (rfp?.due_date) pills.push(pill(`Due ${format(new Date(rfp.due_date), "MMM d, yyyy")}`));

  // Footer
  const footerItems: string[] = [];
  if (companyName) footerItems.push(companyName);
  if (companyAddress) footerItems.push(companyAddress);
  if (companyPhone) footerItems.push(companyPhone);
  if (companyEmail) footerItems.push(companyEmail);
  if (companyWebsite) footerItems.push(`<a href="${companyWebsite}" style="color:${C.charcoal};text-decoration:none">${companyWebsite.replace(/^https?:\/\//, "")}</a>`);

  return `<div style="font-family:${F};max-width:640px;margin:0 auto;background:${C.white};color:${C.text}">

    <!-- Logo bar -->
    <div style="padding:32px 40px 24px">
      ${logoBlock}
    </div>

    <!-- Accent line -->
    <div style="height:3px;background:${C.accent}"></div>

    <!-- Title block -->
    <div style="padding:32px 40px 8px">
      <h1 style="margin:0;font-family:${F};font-size:22px;font-weight:700;color:${C.charcoal};letter-spacing:-0.5px;line-height:1.3">${rfp?.title || "RFP Response"}</h1>
      ${pills.length ? `<div style="margin-top:14px">${pills.join("")}</div>` : ""}
    </div>

    <!-- Content -->
    <div style="padding:0 40px 40px">
      <table cellpadding="0" cellspacing="0" width="100%">
        ${bodyContent}
      </table>
    </div>

    <!-- Footer -->
    ${footerItems.length ? `
    <div style="border-top:1px solid ${C.rule};padding:24px 40px">
      <div style="font-family:${F};font-size:11px;color:${C.secondary};line-height:1.8">${footerItems.join(" &nbsp;·&nbsp; ")}</div>
    </div>` : ""}

  </div>`;
}
