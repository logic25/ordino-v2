import { type COApplication } from "@/components/properties/co/coMockData";

interface DOBJobFiling {
  job__: string;
  doc__: string | null;
  borough: string;
  block: string;
  lot: string;
  bin__: string;
  house__: string;
  street_name: string;
  job_type: string;
  job_status: string;
  job_status_descrp: string;
  latest_action_date: string;
  pre_filing_date: string;
  job_description: string;
  existingoccupancy: string;
  proposedoccupancy: string;
  fully_permitted: string;
  initial_cost: string;
  total_est_fee: string;
  existing_dwelling_units: string;
  proposed_dwelling_units: string;
  owner_s_first_name: string;
  owner_s_last_name: string;
  city: string;
  state: string;
  zip: string;
  // Work type booleans
  plumbing: string;
  mechanical: string;
  sprinkler: string;
  fire_alarm: string;
  equipment: string;
  fire_suppression: string;
  [key: string]: string | null | undefined;
}

interface DOBNowBuild {
  job_filing_number: string;
  bin: string;
  borough: string;
  block: string;
  lot: string;
  house_no: string;
  street_name: string;
  job_type: string;
  filing_status: string;
  filing_date: string;
  job_description?: string;
  work_on_floor?: string;
  initial_cost?: string;
  total_construction_floor_area?: string;
  applicant_first_name?: string;
  applicant_last_name?: string;
  // Work type boolean fields (as "0" or "1")
  sprinkler_work_type?: string;
  plumbing_work_type?: string;
  mechanical_systems_work_type_?: string;
  general_construction_work_type_?: string;
  boiler_equipment_work_type_?: string;
  structural_work_type_?: string;
  earth_work_work_type_?: string;
  foundation_work_type_?: string;
  sidewalk_shed_work_type_?: string;
  [key: string]: string | null | undefined;
}

interface DOBNowElectrical {
  job_filing_number: string;
  job_number: string;
  filing_number: string;
  filing_date: string;
  filing_type: string;
  filing_status: string;
  job_status: string;
  house_number: string;
  street_name: string;
  borough: string;
  block: string;
  lot: string;
  bin: string;
  applicant_first_name?: string;
  applicant_last_name?: string;
  job_description?: string;
  work_on_floor?: string;
  [key: string]: string | null | undefined;
}

// BIS job_status codes — verified against NYC Open Data
// https://data.cityofnewyork.us/resource/ic3t-wcy2.json
const STATUS_MAP: Record<string, string> = {
  "3": "Suspended",
  "A": "Pre-Filing",
  "B": "Application Processed",
  "C": "Application Processed",
  "D": "Application Processed",
  "E": "Application Processed",
  "F": "Plan Exam Assigned",
  "H": "Plan Exam - In Process",
  "J": "Plan Exam - Disapproved",
  "K": "Plan Exam - Partial Approval",
  "L": "PAA - Pending Fee Estimation",
  "P": "Plan Exam - Approved",
  "Q": "Permit Issued - Partial",
  "R": "Permit Issued",
  "U": "Completed",
  "X": "Signed Off",
};

const DOB_NOW_STATUS_MAP: Record<string, string> = {
  "INITIAL": "In Process",
  "IN REVIEW": "In Process",
  "REVIEW COMPLETE": "Approved",
  "APPROVED": "Approved",
  "PERMIT ENTIRE": "Permit Issued",
  "PERMIT ISSUED": "Permit Issued",
  "SIGNED OFF": "Signed Off",
  "DISAPPROVED": "Disapproved",
  "WITHDRAWN": "Withdrawn",
  "OBJECTIONS": "Disapproved",
  "INCOMPLETE": "In Process",
  "COMPLETE": "Signed Off",
  "JOB IS COMPLETE": "Signed Off",
  "JOB IN PROCESS": "In Process",
};

function inferWorkType(filing: DOBJobFiling): string {
  if (filing.fire_alarm === "Y") return "FA";
  if (filing.sprinkler === "Y") return "SP";
  if (filing.fire_suppression === "Y") return "FP";
  if (filing.plumbing === "Y") return "PL";
  if (filing.mechanical === "Y") return "MH";
  if (filing.equipment === "Y") return "EQ";
  return "OT";
}

function inferWorkTypeFromDOBNow(record: DOBNowBuild): string {
  if (record.sprinkler_work_type === "1") return "SP";
  if (record.plumbing_work_type === "1") return "PL";
  if (record.mechanical_systems_work_type_ === "1") return "MH";
  if (record.boiler_equipment_work_type_ === "1") return "MH";
  if (record.structural_work_type_ === "1") return "OT";
  if (record.general_construction_work_type_ === "1") return "OT";
  return "OT";
}

