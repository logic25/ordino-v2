import { format } from "date-fns";
import type { DiscoveredRfp } from "@/hooks/useDiscoveredRfps";
import type { CompanySettings } from "@/hooks/useCompanySettings";
import type { RfpContent } from "@/hooks/useRfpContent";
import type { PartnerOutreach } from "@/hooks/usePartnerOutreach";

interface CompanyInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
}

interface NotableProject {
  description?: string | null;
  estimated_value?: number | null;
  properties?: { address?: string; borough?: string } | null;
}

interface StaffBio {
  title: string;
  content: Record<string, unknown>;
}

type RfpContext = "ll11_support" | "environmental" | "construction" | "general";

function detectRfpContext(rfp: DiscoveredRfp): RfpContext {
  const haystack = [
    rfp.title,
    ...(rfp.service_tags || []),
    rfp.relevance_reason || "",
  ]
    .join(" ")
    .toLowerCase();

  if (/\bll\s?11\b|fisp|facade\s+inspection|facade\s+filing/.test(haystack)) return "ll11_support";
  if (/\benvironmental\b|asbestos|lead\s+abatement|phase\s+[i1]|hazmat/.test(haystack)) return "environmental";
  if (/\bconstruction\b|renovation|build\b|general\s+contract/.test(haystack)) return "construction";
  return "general";
}

const contextConfig: Record<RfpContext, { subjectPrefix: string; intro: string; serviceKeywords: string[] }> = {
  ll11_support: {
    subjectPrefix: "LL11/FISP Support Opportunity",
    intro: "We'd like to offer our firm's inspection and filing support for this upcoming LL11/FISP requirement. Our team has extensive experience with facade compliance and DOB filings:",
    serviceKeywords: ["facade", "inspection", "filing", "ll11", "fisp", "dob", "compliance"],
  },
  environmental: {
    subjectPrefix: "Environmental Services Support",
    intro: "We'd like to partner on the environmental services component of this opportunity. Our firm specializes in testing, abatement oversight, and regulatory compliance:",
    serviceKeywords: ["environmental", "asbestos", "lead", "abatement", "testing", "hazmat", "phase"],
  },
  construction: {
    subjectPrefix: "Construction Partnership Opportunity",
    intro: "We'd like to collaborate on this construction opportunity. Our team brings strong project management and expediting capabilities:",
    serviceKeywords: ["construction", "renovation", "expediting", "permit", "project management"],
  },
  general: {
    subjectPrefix: "Partnership Opportunity",
    intro: "We'd like to invite your firm to collaborate on the following RFP:",
    serviceKeywords: [],
  },
};

export function buildPartnerEmailSubject(rfp: DiscoveredRfp): string {
  const ctx = detectRfpContext(rfp);
  return `${contextConfig[ctx].subjectPrefix}: ${rfp.title}`;
}

