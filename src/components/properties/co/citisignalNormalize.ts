/**
 * Normalization helpers for CitiSignal / BIS application data
 * Ported from CitiSignal project's PropertyApplicationsTab.tsx
 */

// DOB BIS single-character status codes
const BIS_STATUS_CODES: Record<string, string> = {
  A: "Pre-Filed",
  B: "Application Processing",
  C: "Application Processing",
  D: "Application Processed",
  E: "Application Processed",
  F: "Assigned",
  G: "PAA Fee Due",
  H: "Plan Exam In Process",
  I: "Sign-Off",
  J: "Application Processed",
  K: "Plan Exam Partial Approval",
  L: "PAA Fee Pending",
  M: "PAA Fee Resolved",
  P: "Approved",
  Q: "Partial Permit",
  R: "Permit Issued",
  U: "Completed",
  X: "Signed Off",
  "3": "Suspended",
};

/**
 * Normalize verbose BIS_SCRAPE status strings like "X SIGNED OFF", "P APPROVED"
 */
function normalizeBisScrapedStatus(status: string, description?: string | null): string {
  if (!status) {
    if (description && /withdrawn/i.test(description)) return "Withdrawn";
    return "In Process";
  }
  if (/\(withdrawn\)/i.test(status) || /withdrawn/i.test(status)) return "Withdrawn";
  if (status.toLowerCase() === "unknown") {
    if (description && /withdrawn/i.test(description)) return "Withdrawn";
    return "In Process";
  }
  // Extract leading code letter: "X SIGNED OFF" → "X"
  const codeMatch = status.match(/^([A-Z0-9])\s+/i);
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase();
    return BIS_STATUS_CODES[code] || status;
  }
  // Single char match
  if (status.length <= 2) {
    return BIS_STATUS_CODES[status.toUpperCase()] || status;
  }
  return status;
}

/**
 * Normalize completion-like labels to canonical form
 */
function normalizeCompletionLabel(label: string): string {
  if (!label) return label || "";
  const lower = String(label).toLowerCase();
  if (lower === "loc issued" || lower === "letter of completion") return "Signed Off";
  if (lower === "sign-off" || lower === "signed-off" || lower === "signed off") return "Signed Off";
  if (lower === "complete") return "Completed";
  if (lower === "cancel") return "Cancelled";
  return label;
}

/**
 * Normalize DOB NOW / Socrata status labels
 */
function normalizeStatusLabel(status: string): string {
  if (!status) return "In Process";
  const lower = String(status).toLowerCase().trim();
  if (
    lower === "permitted" ||
    lower === "permit issued" ||
    lower === "permit entire" ||
    lower.startsWith("permit issued")
  ) return "Permit Issued";
  if (lower === "pre-filing" || lower === "prefiling" || lower.startsWith("pre-filing")) return "Pre-Filed";
  if (/^filing\s+/i.test(status)) {
    const rest = status.replace(/^filing\s+/i, "");
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Full status decode — call this on every CitiSignal/BIS application row
 */
export function decodeStatus(
  status: string | null | undefined,
  source: string | null | undefined,
  description?: string | null
): string {
  const src = source || "";
  const safeStatus = status != null ? String(status) : null;
  if (!safeStatus && src === "BIS_SCRAPE") return normalizeBisScrapedStatus("", description);
  if (!safeStatus) return "In Process";
  let decoded: string;
  if (src === "BIS_SCRAPE") {
    decoded = normalizeBisScrapedStatus(safeStatus, description);
  } else if ((src === "DOB BIS" || src === "DOB_JOB_FILINGS" || src === "socrata") && safeStatus.length <= 2) {
    decoded = BIS_STATUS_CODES[safeStatus.toUpperCase()] || safeStatus;
  } else {
    decoded = normalizeStatusLabel(safeStatus);
  }
  return normalizeCompletionLabel(decoded);
}

/**
 * Strip &nbsp;, non-breaking spaces, and junk suffixes from descriptions
 */
export function cleanDescription(desc: string | null | undefined): string {
  if (!desc) return "";
  return desc
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s*—\s*Building Type:\s*OTHERS\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Derive doc number from job_number suffix when doc_number field is missing.
 * E.g. "320514261-02" → "02", "320514261" → "01"
 */
export function deriveDocNumber(
  jobNumber: string | null | undefined,
  explicitDocNum: string | null | undefined
): string {
  // If we already have an explicit doc number, normalize it
  if (explicitDocNum) {
    const match = String(explicitDocNum).trim().match(/\d+/);
    if (match) return match[0].padStart(2, "0");
  }
  if (!jobNumber) return "01";
  const suffixMatch = String(jobNumber).trim().match(/-(\d{1,3})$/);
  if (suffixMatch) return suffixMatch[1].padStart(2, "0");
  return "01";
}

/**
 * Check if an applicant name is stale/garbage data from BIS scraping
 */
export function isStaleApplicant(name: string | null | undefined): boolean {
  if (!name) return true;
  if (/^(GRANTED|DENIED|APPROVED|DISMISSED|DEFAULT)\s/i.test(name)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(name.trim())) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(name.trim())) return true;
  return false;
}

/**
 * Get the best applicant name from a CitiSignal application row
 */
export function getDisplayApplicant(app: Record<string, any>): string | null {
  // Try applicant_name first, then owner_name, then applicant
  const candidates = [
    app.applicant_name,
    app.owner_name,
    app.applicant,
  ];
  for (const c of candidates) {
    if (c && typeof c === "string" && !isStaleApplicant(c)) return c.trim();
  }
  return null;
}

/**
 * Normalize source label for display
 */
export function normalizeSource(source: string | null | undefined): string {
  if (!source) return "DOB_JOB_FILINGS";
  const s = source.toUpperCase();
  if (s === "BIS_SCRAPE" || s === "BIS" || s === "DOB BIS") return "BIS_SCRAPE";
  if (s === "DOB_NOW_BUILD" || s === "DOB_NOW" || s === "DOB NOW BUILD") return "DOB_NOW_BUILD";
  if (s === "DOB_NOW_ELECTRICAL" || s === "ELECTRICAL") return "DOB_NOW_ELECTRICAL";
  if (s === "CITISIGNAL" || s === "SOCRATA") return "DOB_JOB_FILINGS";
  return source;
}