function mapStatus(code: string | null | undefined, descrp?: string | null): string {
  if (!code) return "In Process";
  const mapped = STATUS_MAP[code.trim().toUpperCase()];
  if (mapped) return mapped;
  // Fallback to description if code not recognized
  if (descrp) {
    const d = descrp.trim().toUpperCase();
    if (d.includes("SIGNED OFF")) return "Signed Off";
    if (d.includes("PERMIT ISSUED")) return "Permit Issued";
    if (d.includes("APPROVED")) return "Approved";
    if (d.includes("DISAPPROVED")) return "Disapproved";
    if (d.includes("WITHDRAWN")) return "Withdrawn";
  }
  return "In Process";
}

function mapDOBNowStatus(status: string | null | undefined): string {
  if (!status) return "In Process";
  return DOB_NOW_STATUS_MAP[status.trim().toUpperCase()] || "In Process";
}

function mapElectricalStatus(filingStatus: string | null | undefined, jobStatus: string | null | undefined): string {
  if (filingStatus) {
    const mapped = DOB_NOW_STATUS_MAP[filingStatus.trim().toUpperCase()];
    if (mapped) return mapped;
  }
  if (jobStatus) {
    const mapped = DOB_NOW_STATUS_MAP[jobStatus.trim().toUpperCase()];
    if (mapped) return mapped;
  }
  return "In Process";
}

function inferPriority(status: string, workType: string): "High" | "Medium" | "Low" {
  if (status === "Signed Off" || status === "Withdrawn" || status === "Completed") return "Low";
  if (status === "Permit Issued" && ["FA", "SP", "FP"].includes(workType)) return "High";
  if (status === "Permit Issued") return "Medium";
  if (status === "Approved") return "Medium";
  return "Medium";
}

function inferAction(status: string, workType: string): string {
  if (status === "Signed Off" || status === "Completed") return "Confirm sign-off recorded in BIS";
  if (status === "Withdrawn") return "Confirm withdrawal complete";
  if (status === "Permit Issued" || status === "Permit Issued - Partial") {
    if (workType === "FA") return "FDNY LOA needed. Confirm if work is complete. Distribute LOC forms.";
    if (workType === "SP" || workType === "FP") return "PL sign off needed. Confirm if work is complete.";
    if (workType === "EL") return "Confirm electrical work complete. Schedule inspection.";
    return "Confirm if work is complete. Distribute LOC forms. Request LOC.";
  }
  if (status === "Approved" || status === "Plan Exam - Approved") return "Confirm if work is complete. Send out completion forms.";
  if (status === "PAA - Pending Fee Estimation") return "Await fee estimation for PAA.";
  return "Review status and next steps.";
}