export function buildPartnerEmailBody(
  rfp: DiscoveredRfp,
  company: CompanyInfo,
  settings: CompanySettings | null,
  contentItems: RfpContent[],
  notableProjects: NotableProject[],
  responseBaseUrl?: string,
  outreachToken?: string,
): string {
  const ctx = detectRfpContext(rfp);
  const config = contextConfig[ctx];
  const lines: string[] = [];

  const wrap = `font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; color: #333; line-height: 1.6;`;
  const cardStyle = `background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0;`;
  const labelStyle = `color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 2px 0;`;
  const valueStyle = `color: #222; font-size: 14px; margin: 0 0 12px 0;`;
  const sectionHeadingStyle = `font-size: 16px; color: #222; margin: 28px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #e0e0e0;`;
  const hrStyle = `border: none; border-top: 1px solid #e8e8e8; margin: 28px 0;`;

  // Outer wrapper
  lines.push(`<div style="${wrap}">`);

  // Logo
  if (company.logo_url) {
    lines.push(`<img src="${company.logo_url}" alt="${company.name}" style="max-height: 50px; margin-bottom: 20px;" />`);
  }

  // Intro
  lines.push(`<h2 style="font-size: 20px; color: #111; margin: 0 0 8px 0;">${config.subjectPrefix}</h2>`);
  lines.push(`<p style="color: #555; font-size: 14px; margin: 0 0 24px 0;">${config.intro}</p>`);

  // RFP Details card
  lines.push(`<div style="${cardStyle}">`);
  lines.push(`<h3 style="font-size: 14px; color: #111; margin: 0 0 16px 0;">RFP Details</h3>`);

  lines.push(`<p style="${labelStyle}">Title</p>`);
  lines.push(`<p style="${valueStyle}">${rfp.title}</p>`);

  if (rfp.rfp_number) {
    lines.push(`<p style="${labelStyle}">RFP Number</p>`);
    lines.push(`<p style="${valueStyle}">${rfp.rfp_number}</p>`);
  }

  // Two-column row for agency + due date
  const hasAgency = !!rfp.issuing_agency;
  const hasDueDate = !!rfp.due_date;
  if (hasAgency || hasDueDate) {
    lines.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 12px;"><tr>`);
    if (hasAgency) {
      lines.push(`<td style="vertical-align: top; width: 50%;"><p style="${labelStyle}">Issuing Agency</p><p style="${valueStyle}">${rfp.issuing_agency}</p></td>`);
    }
    if (hasDueDate) {
      lines.push(`<td style="vertical-align: top; width: 50%;"><p style="${labelStyle}">Due Date</p><p style="${valueStyle}">${format(new Date(rfp.due_date!), "MMMM d, yyyy")}</p></td>`);
    }
    lines.push(`</tr></table>`);
  }

  // Value + links row
  const hasValue = !!rfp.estimated_value;
  const hasUrl = !!rfp.original_url;
  if (hasValue || hasUrl) {
    lines.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;"><tr>`);
    if (hasValue) {
      lines.push(`<td style="vertical-align: top; width: 50%;"><p style="${labelStyle}">Estimated Value</p><p style="color: #16a34a; font-size: 16px; font-weight: bold; margin: 0;">$${rfp.estimated_value!.toLocaleString()}</p></td>`);
    }
    if (hasUrl) {
      lines.push(`<td style="vertical-align: top; width: 50%;"><p style="${labelStyle}">Original Listing</p><p style="${valueStyle}"><a href="${rfp.original_url}" style="color: #2563eb; text-decoration: underline;">View Listing</a></p></td>`);
    }
    lines.push(`</tr></table>`);
  }

  if ((rfp as any).pdf_url) {
    lines.push(`<p style="${labelStyle}">RFP Document</p>`);
    lines.push(`<p style="${valueStyle}"><a href="${(rfp as any).pdf_url}" style="color: #2563eb; text-decoration: underline;">Download RFP PDF</a></p>`);
  }

  lines.push(`</div>`); // end card

  if (rfp.service_tags?.length) {
    lines.push(`<p style="font-size: 13px; color: #555; margin: 16px 0;"><strong>Required Services:</strong> ${rfp.service_tags.map(t => t.replace(/_/g, " ")).join(", ")}</p>`);
  }

  // Response Buttons — prominent, separated
  if (responseBaseUrl && outreachToken) {
    const interestedUrl = `${responseBaseUrl}?token=${outreachToken}&response=interested`;
    const passUrl = `${responseBaseUrl}?token=${outreachToken}&response=passed`;
    lines.push(`<div style="text-align: center; margin: 32px 0; padding: 24px 0; border-top: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8;">`);
    lines.push(`<p style="font-size: 14px; color: #555; margin: 0 0 16px 0;">Are you interested in partnering on this opportunity?</p>`);
    lines.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;"><tr>`);
    lines.push(`<td style="padding-right: 20px;"><a href="${interestedUrl}" style="display: inline-block; padding: 14px 40px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; letter-spacing: 0.3px;">I'm Interested</a></td>`);
    lines.push(`<td><a href="${passUrl}" style="display: inline-block; padding: 14px 40px; background-color: #e2e8f0; color: #475569; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; letter-spacing: 0.3px;">Pass</a></td>`);
    lines.push(`</tr></table>`);
    lines.push(`</div>`);
  }

  // Company Profile Section
  lines.push(`<h3 style="${sectionHeadingStyle}">About ${company.name}</h3>`);

  const companyInfoItems = contentItems.filter(c => c.content_type === "company_info" || c.content_type === "firm_history");
  if (companyInfoItems.length > 0) {
    const info = companyInfoItems[0];
    const content = info.content as Record<string, string> | null;
    const text = content?.description || info.title;
    if (text) lines.push(`<p style="color: #555; font-size: 14px; margin: 0 0 16px 0;">${text}</p>`);
  }

  // Services
  const serviceCatalog = settings?.service_catalog;
  if (serviceCatalog && serviceCatalog.length > 0) {
    let filtered = serviceCatalog;
    if (config.serviceKeywords.length > 0) {
      const kw = config.serviceKeywords;
      const matched = serviceCatalog.filter(s =>
        kw.some(k => s.name.toLowerCase().includes(k) || (s.description || "").toLowerCase().includes(k))
      );
      if (matched.length > 0) filtered = matched;
    }
    lines.push(`<p style="font-size: 13px; font-weight: bold; color: #333; margin: 16px 0 8px 0;">Services We Offer</p>`);
    lines.push(`<ul style="color: #555; font-size: 13px; margin: 0; padding-left: 20px;">`);
    filtered.slice(0, 6).forEach(s => {
      lines.push(`<li style="margin-bottom: 4px;">${s.name}${s.description ? ` — ${s.description}` : ""}</li>`);
    });
    lines.push(`</ul>`);
  }

  // Key Staff
  const staffBios = contentItems.filter(c => c.content_type === "staff_bio").slice(0, 3);
  if (staffBios.length > 0) {
    lines.push(`<p style="font-size: 13px; font-weight: bold; color: #333; margin: 20px 0 8px 0;">Key Team Members</p>`);
    lines.push(`<ul style="color: #555; font-size: 13px; margin: 0; padding-left: 20px;">`);
    staffBios.forEach(bio => {
      const content = bio.content as Record<string, string> | null;
      const role = content?.role || content?.title || "";
      const creds = content?.credentials || "";
      lines.push(`<li style="margin-bottom: 4px;"><strong>${bio.title}</strong>${role ? ` — ${role}` : ""}${creds ? ` (${creds})` : ""}</li>`);
    });
    lines.push(`</ul>`);
  }

  // Notable Projects
  if (notableProjects.length > 0) {
    lines.push(`<p style="font-size: 13px; font-weight: bold; color: #333; margin: 20px 0 8px 0;">Notable Projects</p>`);
    lines.push(`<ul style="color: #555; font-size: 13px; margin: 0; padding-left: 20px;">`);
    notableProjects.slice(0, 3).forEach(p => {
      const addr = p.properties?.address || "Project";
      const val = p.estimated_value ? ` ($${p.estimated_value.toLocaleString()})` : "";
      lines.push(`<li style="margin-bottom: 4px;">${addr}${val}${p.description ? ` — ${p.description}` : ""}</li>`);
    });
    lines.push(`</ul>`);
  }

  // Certifications
  const certs = contentItems.filter(c => c.content_type === "certification");
  if (certs.length > 0) {
    lines.push(`<p style="font-size: 13px; color: #555; margin: 20px 0 8px 0;"><strong>Certifications:</strong> ${certs.map(c => c.title).join(", ")}</p>`);
  }

  // Footer
  lines.push(`<hr style="${hrStyle}" />`);
  const contactParts: string[] = [];
  if (company.phone) contactParts.push(company.phone);
  if (company.email) contactParts.push(`<a href="mailto:${company.email}" style="color: #2563eb;">${company.email}</a>`);
  if (company.website) contactParts.push(`<a href="${company.website.startsWith("http") ? company.website : `https://${company.website}`}" style="color: #2563eb;">${company.website}</a>`);
  lines.push(`<p style="color: #999; font-size: 12px; margin: 0;">${company.name}${contactParts.length ? `<br/>${contactParts.join(" &middot; ")}` : ""}</p>`);

  lines.push(`</div>`);
  return lines.join("\n");
}
