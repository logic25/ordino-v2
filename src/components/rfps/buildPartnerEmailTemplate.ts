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
  const sections: string[] = [];

  // Header
  sections.push(`<div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto;">`);

  if (company.logo_url) {
    sections.push(`<img src="${company.logo_url}" alt="${company.name}" style="max-height:60px; margin-bottom:16px;" />`);
  }

  sections.push(`<h2 style="color:#1a1a1a; margin-bottom:4px;">${config.subjectPrefix}</h2>`);
  sections.push(`<p style="color:#555;">${config.intro}</p>`);

  // RFP Details card
  sections.push(`<table style="width:100%; border:1px solid #e2e2e2; border-radius:8px; border-collapse:separate; margin:16px 0; padding:16px; background:#fafafa;">`);
  sections.push(`<tr><td style="padding:4px 8px;"><strong>RFP Title:</strong></td><td style="padding:4px 8px;">${rfp.title}</td></tr>`);
  if (rfp.rfp_number) sections.push(`<tr><td style="padding:4px 8px;"><strong>RFP #:</strong></td><td style="padding:4px 8px;">${rfp.rfp_number}</td></tr>`);
  if (rfp.issuing_agency) sections.push(`<tr><td style="padding:4px 8px;"><strong>Issuing Agency:</strong></td><td style="padding:4px 8px;">${rfp.issuing_agency}</td></tr>`);
  if (rfp.due_date) sections.push(`<tr><td style="padding:4px 8px;"><strong>Due Date:</strong></td><td style="padding:4px 8px;">${format(new Date(rfp.due_date), "MMMM d, yyyy")}</td></tr>`);
  if (rfp.estimated_value) sections.push(`<tr><td style="padding:4px 8px;"><strong>Est. Value:</strong></td><td style="padding:4px 8px;">$${rfp.estimated_value.toLocaleString()}</td></tr>`);
  if (rfp.original_url) sections.push(`<tr><td style="padding:4px 8px;"><strong>Details:</strong></td><td style="padding:4px 8px;"><a href="${rfp.original_url}">View Original Listing</a></td></tr>`);
  if ((rfp as any).pdf_url) sections.push(`<tr><td style="padding:4px 8px;"><strong>RFP Document:</strong></td><td style="padding:4px 8px;"><a href="${(rfp as any).pdf_url}">📄 Download RFP PDF</a></td></tr>`);
  sections.push(`</table>`);

  if (rfp.service_tags?.length) {
    sections.push(`<p><strong>Required Services:</strong> ${rfp.service_tags.map(t => t.replace(/_/g, " ")).join(", ")}</p>`);
  }

  // Divider
  sections.push(`<hr style="border:none; border-top:1px solid #e2e2e2; margin:24px 0;" />`);

  // Company Mini-Profile
  sections.push(`<h3 style="color:#1a1a1a;">About ${company.name}</h3>`);

  // Company info from Content Library
  const companyInfoItems = contentItems.filter(c => c.content_type === "company_info" || c.content_type === "firm_history");
  if (companyInfoItems.length > 0) {
    const info = companyInfoItems[0];
    const content = info.content as Record<string, string> | null;
    if (content?.description) {
      sections.push(`<p style="color:#555;">${content.description}</p>`);
    } else if (info.title) {
      sections.push(`<p style="color:#555;">${info.title}</p>`);
    }
  }

  // Services — filter by context keywords if applicable
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
    sections.push(`<p><strong>Services We Offer:</strong></p><ul style="color:#555;">`);
    filtered.slice(0, 8).forEach(s => {
      sections.push(`<li>${s.name}${s.description ? ` — ${s.description}` : ""}</li>`);
    });
    sections.push(`</ul>`);
  }

  // Key Staff
  const staffBios = contentItems.filter(c => c.content_type === "staff_bio").slice(0, 3);
  if (staffBios.length > 0) {
    sections.push(`<p><strong>Key Team Members:</strong></p><ul style="color:#555;">`);
    staffBios.forEach(bio => {
      const content = bio.content as Record<string, string> | null;
      const role = content?.role || content?.title || "";
      const creds = content?.credentials || "";
      sections.push(`<li><strong>${bio.title}</strong>${role ? ` — ${role}` : ""}${creds ? ` (${creds})` : ""}</li>`);
    });
    sections.push(`</ul>`);
  }

  // Notable Projects
  if (notableProjects.length > 0) {
    sections.push(`<p><strong>Notable Projects:</strong></p><ul style="color:#555;">`);
    notableProjects.slice(0, 3).forEach(p => {
      const addr = p.properties?.address || "Project";
      const val = p.estimated_value ? ` ($${p.estimated_value.toLocaleString()})` : "";
      sections.push(`<li>${addr}${val}${p.description ? ` — ${p.description}` : ""}</li>`);
    });
    sections.push(`</ul>`);
  }

  // Certifications
  const certs = contentItems.filter(c => c.content_type === "certification");
  if (certs.length > 0) {
    sections.push(`<p><strong>Certifications:</strong> ${certs.map(c => c.title).join(", ")}</p>`);
  }

  // Contact info footer
  sections.push(`<hr style="border:none; border-top:1px solid #e2e2e2; margin:24px 0;" />`);
  sections.push(`<p style="color:#555;">We believe this is a strong opportunity for collaboration. Please let us know if you're interested:</p>`);

  // Response buttons (if outreach token provided)
  if (responseBaseUrl && outreachToken) {
    const interestedUrl = `${responseBaseUrl}?token=${outreachToken}&response=interested`;
    const passUrl = `${responseBaseUrl}?token=${outreachToken}&response=passed`;
    sections.push(`<div style="text-align:center; margin:20px 0;">`);
    sections.push(`<a href="${interestedUrl}" style="display:inline-block; padding:12px 32px; background:#22c55e; color:white; text-decoration:none; border-radius:6px; font-weight:bold; margin-right:12px;">✅ I'm Interested</a>`);
    sections.push(`<a href="${passUrl}" style="display:inline-block; padding:12px 32px; background:#94a3b8; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">Pass</a>`);
    sections.push(`</div>`);
  }

  const contactParts: string[] = [];
  if (company.phone) contactParts.push(`Phone: ${company.phone}`);
  if (company.email) contactParts.push(`Email: ${company.email}`);
  if (company.website) contactParts.push(`Web: <a href="${company.website}">${company.website}</a>`);
  if (contactParts.length > 0) {
    sections.push(`<p style="color:#888; font-size:13px;">${company.name}<br/>${contactParts.join(" | ")}</p>`);
  }

  sections.push(`</div>`);
  return sections.join("\n");
}
