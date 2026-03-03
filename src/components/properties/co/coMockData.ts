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
  previousStatus?: string | null; // for change-tracking between reports
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
  previousStatus?: string | null; // for change-tracking between reports
}

export interface COSignOff {
  name: string;
  status: "Signed Off" | "Permit Issued" | "Approved" | "Pending";
  date: string | null;
  jobNum: string | null;
  category?: "life-safety" | "vertical-transport" | "general" | "deferrable";
  tcoRequired?: boolean;
}

export interface TCORequirement {
  name: string;
  required: boolean;
  category: "life-safety" | "vertical-transport" | "deferrable";
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
  { num: 1, jobNum: "421644714", source: "DOB_JOB_FILINGS", fileDate: "2019-04-29", desc: "Additions to existing fire alarm system - Auntie Anne's Space #1033", tenant: "Auntie Anne's", floor: "1", docNum: "1", jobType: "A2", workType: "FA", status: "Signed Off", action: "Confirm sign-off recorded in BIS", assignedTo: null, priority: "Low", previousStatus: "Permit Issued" },
  { num: 2, jobNum: "421912041", source: "DOB_JOB_FILINGS", fileDate: "2019-10-24", desc: "Interior renovation of existing retail space #2021 (Parfois). No change to use, egress or occupancy.", tenant: "Parfois", floor: "2", docNum: null, jobType: "A2", workType: "OT", status: "Permit Issued", action: "Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "Medium" },
  { num: 3, jobNum: "421912728", source: "DOB_JOB_FILINGS", fileDate: "2019-10-22", desc: "Interior renovations - removal and installation of partitions, ceiling, door modifications. No change in use, egress or occupancy.", tenant: "Unknown", floor: "1", docNum: null, jobType: "A2", workType: "OT", status: "Approved", action: "Confirm if work is complete. Send out completion forms.", assignedTo: null, priority: "Medium", previousStatus: "In Process" },
  { num: 4, jobNum: "421915592", source: "DOB_JOB_FILINGS", fileDate: "2019-09-19", desc: "Tenant renovations for Aeropostale in tenant space 3021", tenant: "Aeropostale", floor: "3", docNum: null, jobType: "A2", workType: "OT", status: "Permit Issued", action: "Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "Medium" },
  { num: 5, jobNum: "440247207", source: "DOB_JOB_FILINGS", fileDate: "2021-06-15", desc: "Installation of heavy duty sidewalk shed for remedial repair work", tenant: null, floor: "1", docNum: null, jobType: "A2", workType: "OT", status: "Permit Issued", action: "EUP needed. Confirm if work is complete. Withdraw or request LOC.", assignedTo: null, priority: "High" },
  { num: 6, jobNum: "421538571", source: "DOB_JOB_FILINGS", fileDate: "2018-05-20", desc: "Tenant fit-out, existing retail store. No change to existing use, egress or occupancy.", tenant: "Unknown", floor: "1", docNum: null, jobType: "A2", workType: "OT", status: "Permit Issued", action: "Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "Medium" },
  { num: 7, jobNum: "421481658", source: "DOB_JOB_FILINGS", fileDate: "2017-09-10", desc: "Modifications to existing sprinkler system as indicated on plans", tenant: null, floor: "1", docNum: null, jobType: "A2", workType: "SP", status: "Permit Issued", action: "PL sign off needed. Confirm if work is complete. Send out forms. Withdraw or request LOC.", assignedTo: null, priority: "High" },
  { num: 8, jobNum: "421524309", source: "DOB_JOB_FILINGS", fileDate: "2018-01-15", desc: "Additions to existing fire alarm system - E.L.F. Cosmetics store", tenant: "E.L.F. Cosmetics", floor: "2", docNum: null, jobType: "A2", workType: "FA", status: "Permit Issued", action: "FDNY LOA needed. Confirm if work is complete. Distribute LOC forms. Request LOC.", assignedTo: null, priority: "High" },
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
  { name: "Final Construction", status: "Pending", date: null, jobNum: null, category: "general", tcoRequired: false },
  { name: "Final Plumbing", status: "Signed Off", date: "01/20/2005", jobNum: "401536806", category: "deferrable", tcoRequired: false },
  { name: "Final Elevator", status: "Pending", date: null, jobNum: null, category: "vertical-transport", tcoRequired: true },
  { name: "Temp Elevator", status: "Signed Off", date: "09/18/2019", jobNum: null, category: "vertical-transport", tcoRequired: true },
  { name: "Final Electrical", status: "Pending", date: null, jobNum: null, category: "life-safety", tcoRequired: true },
  { name: "Sprinkler (Garage)", status: "Signed Off", date: "05/17/2005", jobNum: "401536806", category: "life-safety", tcoRequired: true },
  { name: "Sprinkler (Mall)", status: "Signed Off", date: "05/17/2005", jobNum: "401536806", category: "life-safety", tcoRequired: true },
  { name: "Standpipe (Garage)", status: "Signed Off", date: "02/05/2004", jobNum: "401536726", category: "life-safety", tcoRequired: true },
  { name: "Standpipe (Mall)", status: "Signed Off", date: "03/18/2004", jobNum: "401623221", category: "life-safety", tcoRequired: true },
  { name: "Fire Alarm (Garage)", status: "Signed Off", date: "05/02/2007", jobNum: "401536735", category: "life-safety", tcoRequired: true },
  { name: "Fire Alarm (Mall)", status: "Signed Off", date: "05/02/2007", jobNum: "401538476", category: "life-safety", tcoRequired: true },
  { name: "Smoke Purge (Garage)", status: "Permit Issued", date: null, jobNum: "401414830", category: "life-safety", tcoRequired: true },
  { name: "Smoke Purge (Mall)", status: "Permit Issued", date: null, jobNum: "401414830", category: "life-safety", tcoRequired: true },
  { name: "Fire Protection Plan", status: "Approved", date: "02/10/2004", jobNum: "401808923", category: "life-safety", tcoRequired: true },
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