function extractTenant(desc: string): string | null {
  const patterns = [
    /(?:tenant|for)\s*(?:space\s*)?[-–:]?\s*([A-Z][A-Za-z\s'&.]+?)(?:\s+(?:in|at|space|store|\.|$))/i,
    /[-–]\s*([A-Z][A-Za-z\s'&.]+?)(?:\s+Space)/i,
  ];
  for (const p of patterns) {
    const m = desc.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractFloor(desc: string): string {
  const m = desc.match(/(\d+)(?:st|nd|rd|th)\s*floor/i);
  if (m) return m[1];
  const spaceMatch = desc.match(/Space\s*#?(\d)/i);
  if (spaceMatch) return spaceMatch[1];
  return "1";
}

export async function fetchDOBApplications(bin: string): Promise<COApplication[]> {
  const results: COApplication[] = [];

  // Fetch from all four datasets in parallel.
  // DOB NOW Build is queried from BOTH w9ak-ipjd (job application filings) AND rbx6-tga4
  // (the dataset specified in CLAUDE.md). Results are merged & deduped so we catch LAAs
  // and approved permits that may exist in one source but not the other.
  const [jobFilingsRes, dobNowFilingsRes, dobNowPermitsRes, electricalRes] = await Promise.all([
    fetch(`https://data.cityofnewyork.us/resource/ic3t-wcy2.json?bin__=${bin}&$limit=5000&$order=latest_action_date DESC`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [] as DOBJobFiling[]),
    fetch(`https://data.cityofnewyork.us/resource/w9ak-ipjd.json?bin=${bin}&$limit=5000&$order=filing_date DESC`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [] as DOBNowBuild[]),
    fetch(`https://data.cityofnewyork.us/resource/rbx6-tga4.json?bin=${bin}&$limit=5000&$order=filing_date DESC`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [] as DOBNowBuild[]),
    fetch(`https://data.cityofnewyork.us/resource/dm9a-ab7w.json?bin=${bin}&$limit=5000&$order=filing_date DESC`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [] as DOBNowElectrical[]),
  ]);

  // Merge DOB NOW Build results from both datasets, dedup by job_filing_number.
  // Prefer the w9ak-ipjd (application filings) record since it has more fields.
  const dobNowMerged: DOBNowBuild[] = [...(dobNowFilingsRes as DOBNowBuild[])];
  const seenFilingNumbers = new Set(dobNowMerged.map(r => r.job_filing_number).filter(Boolean));
  for (const r of dobNowPermitsRes as DOBNowBuild[]) {
    if (r.job_filing_number && !seenFilingNumbers.has(r.job_filing_number)) {
      seenFilingNumbers.add(r.job_filing_number);
      dobNowMerged.push(r);
    }
  }
  const dobNowRes = dobNowMerged;

  // Map DOB Job Filings (BIS)
  for (const f of jobFilingsRes as DOBJobFiling[]) {
    const workType = inferWorkType(f);
    const status = mapStatus(f.job_status, f.job_status_descrp);
    // Use latest_action_date for sorting, fallback to pre_filing_date
    const bestDate = f.latest_action_date || f.pre_filing_date || "";
    results.push({
      num: 0,
      jobNum: f.job__ || "",
      source: "DOB_JOB_FILINGS",
      fileDate: bestDate ? bestDate.substring(0, 10) : "",
      desc: f.job_description || "",
      tenant: extractTenant(f.job_description || ""),
      floor: extractFloor(f.job_description || ""),
      docNum: f.doc__ || null,
      jobType: f.job_type || "",
      workType,
      status,
      action: inferAction(status, workType),
      assignedTo: null,
      priority: inferPriority(status, workType),
    });
  }

  // Map DOB NOW Build (w9ak-ipjd dataset)
  for (const r of dobNowRes as DOBNowBuild[]) {
    const workType = inferWorkTypeFromDOBNow(r);
    const status = mapDOBNowStatus(r.filing_status);
    const jobNum = (r.job_filing_number || "");
    const desc = r.job_description || r.job_type || "";
    const floorInfo = r.work_on_floor || "";
    results.push({
      num: 0,
      jobNum,
      source: "DOB_NOW_BUILD",
      fileDate: r.filing_date ? r.filing_date.substring(0, 10) : "",
      desc: desc || `${r.job_type || "Alteration"} - ${r.house_no || ""} ${r.street_name || ""}`.trim(),
      tenant: extractTenant(desc),
      floor: floorInfo || extractFloor(desc),
      docNum: null,
      jobType: r.job_type || "",
      workType,
      status,
      action: inferAction(status, workType),
      assignedTo: null,
      priority: inferPriority(status, workType),
    });
  }

  // Map DOB NOW Electrical (dm9a-ab7w dataset)
  for (const r of electricalRes as DOBNowElectrical[]) {
    const status = mapElectricalStatus(r.filing_status, r.job_status);
    const applicant = [r.applicant_first_name, r.applicant_last_name].filter(Boolean).join(" ") || null;
    const desc = r.job_description || `Electrical - ${r.filing_type || ""}`.trim();
    results.push({
      num: 0,
      jobNum: r.job_filing_number || r.job_number || "",
      source: "DOB_NOW_ELECTRICAL",
      fileDate: r.filing_date ? r.filing_date.substring(0, 10) : "",
      desc,
      tenant: extractTenant(desc),
      floor: r.work_on_floor || extractFloor(desc),
      docNum: r.filing_number || null,
      jobType: "EL",
      workType: "EL",
      status,
      action: inferAction(status, "EL"),
      assignedTo: null,
      priority: inferPriority(status, "EL"),
    });
  }

  // Deduplicate: key on job# + doc# (to preserve subsequents/PAAs)
  // If same key exists in both sources, prefer DOB_JOB_FILINGS (more authoritative)
  const seen = new Map<string, number>();
  const deduped: COApplication[] = [];
  for (const r of results) {
    const jobDigits = r.jobNum.replace(/\D/g, "");
    if (!jobDigits) {
      deduped.push(r);
      continue;
    }
    let key: string;
    if (r.source === "DOB_NOW_BUILD" && !r.docNum) {
      key = `NOW-${r.jobNum}`;
    } else if (r.source === "DOB_NOW_ELECTRICAL") {
      key = `EL-${r.jobNum}`;
    } else {
      key = `${jobDigits}-${r.docNum || "01"}`;
    }
    const existing = seen.get(key);
    if (existing !== undefined) {
      // Keep the DOB_JOB_FILINGS version if there's a conflict
      if (r.source === "DOB_JOB_FILINGS" && deduped[existing]?.source === "DOB_NOW_BUILD") {
        deduped[existing] = r;
      }
      // Otherwise skip the duplicate row
    } else {
      seen.set(key, deduped.length);
      deduped.push(r);
    }
  }

  // Sort by file date descending (most recent first), re-number
  deduped.sort((a, b) => (b.fileDate || "").localeCompare(a.fileDate || ""));
  deduped.forEach((r, i) => (r.num = i + 1));

  return deduped;
}
