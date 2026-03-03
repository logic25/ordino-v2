// Mock data for CO (Certificate of Occupancy) tracking

export interface COApplication {
  num: number;
  jobNum: string;
  source: "DOB_JOB_FILINGS" | "DOB_NOW_BUILD";
  fileDate: string;
  desc: string;
  tenant: string | null;
  floor: string;
  docNum: string | null;
  jobType: string;
  workType: string;
  status: string;
  action: string;
  assignedTo: string | null;
  priority: "High" | "Medium" | "Low";
  notes?: string;
  previousStatus?: string | null;
  // BIS open items
  bisOpenItems?: BISOpenItem[];
}

export interface BISOpenItem {
  id: string;
  description: string;
  receivedFrom: string;
  dateRequested?: string;            // When we asked for it
  receivedDate: string;             // When we got it (empty = outstanding)
  notes: string;
  resolved: boolean;
  signOffRequired?: string;   // e.g. "FDNY", "DOB Plumbing", "Owner"
  signedOffBy?: string;
  signedOffDate?: string;
}

export interface COViolation {
  violationNum: string;
  type: string;
  fileDate: string;
  status: "Active" | "In Resolution" | "Resolved" | "Dismissed";
  resolutionPlan: string;
  assignedTo: string | null;
  priority: "High" | "Medium" | "Low";
  penalty: number | null;
  previousStatus?: string | null;
}

export interface COSignOff {
  name: string;
  status: "Signed Off" | "Permit Issued" | "Approved" | "Pending";
  date: string | null;
  expirationDate: string | null;
  jobNum: string | null;
  category?: "life-safety" | "vertical-transport" | "general" | "deferrable";
  tcoRequired?: boolean;
}

export interface TCORequirement {
  name: string;
  required: boolean;
  category: "life-safety" | "vertical-transport" | "deferrable";
}

export interface ReportSnapshot {
  ranAt: string; // ISO datetime
  openApps: number;
  closedApps: number;
  totalApps: number;
  activeViols: number;
  resolvedViols: number;
  totalViols: number;
  receivedFrom: string;
  receivedDate: string;
  notes: string;
}

export const TCO_REQUIREMENTS: TCORequirement[] = [
  { name: "Fire Alarm", required: true, category: "life-safety" },
  { name: "Sprinkler", required: true, category: "life-safety" },
  { name: "Standpipe", required: true, category: "life-safety" },
  { name: "Electrical", required: true, category: "life-safety" },
  { name: "Elevator (Temp)", required: true, category: "vertical-transport" },
  { name: "Construction Safeguards", required: false, category: "deferrable" },
  { name: "Plumbing", required: false, category: "deferrable" },
];

export const WORK_TYPE_LABELS: Record<string, string> = {
  OT: "General Construction",
  PL: "Plumbing",
  MH: "Mechanical",
  SP: "Sprinkler",
  FA: "Fire Alarm",
  FP: "Fire Protection",
  SG: "Signs",
  EQ: "Elevator",
};

export const WORK_TYPE_COLORS: Record<string, string> = {
  OT: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  PL: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  MH: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  SP: "bg-red-500/10 text-red-700 border-red-500/20",
  FA: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  FP: "bg-green-500/10 text-green-700 border-green-500/20",
  SG: "bg-muted text-muted-foreground",
  EQ: "bg-teal-500/10 text-teal-700 border-teal-500/20",
};

export const STATUS_COLORS: Record<string, string> = {
  "Signed Off": "bg-green-500/10 text-green-700 border-green-500/20",
  "Permit Issued": "bg-blue-500/10 text-blue-700 border-blue-500/20",
  "Approved": "bg-cyan-500/10 text-cyan-700 border-cyan-500/20",
  "Plan Exam - Approved": "bg-cyan-500/10 text-cyan-700 border-cyan-500/20",
  "In Process": "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  "Disapproved": "bg-red-500/10 text-red-700 border-red-500/20",
  "Active": "bg-red-500/10 text-red-700 border-red-500/20",
  "In Resolution": "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  "Resolved": "bg-green-500/10 text-green-700 border-green-500/20",
  "Dismissed": "bg-muted text-muted-foreground",
  "Pending": "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
};

