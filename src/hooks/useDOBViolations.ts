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

interface HPDViolation {
  violationid?: string;
  boroid?: string;
  block?: string;
  lot?: string;
  buildingid?: string;
  registrationid?: string;
  violationstatus?: string;
  novdescription?: string;
  novissueddate?: string;
  inspectiondate?: string;
  currentstatusdate?: string;
  class?: string; // A, B, C
  ordernumber?: string;
  novid?: string;
  apartment?: string;
  story?: string;
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

function mapHPDStatus(status: string | null | undefined): "Active" | "In Resolution" | "Resolved" | "Dismissed" {
  if (!status) return "Active";
  const s = status.trim().toUpperCase();
  if (s === "CLOSE" || s === "CLOSED") return "Resolved";
  if (s === "CIV PENALTY" || s === "VIOLATION DISMISSED") return "Dismissed";
  return "Active";
}

function mapPriority(penalty: number | null, status: string): "High" | "Medium" | "Low" {
  if (status === "Resolved" || status === "Dismissed") return "Low";
  if (penalty && penalty > 5000) return "High";
  if (penalty && penalty > 1000) return "Medium";
  return "Medium";
}

function mapHPDPriority(hpdClass: string | null | undefined, status: string): "High" | "Medium" | "Low" {
  if (status === "Resolved" || status === "Dismissed") return "Low";
  if (hpdClass === "C") return "High"; // Immediately hazardous
  if (hpdClass === "B") return "Medium"; // Hazardous
  return "Low"; // Class A = non-hazardous
}

export async function fetchDOBViolations(bin: string, borough?: string | null, block?: string | null, lot?: string | null): Promise<COViolation[]> {
  const results: COViolation[] = [];

  // 1. Fetch DOB ECB Violations
  const ecbRes = await fetch(
    `https://data.cityofnewyork.us/resource/6bgk-3dad.json?$where=bin='${bin}'&$limit=500`
  ).then(r => r.ok ? r.json() : []).catch(() => [] as DOBECBViolation[]);

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
      agency: "DOB ECB",
    });
  }

  // 2. Fetch HPD Violations (uses BBL — borough + block + lot)
  if (borough && block && lot) {
    // Map borough name to BoroID
    const boroMap: Record<string, string> = {
      "manhattan": "1", "new york": "1",
      "bronx": "2", "the bronx": "2",
      "brooklyn": "3", "kings": "3",
      "queens": "4",
      "staten island": "5", "richmond": "5",
    };
    const boroId = boroMap[borough.toLowerCase().trim()] || borough;
    const paddedBlock = block.padStart(5, "0");
    const paddedLot = lot.padStart(4, "0");

    const hpdRes = await fetch(
      `https://data.cityofnewyork.us/resource/wvxf-dwi5.json?boroid=${boroId}&block=${paddedBlock}&lot=${paddedLot}&$limit=500&$order=novissueddate DESC`
    ).then(r => r.ok ? r.json() : []).catch(() => [] as HPDViolation[]);

    for (const v of hpdRes as HPDViolation[]) {
      const violationNum = v.violationid || v.novid || "";
      const status = mapHPDStatus(v.violationstatus);
      const hpdClass = v.class || null;
      results.push({
        violationNum: String(violationNum),
        type: hpdClass ? `HPD Class ${hpdClass}` : "HPD VIOLATION",
        fileDate: v.novissueddate ? v.novissueddate.substring(0, 10) : "",
        status,
        resolutionPlan: v.novdescription || "",
        assignedTo: null,
        priority: mapHPDPriority(hpdClass, status),
        penalty: null,
        agency: "HPD",
      });
    }
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
