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
}

const COLORS = {
  accent: "#16a34a",
  info: "#2563eb",
  warning: "#d97706",
  success: "#16a34a",
  muted: "#6b7280",
  border: "#e5e7eb",
  bg: "#f9fafb",
};

function sectionHeading(title: string): string {
  return `<tr><td style="padding:24px 0 12px;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${COLORS.muted};border-bottom:2px solid ${COLORS.border}">${title}</td></tr>`;
}

function coverLetterHtml(text: string): string {
  return `
    ${sectionHeading("Cover Letter")}
    <tr><td style="padding:12px 0 20px;border-left:4px solid ${COLORS.accent};padding-left:16px">
      <div style="font-size:14px;line-height:1.7;color:#1f2937;white-space:pre-wrap">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>
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
    (f) => `<td style="padding:8px 12px;vertical-align:top;width:50%">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.muted};font-weight:600">${f.label}</div>
      <div style="font-size:13px;color:#1f2937;margin-top:2px">${String(f.value)}</div>
    </td>`
  );

  // pair up into 2-column rows
  const tableRows: string[] = [];
  for (let i = 0; i < rows.length; i += 2) {
    tableRows.push(`<tr>${rows[i]}${rows[i + 1] || "<td></td>"}</tr>`);
  }

  return `
    ${sectionHeading("Company Information")}
    <tr><td style="padding:8px 0 20px">
      <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${COLORS.border};border-radius:8px;border-collapse:separate">
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
    return `<tr><td style="padding:10px 14px;border:1px solid ${COLORS.border};border-radius:8px;margin-bottom:8px">
      <div style="font-size:14px;font-weight:600;color:#1f2937">${c.name || "—"}</div>
      <div style="font-size:12px;color:${COLORS.muted};margin-top:2px">${meta.join(" · ")}</div>
      ${c.bio ? `<div style="font-size:13px;color:#374151;margin-top:6px;line-height:1.6">${c.bio}</div>` : ""}
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
      ? `<div style="margin-top:8px;padding:8px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:12px;color:#166534">
          <strong>Reference:</strong> ${proj.reference_contact_name}${proj.reference_contact_title ? `, ${proj.reference_contact_title}` : ""}${proj.reference_contact_phone ? ` — ${proj.reference_contact_phone}` : ""}${proj.reference_contact_email ? ` — ${proj.reference_contact_email}` : ""}
        </div>`
      : "";

    return `<tr><td style="padding:12px 14px;border:1px solid ${COLORS.border};border-left:4px solid ${COLORS.warning};border-radius:8px;margin-bottom:8px">
      <div style="font-size:14px;font-weight:600;color:#1f2937">${title}${isSheet ? ' <span style="font-size:10px;color:' + COLORS.accent + '">[Custom]</span>' : ""}</div>
      ${metaParts.length ? `<div style="font-size:12px;color:${COLORS.muted};margin-top:4px">${metaParts.join(" · ")}</div>` : ""}
      ${proj.description ? `<div style="font-size:13px;color:#374151;margin-top:6px;line-height:1.6">${proj.description}</div>` : ""}
      ${photoHtml.length ? `<table cellpadding="0" cellspacing="0" width="100%" style="margin-top:8px"><tr>${photoHtml.join("")}</tr></table>` : ""}
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
    return `<tr><td style="padding:8px 0 16px;border-left:4px solid ${COLORS.success};padding-left:16px">
      <div style="font-size:14px;font-weight:600;color:#1f2937;margin-bottom:4px">${item.title}</div>
      <div style="font-size:13px;color:#374151;line-height:1.7;white-space:pre-wrap">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</div>
    </td></tr>`;
  });
  return `${sectionHeading("Narratives & Approach")}${items.join("")}`;
}

