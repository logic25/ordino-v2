import { type COViolation } from "@/components/properties/co/coMockData";

interface DOBECBViolation {
  isn_dob_bis_extract: string;
  ecb_violation_number?: string;
  ecb_violation_status?: string;
  violation_type?: string;
  violation_description?: string;
  violation_date?: string;
  violation_number?: string;
  penalty_applied?: string;
  penalty_balance_due?: string;
  amount_paid?: string;
  severity?: string;
  respondent_name?: string;
  [key: string]: string | null | undefined;
}

interface DOBComplaint {
  complaint_number?: string;
  status?: string;
  date_entered?: string;
  complaint_category?: string;
  unit?: string;
  disposition_date?: string;
  disposition_code?: string;
  inspection_date?: string;
  [key: string]: string | null | undefined;
}

export interface DOBComplaintRecord {
  complaintNumber: string;
  category: string;
  status: string;
  dateEntered: string;
  dispositionDate: string | null;
  dispositionCode: string | null;
  inspectionDate: string | null;
  unit: string | null;
}

function mapECBStatus(status: string | null | undefined): "Active" | "In Resolution" | "Resolved" | "Dismissed" {
  if (!status) return "Active";
  const s = status.trim().toUpperCase();
  if (s === "RESOLVE" || s === "RESOLVED" || s === "PAID IN FULL") return "Resolved";
  if (s === "DISMISS" || s === "DISMISSED") return "Dismissed";
  if (s === "PENALIZE" || s === "PENALIZED") return "In Resolution";
  if (s === "DEFAULT") return "Active";
  return "Active";
}

function mapPriority(penalty: number | null, status: string): "High" | "Medium" | "Low" {
  if (status === "Resolved" || status === "Dismissed") return "Low";
  if (penalty && penalty > 5000) return "High";
  if (penalty && penalty > 1000) return "Medium";
  return "Medium";
}

export async function fetchDOBViolations(bin: string): Promise<COViolation[]> {
  // Fetch DOB ECB Violations
  const ecbRes = await fetch(
    `https://data.cityofnewyork.us/resource/6bgk-3dad.json?$where=bin='${bin}'&$limit=500`
  ).then(r => r.ok ? r.json() : []).catch(() => [] as DOBECBViolation[]);

  const results: COViolation[] = [];

  for (const v of ecbRes as DOBECBViolation[]) {
    const violationNum = v.ecb_violation_number || v.isn_dob_bis_extract || "";
    const penalty = v.penalty_applied ? parseFloat(v.penalty_applied) : null;
    const status = mapECBStatus(v.ecb_violation_status);
    results.push({
      violationNum,
      type: v.violation_type || "DOB VIOLATION",
      fileDate: v.violation_date ? v.violation_date.substring(0, 10) : "",
      status,
      resolutionPlan: "",
      assignedTo: null,
      priority: mapPriority(penalty, status),
      penalty: isNaN(penalty || 0) ? null : penalty,
    });
  }

  results.sort((a, b) => (b.fileDate || "").localeCompare(a.fileDate || ""));
  return results;
}

export async function fetchDOBComplaints(bin: string): Promise<DOBComplaintRecord[]> {
  const res = await fetch(
    `https://data.cityofnewyork.us/resource/eabe-havv.json?bin='${bin}'&$limit=500`
  ).then(r => r.ok ? r.json() : []).catch(() => [] as DOBComplaint[]);

  // Also try without quotes (some endpoints vary)
  let complaints = res as DOBComplaint[];
  if (complaints.length === 0) {
    const res2 = await fetch(
      `https://data.cityofnewyork.us/resource/eabe-havv.json?bin=${bin}&$limit=500`
    ).then(r => r.ok ? r.json() : []).catch(() => [] as DOBComplaint[]);
    complaints = res2 as DOBComplaint[];
  }

  return complaints.map((c) => ({
    complaintNumber: c.complaint_number || "",
    category: c.complaint_category || "Unknown",
    status: c.status || "Unknown",
    dateEntered: c.date_entered ? c.date_entered.substring(0, 10) : "",
    dispositionDate: c.disposition_date ? c.disposition_date.substring(0, 10) : null,
    dispositionCode: c.disposition_code || null,
    inspectionDate: c.inspection_date ? c.inspection_date.substring(0, 10) : null,
    unit: c.unit || null,
  })).sort((a, b) => (b.dateEntered || "").localeCompare(a.dateEntered || ""));
}
