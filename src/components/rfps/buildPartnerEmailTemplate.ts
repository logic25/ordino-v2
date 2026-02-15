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

type RfpContext = "ll11_support" | "environmental" | "construction" | "general";

function detectRfpContext(rfp: DiscoveredRfp): RfpContext {
  const haystack = [rfp.title, ...(rfp.service_tags || []), rfp.relevance_reason || ""].join(" ").toLowerCase();
  if (/\bll\s?11\b|fisp|facade\s+inspection|facade\s+filing/.test(haystack)) return "ll11_support";
  if (/\benvironmental\b|asbestos|lead\s+abatement|phase\s+[i1]|hazmat/.test(haystack)) return "environmental";
  if (/\bconstruction\b|renovation|build\b|general\s+contract/.test(haystack)) return "construction";
  return "general";
}

const contextConfig: Record<RfpContext, { subjectPrefix: string; intro: string; serviceKeywords: string[] }> = {
  ll11_support: {
    subjectPrefix: "LL11/FISP Support Opportunity",
    intro: "We'd like to offer our firm's inspection and filing support for this upcoming LL11/FISP requirement. Our team has extensive experience with facade compliance and DOB filings.",
    serviceKeywords: ["facade", "inspection", "filing", "ll11", "fisp", "dob", "compliance"],
  },
  environmental: {
    subjectPrefix: "Environmental Services Support",
    intro: "We'd like to partner on the environmental services component of this opportunity. Our firm specializes in testing, abatement oversight, and regulatory compliance.",
    serviceKeywords: ["environmental", "asbestos", "lead", "abatement", "testing", "hazmat", "phase"],
  },
  construction: {
    subjectPrefix: "Construction Partnership Opportunity",
    intro: "We'd like to collaborate on this construction opportunity. Our team brings strong project management and expediting capabilities.",
    serviceKeywords: ["construction", "renovation", "expediting", "permit", "project management"],
  },
  general: {
    subjectPrefix: "Partnership Opportunity",
    intro: "We'd like to invite your firm to collaborate on the following RFP.",
    serviceKeywords: [],
  },
};

export function buildPartnerEmailSubject(rfp: DiscoveredRfp): string {
  const ctx = detectRfpContext(rfp);
  return `${contextConfig[ctx].subjectPrefix}: ${rfp.title}`;
}

/**
 * Builds a Tiptap-safe body (only p, strong, em, a, ul/ol/li).
 * This is what the user edits in the composer.
 * The styled version for the actual email is built at send time via wrapEmailForSending().
 */
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
  const l: string[] = [];

  // Greeting & intro
  l.push(`<p>${config.intro}</p>`);

  // RFP Details — simple bold label: value format
  l.push(`<p><strong>RFP Details</strong></p>`);
  l.push(`<p><strong>Title:</strong> ${rfp.title}</p>`);
  if (rfp.rfp_number) l.push(`<p><strong>RFP #:</strong> ${rfp.rfp_number}</p>`);
  if (rfp.issuing_agency) l.push(`<p><strong>Agency:</strong> ${rfp.issuing_agency}</p>`);
  if (rfp.due_date) l.push(`<p><strong>Due Date:</strong> ${format(new Date(rfp.due_date), "MMMM d, yyyy")}</p>`);
  if (rfp.estimated_value) l.push(`<p><strong>Est. Value:</strong> $${rfp.estimated_value.toLocaleString()}</p>`);
  if (rfp.original_url) l.push(`<p><a href="${rfp.original_url}">View Original Listing</a></p>`);
  if ((rfp as any).pdf_url) l.push(`<p><a href="${(rfp as any).pdf_url}">Download RFP PDF</a></p>`);

  if (rfp.service_tags?.length) {
    l.push(`<p><strong>Required Services:</strong> ${rfp.service_tags.map(t => t.replace(/_/g, " ")).join(", ")}</p>`);
  }

  // Response links
  if (responseBaseUrl && outreachToken) {
    const interestedUrl = `${responseBaseUrl}?token=${outreachToken}&response=interested`;
    const passUrl = `${responseBaseUrl}?token=${outreachToken}&response=passed`;
    l.push(`<p>Please let us know if you'd like to collaborate:</p>`);
    l.push(`<p><a href="${interestedUrl}"><strong>I'm Interested</strong></a> &nbsp; | &nbsp; <a href="${passUrl}">Pass</a></p>`);
  }

  // Company section
  const companyInfoItems = contentItems.filter(c => c.content_type === "company_info" || c.content_type === "firm_history");
  if (companyInfoItems.length > 0) {
    const info = companyInfoItems[0];
    const content = info.content as Record<string, string> | null;
    const text = content?.description || content?.text || null;
    if (text) {
      l.push(`<p><strong>About ${company.name}</strong></p>`);
      l.push(`<p>${text}</p>`);
    }
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
    l.push(`<p><strong>Our Services</strong></p>`);
    l.push(`<ul>`);
    filtered.slice(0, 6).forEach(s => {
      l.push(`<li>${s.name}${s.description ? ` — ${s.description}` : ""}</li>`);
    });
    l.push(`</ul>`);
  }

  // Key Staff
  const staffBios = contentItems.filter(c => c.content_type === "staff_bio").slice(0, 3);
  if (staffBios.length > 0) {
    l.push(`<p><strong>Key Team Members</strong></p>`);
    l.push(`<ul>`);
    staffBios.forEach(bio => {
      const content = bio.content as Record<string, string> | null;
      const role = content?.role || content?.title || "";
      const creds = content?.credentials || "";
      l.push(`<li><strong>${bio.title}</strong>${role ? ` — ${role}` : ""}${creds ? ` (${creds})` : ""}</li>`);
    });
    l.push(`</ul>`);
  }

  // Notable Projects
  if (notableProjects.length > 0) {
    l.push(`<p><strong>Notable Projects</strong></p>`);
    l.push(`<ul>`);
    notableProjects.slice(0, 3).forEach(p => {
      const addr = p.properties?.address || "Project";
      const val = p.estimated_value ? ` ($${p.estimated_value.toLocaleString()})` : "";
      l.push(`<li>${addr}${val}${p.description ? ` — ${p.description}` : ""}</li>`);
    });
    l.push(`</ul>`);
  }

  // Certifications
  const certs = contentItems.filter(c => c.content_type === "certification");
  if (certs.length > 0) {
    l.push(`<p><strong>Certifications:</strong> ${certs.map(c => c.title).join(", ")}</p>`);
  }

  // Sign-off
  const contactParts: string[] = [];
  if (company.phone) contactParts.push(company.phone);
  if (company.email) contactParts.push(company.email);
  if (company.website) contactParts.push(company.website);
  l.push(`<p>${company.name}${contactParts.length ? `<br/>${contactParts.join(" | ")}` : ""}</p>`);

  return l.join("\n");
}

/**
 * Wraps the Tiptap-edited body in a professional styled email template for actual sending.
 * Called at send time — not in the composer.
 */
export function wrapEmailForSending(body: string, logoUrl?: string | null): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:Arial, Helvetica, sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px; background:#ffffff; border-radius:8px; overflow:hidden;">
${logoUrl ? `<tr><td style="padding:24px 32px 0 32px;"><img src="${logoUrl}" alt="Company Logo" style="max-height:48px;" /></td></tr>` : ""}
<tr><td style="padding:24px 32px 32px 32px; font-size:14px; line-height:1.7; color:#333;">
${body}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