function pricingHtml(data: any): string {
  const content = data?.content as any;
  if (!content?.labor_classifications?.length) return "";
  const headerRow = `<tr style="background:#f3f4f6">
    <th style="text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:${COLORS.muted}">Classification</th>
    <th style="text-align:right;padding:8px 12px;font-size:11px;text-transform:uppercase;color:${COLORS.muted}">Regular</th>
    <th style="text-align:right;padding:8px 12px;font-size:11px;text-transform:uppercase;color:${COLORS.muted}">Overtime</th>
    <th style="text-align:right;padding:8px 12px;font-size:11px;text-transform:uppercase;color:${COLORS.muted}">Double Time</th>
  </tr>`;
  const rows = content.labor_classifications.map((lc: any) =>
    `<tr style="border-top:1px solid ${COLORS.border}">
      <td style="padding:6px 12px;font-size:13px;font-weight:500">${lc.title}</td>
      <td style="text-align:right;padding:6px 12px;font-size:13px;color:${COLORS.success}">$${Number(lc.regular).toLocaleString()}</td>
      <td style="text-align:right;padding:6px 12px;font-size:13px;color:${COLORS.accent}">$${Number(lc.overtime).toLocaleString()}</td>
      <td style="text-align:right;padding:6px 12px;font-size:13px;color:${COLORS.warning}">$${Number(lc.doubletime).toLocaleString()}</td>
    </tr>`
  ).join("");
  const escalation = content.annual_escalation
    ? `<tr><td colspan="4" style="padding:8px 12px;font-size:12px;color:${COLORS.muted}">Annual escalation: <strong>${(content.annual_escalation * 100).toFixed(0)}%</strong></td></tr>`
    : "";
  return `${sectionHeading("Pricing / Rate Schedule")}
    <tr><td style="padding:8px 0 20px">
      <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${COLORS.border};border-radius:8px;border-collapse:separate">
        ${headerRow}${rows}${escalation}
      </table>
    </td></tr>`;
}

function certsHtml(certs: any[]): string {
  if (!certs.length) return "";
  const items = certs.map((item) => {
    const c = item.content as any;
    const expiry = c.expiration_date ? ` — Exp: ${format(new Date(c.expiration_date), "MMM yyyy")}` : "";
    return `<tr><td style="padding:8px 14px;border:1px solid ${COLORS.border};border-left:4px solid ${COLORS.info};border-radius:8px">
      <div style="font-size:14px;font-weight:600;color:#1f2937">${item.title}</div>
      <div style="font-size:12px;color:${COLORS.muted};margin-top:2px">${c.cert_type} #${c.cert_number} — ${c.issuing_agency}${expiry}</div>
    </td></tr>
    <tr><td style="height:8px"></td></tr>`;
  });
  return `${sectionHeading("Certifications & Licenses")}${items.join("")}`;
}

export function buildRfpEmailHtml(data: AssembledContent): string {
  const { rfp, sections, companyInfo, staffBios, notableProjects, narratives, pricing, certs, coverLetter } = data;

  const headerParts: string[] = [];
  if (rfp?.rfp_number) headerParts.push(`RFP #${rfp.rfp_number}`);
  if (rfp?.agency) headerParts.push(`Agency: ${rfp.agency}`);
  if (rfp?.due_date) headerParts.push(`Due: ${format(new Date(rfp.due_date), "MMM d, yyyy")}`);

  const sectionRenderers: Record<string, () => string> = {
    cover_letter: () => (coverLetter ? coverLetterHtml(coverLetter) : ""),
    company_info: () => companyInfoHtml(companyInfo),
    staff_bios: () => staffBiosHtml(staffBios),
    org_chart: () => "", // org chart is visual-only, skip in email
    notable_projects: () => notableProjectsHtml(notableProjects),
    narratives: () => narrativesHtml(narratives),
    pricing: () => pricingHtml(pricing),
    certifications: () => certsHtml(certs),
  };

  const bodyContent = sections.map((s) => sectionRenderers[s]?.() || "").filter(Boolean).join("");

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;color:#1f2937">
    <div style="background:${COLORS.accent};padding:24px 28px;border-radius:8px 8px 0 0">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff">RFP Response: ${rfp?.title || "Untitled"}</h1>
      ${headerParts.length ? `<div style="margin-top:8px;font-size:13px;color:rgba(255,255,255,0.85)">${headerParts.join(" &nbsp;·&nbsp; ")}</div>` : ""}
    </div>
    <div style="padding:4px 28px 28px">
      <table cellpadding="0" cellspacing="0" width="100%">
        ${bodyContent}
      </table>
    </div>
  </div>`;
}