export const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-red-500/10 text-red-700 border-red-500/20",
  Medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  Low: "bg-muted text-muted-foreground",
};

export const MOCK_CO_APPLICATIONS: COApplication[] = [
  { num: 1, jobNum: "421644714", source: "DOB_JOB_FILINGS", fileDate: "2019-04-29", desc: "Additions to existing fire alarm system - Auntie Anne's Space #1033", tenant: "Auntie Anne's", floor: "1", docNum: "1", jobType: "A2", workType: "FA", status: "Signed Off", action: "Confirm sign-off recorded in BIS", assignedTo: null, priority: "Low", previousStatus: "Permit Issued", bisOpenItems: [
    { id: "bis-1a", description: "Final inspection sign-off pending in BIS system", receivedFrom: "DOB Examiner R. Chen", dateRequested: "2024-10-01", receivedDate: "", notes: "Examiner confirmed sign-off entered but not yet reflected in BIS. Follow up in 2 weeks.", resolved: false },
    { id: "bis-1b", description: "TR1 — Special Inspection Sign-Off (Structural Steel)", receivedFrom: "Engineer — Thornton Tomasetti", dateRequested: "2024-12-15", receivedDate: "", notes: "Awaiting final letter from engineer. Site visit completed 01/15.", resolved: false, signOffRequired: "DOB" },
    { id: "bis-1c", description: "Fire Alarm Certificate of Fitness", receivedFrom: "FDNY — Bureau of Fire Prevention", dateRequested: "2024-12-20", receivedDate: "", notes: "C of F application submitted 12/20. Processing takes 4–6 weeks.", resolved: false, signOffRequired: "FDNY" },
    { id: "bis-1d", description: "Letter of Completion from Tenant", receivedFrom: "Auntie Anne's — Store Manager K. Patel", dateRequested: "2025-01-08", receivedDate: "", notes: "Form sent to tenant 01/08, awaiting signed copy.", resolved: false, signOffRequired: "Tenant" },
    { id: "bis-1e", description: "Updated As-Built Drawings (Reflected Ceiling Plan)", receivedFrom: "Architect — GF55 Partners", dateRequested: "2025-01-20", receivedDate: "", notes: "Architect revising RCP to match field conditions. Expected by end of Feb.", resolved: false, signOffRequired: "DOB Plan Examiner" },
  ] },
  { num: 2, jobNum: "421912041", source: "DOB_JOB_FILINGS", fileDate: "2019-10-24", desc: "Interior renovation of existing retail space #2021 (Parfois). No change to use, egress or occupancy.", tenant: "Parfois", floor: "2", docNum: null, jobType: "A2", workType: "OT", status: "Permit Issued", action: "Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "High", bisOpenItems: [
    { id: "bis-2a", description: "As-built drawings required — field conditions differ from approved plans", receivedFrom: "DOB Plan Examiner J. Martinez", receivedDate: "2024-12-10", notes: "Examiner noted partition layout doesn't match approved set. Architect must submit revised as-builts.", resolved: false, signOffRequired: "DOB Plan Examiner" },
    { id: "bis-2b", description: "Tenant affidavit of completion not submitted", receivedFrom: "Property Manager — Mack-Cali Realty", receivedDate: "2024-11-28", notes: "Parfois store manager needs to sign affidavit confirming work is complete. PM sent form 11/28, no response.", resolved: false, signOffRequired: "Tenant (Parfois)" },
    { id: "bis-2c", description: "Final electrical inspection sign-off missing", receivedFrom: "Licensed Electrician — Apex Electric Corp", receivedDate: "2024-12-15", notes: "Electrician says panel was upgraded but DOB inspector hasn't been scheduled. Need to coordinate with GC.", resolved: false, signOffRequired: "DOB Electrical Inspector" },
    { id: "bis-2d", description: "Fire stopping certification required at demising walls", receivedFrom: "FDNY Bureau of Fire Prevention", receivedDate: "2025-01-05", notes: "FDNY flagged missing fire stopping cert at 3 penetrations. Firestopping contractor (Hilti) to provide letter.", resolved: false, signOffRequired: "FDNY" },
    { id: "bis-2e", description: "Sprinkler head relocation sign-off from plumbing contractor", receivedFrom: "Master Plumber — R&S Plumbing", receivedDate: "2025-01-12", notes: "2 heads were relocated during renovation. Plumber must file TR-1 amendment. Waiting on plumber's availability.", resolved: false, signOffRequired: "Master Plumber" },
    { id: "bis-2f", description: "ADA compliance letter from accessibility consultant", receivedFrom: "Accessibility Consultant — Equal Access LLC", receivedDate: "2025-01-20", notes: "DOB requested confirmation that renovated space meets ADA path-of-travel requirements. Consultant site visit scheduled 2/1.", resolved: false, signOffRequired: "Accessibility Consultant" },
    { id: "bis-2g", description: "Updated Certificate of Insurance from general contractor", receivedFrom: "GC — Turner Construction", receivedDate: "2024-10-30", notes: "COI on file expired 10/15. GC's insurance broker notified, new cert expected this week.", resolved: true, signOffRequired: "GC Insurance", signedOffBy: "Turner Construction — Risk Dept", signedOffDate: "2025-01-25" },
  ] },
  { num: 3, jobNum: "421912728", source: "DOB_JOB_FILINGS", fileDate: "2019-10-22", desc: "Interior renovations - removal and installation of partitions, ceiling, door modifications. No change in use, egress or occupancy.", tenant: "Unknown", floor: "1", docNum: null, jobType: "A2", workType: "OT", status: "Approved", action: "Confirm if work is complete. Send out completion forms.", assignedTo: null, priority: "Medium", previousStatus: "In Process" },
  { num: 4, jobNum: "421915592", source: "DOB_JOB_FILINGS", fileDate: "2019-09-19", desc: "Tenant renovations for Aeropostale in tenant space 3021", tenant: "Aeropostale", floor: "3", docNum: null, jobType: "A2", workType: "OT", status: "Permit Issued", action: "Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "Medium" },
  { num: 5, jobNum: "440247207", source: "DOB_JOB_FILINGS", fileDate: "2021-06-15", desc: "Installation of heavy duty sidewalk shed for remedial repair work", tenant: null, floor: "1", docNum: null, jobType: "A2", workType: "OT", status: "Permit Issued", action: "EUP needed. Confirm if work is complete. Withdraw or request LOC.", assignedTo: null, priority: "High", bisOpenItems: [
    { id: "bis-5a", description: "Extension of Use Permit (EUP) required — current permit expired", receivedFrom: "Borough Commissioner's Office", receivedDate: "2024-10-01", notes: "Must file for EUP before any further action. Contact expeditor.", resolved: false },
    { id: "bis-5b", description: "Sidewalk shed inspection overdue", receivedFrom: "DOB Inspector M. Torres", receivedDate: "2024-09-20", notes: "Inspection was due 09/15. Schedule immediately to avoid violation.", resolved: false },
    { id: "bis-5c", description: "Insurance certificate expired on file", receivedFrom: "DOB Records", receivedDate: "2024-08-15", notes: "GC needs to submit updated COI to DOB.", resolved: true },
  ] },
  { num: 6, jobNum: "421538571", source: "DOB_JOB_FILINGS", fileDate: "2018-05-20", desc: "Tenant fit-out, existing retail store. No change to existing use, egress or occupancy.", tenant: "Unknown", floor: "1", docNum: null, jobType: "A2", workType: "OT", status: "Permit Issued", action: "Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "Medium" },
  { num: 7, jobNum: "421481658", source: "DOB_JOB_FILINGS", fileDate: "2017-09-10", desc: "Modifications to existing sprinkler system as indicated on plans", tenant: null, floor: "1", docNum: null, jobType: "A2", workType: "SP", status: "Permit Issued", action: "PL sign off needed. Confirm if work is complete. Send out forms. Withdraw or request LOC.", assignedTo: null, priority: "High", bisOpenItems: [
    { id: "bis-7a", description: "Plumbing sign-off required before sprinkler close-out", receivedFrom: "DOB Plumbing Unit", receivedDate: "2024-12-01", notes: "PL sign-off is prerequisite. Submitted request — awaiting response.", resolved: false },
    { id: "bis-7b", description: "Updated sprinkler test report needed", receivedFrom: "FDNY", receivedDate: "2024-11-10", notes: "FDNY requires 5-year test report. Contractor scheduling.", resolved: false },
  ] },
  { num: 8, jobNum: "421524309", source: "DOB_JOB_FILINGS", fileDate: "2018-01-15", desc: "Additions to existing fire alarm system - E.L.F. Cosmetics store", tenant: "E.L.F. Cosmetics", floor: "2", docNum: null, jobType: "A2", workType: "FA", status: "Permit Issued", action: "FDNY LOA needed. Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "High", bisOpenItems: [
    { id: "bis-8a", description: "FDNY Letter of Approval required", receivedFrom: "FDNY Bureau of Fire Prevention", receivedDate: "2024-10-20", notes: "Application submitted to FDNY. Typical turnaround 6-8 weeks.", resolved: false },
  ] },
  { num: 9, jobNum: "421549202", source: "DOB_JOB_FILINGS", fileDate: "2018-03-01", desc: "Modification of existing sprinkler system on 1st floor at Superdry", tenant: "Superdry", floor: "1", docNum: null, jobType: "A2", workType: "SP", status: "Signed Off", action: "Confirm sign-off recorded in BIS", assignedTo: null, priority: "Medium", previousStatus: "Permit Issued" },
  { num: 10, jobNum: "421554507", source: "DOB_JOB_FILINGS", fileDate: "2018-03-15", desc: "Additions to existing fire alarm system - Superdry Space #2065", tenant: "Superdry", floor: "2", docNum: null, jobType: "A2", workType: "FA", status: "Permit Issued", action: "FDNY LOA needed. Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "High" },
  { num: 11, jobNum: "440307197", source: "DOB_NOW_BUILD", fileDate: "2021-08-10", desc: "Proposed installation of plywood enclosure as per plans. No change in use, egress or occupancy.", tenant: null, floor: "1", docNum: null, jobType: "A2", workType: "OT", status: "Approved", action: "Plans/EUP needed. Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "High" },
  { num: 12, jobNum: "440343576", source: "DOB_NOW_BUILD", fileDate: "2021-09-20", desc: "Kitchen rangehood fire suppression for Cheesecake Factory", tenant: "Cheesecake Factory", floor: "1", docNum: null, jobType: "A2", workType: "FP", status: "Permit Issued", action: "FDNY LOA needed. Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "High" },
  { num: 13, jobNum: "421574665", source: "DOB_JOB_FILINGS", fileDate: "2018-06-01", desc: "Queens Center Mall - Mars(With Me). Installation of kiosk unit #Y22E", tenant: "Mars", floor: "2", docNum: null, jobType: "A2", workType: "OT", status: "Permit Issued", action: "Withdrawal PW1 created. Confirm withdrawal.", assignedTo: null, priority: "Low" },
  { num: 14, jobNum: "421586876", source: "DOB_JOB_FILINGS", fileDate: "2018-07-01", desc: "Adidas second floor - Stadium Concept Queens Center Mall Space #2053", tenant: "Adidas", floor: "2", docNum: null, jobType: "A2", workType: "OT", status: "Permit Issued", action: "Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "Medium" },
  { num: 15, jobNum: "421477271", source: "DOB_JOB_FILINGS", fileDate: "2017-08-15", desc: "Interior tenant build out Jimmy Jazz Space #0037 and #0041. No change in use, egress or occupancy.", tenant: "Jimmy Jazz", floor: "1", docNum: null, jobType: "A2", workType: "OT", status: "Permit Issued", action: "Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "Medium" },
  { num: 16, jobNum: "440454438", source: "DOB_NOW_BUILD", fileDate: "2022-03-10", desc: "Install solar panels on new carports under related structural work", tenant: null, floor: "7", docNum: null, jobType: "A1", workType: "OT", status: "Plan Exam - Approved", action: "TR1/PW3 created. Await permit issuance.", assignedTo: null, priority: "Medium" },
  { num: 17, jobNum: "440455017", source: "DOB_NOW_BUILD", fileDate: "2022-03-15", desc: "Install carport on 7th floor deck. No change in use, egress, or occupancy.", tenant: null, floor: "7", docNum: null, jobType: "A1", workType: "OT", status: "Plan Exam - Approved", action: "TR1/PW3 created. Await permit issuance.", assignedTo: null, priority: "Medium", previousStatus: "In Process" },
  { num: 18, jobNum: "421590193", source: "DOB_JOB_FILINGS", fileDate: "2018-07-15", desc: "Pink Victoria's Secret Space #2085 and #2081. Renovation to existing retail space.", tenant: "Victoria's Secret", floor: "2", docNum: null, jobType: "A2", workType: "OT", status: "Permit Issued", action: "Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "Medium" },
  { num: 19, jobNum: "421464294", source: "DOB_JOB_FILINGS", fileDate: "2017-07-01", desc: "Installation of a prefabricated kiosk as per plans. No change in use, egress or occupancy.", tenant: null, floor: "1", docNum: null, jobType: "A2", workType: "OT", status: "Permit Issued", action: "EUP needed. Confirm if work is complete. Send out forms. Withdraw or request LOC.", assignedTo: null, priority: "Medium" },
  { num: 20, jobNum: "421524979", source: "DOB_JOB_FILINGS", fileDate: "2018-01-20", desc: "Renovation of existing first floor retail tenant space (Space 1055)", tenant: "Unknown", floor: "1", docNum: null, jobType: "A2", workType: "PL", status: "Permit Issued", action: "Final cost affidavit & LOC submission.", assignedTo: null, priority: "High" },
];

export const MOCK_CO_VIOLATIONS: COViolation[] = [
  { violationNum: "V 012618ACC106205", type: "DOB VIOLATION - ACTIVE", fileDate: "2018-01-26", status: "Active", resolutionPlan: "", assignedTo: null, priority: "Medium", penalty: null },
  { violationNum: "V 012618ACC106206", type: "DOB VIOLATION - ACTIVE", fileDate: "2018-01-26", status: "Active", resolutionPlan: "", assignedTo: null, priority: "Medium", penalty: null },
  { violationNum: "V 012618ACC106207", type: "DOB VIOLATION - ACTIVE", fileDate: "2018-01-26", status: "Active", resolutionPlan: "", assignedTo: null, priority: "Medium", penalty: null },
  { violationNum: "V 012618ACC106208", type: "DOB VIOLATION - ACTIVE", fileDate: "2018-01-26", status: "Resolved", resolutionPlan: "Conditions corrected, certificate of correction issued.", assignedTo: null, priority: "Medium", penalty: null, previousStatus: "Active" },
  { violationNum: "V 012618ACC106209", type: "DOB VIOLATION - ACTIVE", fileDate: "2018-01-26", status: "Active", resolutionPlan: "", assignedTo: null, priority: "Medium", penalty: null },
  { violationNum: "V 032119ECB104521", type: "DOB VIOLATION - ACTIVE", fileDate: "2019-03-21", status: "In Resolution", resolutionPlan: "Cure letter submitted 2024-11. Awaiting hearing date.", assignedTo: null, priority: "High", penalty: 2500 },
  { violationNum: "V 061520ACC112340", type: "DOB VIOLATION - ACTIVE", fileDate: "2020-06-15", status: "Active", resolutionPlan: "", assignedTo: null, priority: "Medium", penalty: null },
  { violationNum: "V 091821ECB109876", type: "DOB VIOLATION - ACTIVE", fileDate: "2021-09-18", status: "Active", resolutionPlan: "", assignedTo: null, priority: "Low", penalty: null },
  { violationNum: "V 022322ACC115544", type: "DOB VIOLATION - ACTIVE", fileDate: "2022-02-23", status: "In Resolution", resolutionPlan: "Contractor correcting conditions. Re-inspection scheduled.", assignedTo: null, priority: "High", penalty: 5000 },
  { violationNum: "V 110822ECB120001", type: "DOB VIOLATION - ACTIVE", fileDate: "2022-11-08", status: "Active", resolutionPlan: "", assignedTo: null, priority: "Medium", penalty: null },
];

export const MOCK_SIGN_OFFS: COSignOff[] = [
  { name: "Final Construction", status: "Pending", date: null, expirationDate: null, jobNum: null, category: "general", tcoRequired: false },
  { name: "Final Plumbing", status: "Signed Off", date: "01/20/2005", expirationDate: "01/20/2026", jobNum: "401536806", category: "deferrable", tcoRequired: false },
  { name: "Final Elevator", status: "Pending", date: null, expirationDate: null, jobNum: null, category: "vertical-transport", tcoRequired: true },
  { name: "Temp Elevator", status: "Signed Off", date: "09/18/2019", expirationDate: "09/18/2025", jobNum: null, category: "vertical-transport", tcoRequired: true },
  { name: "Final Electrical", status: "Pending", date: null, expirationDate: null, jobNum: null, category: "life-safety", tcoRequired: true },
  { name: "Sprinkler (Garage)", status: "Signed Off", date: "05/17/2005", expirationDate: "05/17/2026", jobNum: "401536806", category: "life-safety", tcoRequired: true },
  { name: "Sprinkler (Mall)", status: "Signed Off", date: "05/17/2005", expirationDate: "05/17/2026", jobNum: "401536806", category: "life-safety", tcoRequired: true },
  { name: "Standpipe (Garage)", status: "Signed Off", date: "02/05/2004", expirationDate: "02/05/2025", jobNum: "401536726", category: "life-safety", tcoRequired: true },
  { name: "Standpipe (Mall)", status: "Signed Off", date: "03/18/2004", expirationDate: "03/18/2025", jobNum: "401623221", category: "life-safety", tcoRequired: true },
  { name: "Fire Alarm (Garage)", status: "Signed Off", date: "05/02/2007", expirationDate: "05/02/2027", jobNum: "401536735", category: "life-safety", tcoRequired: true },
  { name: "Fire Alarm (Mall)", status: "Signed Off", date: "05/02/2007", expirationDate: "05/02/2027", jobNum: "401538476", category: "life-safety", tcoRequired: true },
  { name: "Smoke Purge (Garage)", status: "Permit Issued", date: null, expirationDate: null, jobNum: "401414830", category: "life-safety", tcoRequired: true },
  { name: "Smoke Purge (Mall)", status: "Permit Issued", date: null, expirationDate: null, jobNum: "401414830", category: "life-safety", tcoRequired: true },
  { name: "Fire Protection Plan", status: "Approved", date: "02/10/2004", expirationDate: "02/10/2025", jobNum: "401808923", category: "life-safety", tcoRequired: true },
];

export const MOCK_WORK_TYPE_BREAKDOWN = [
  { workType: "OT", open: 208, closed: 520, total: 728 },
  { workType: "PL", open: 108, closed: 145, total: 253 },
  { workType: "MH", open: 93, closed: 98, total: 191 },
  { workType: "SP", open: 75, closed: 67, total: 142 },
  { workType: "FA", open: 48, closed: 42, total: 90 },
  { workType: "FP", open: 36, closed: 21, total: 57 },
  { workType: "SG", open: 29, closed: 15, total: 44 },
  { workType: "EQ", open: 16, closed: 8, total: 24 },
];

// Mock previous report snapshot for delta comparison
export const MOCK_PREVIOUS_REPORT: ReportSnapshot = {
  ranAt: "2025-02-15T14:30:00Z",
  openApps: 625,
  closedApps: 904,
  totalApps: 1529,
  activeViols: 215,
  resolvedViols: 85,
  totalViols: 300,
  receivedFrom: "Mack-Cali Realty / Queens Center Mall Management",
  receivedDate: "2025-02-10",
  notes: "Owner requested full status update ahead of Q1 board meeting.",
};
