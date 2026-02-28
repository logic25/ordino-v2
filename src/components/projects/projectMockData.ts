// Mock data types and hardcoded data for project expansion prototype

export interface MockApplication {
  jobNumber: string;
  type: string;
}

export interface MockTask {
  id: string;
  text: string;
  done: boolean;
  assignedTo?: string;
  dueDate?: string;
}

export interface MockRequirement {
  id: string;
  label: string;
  met: boolean;
  detail?: string;
  fromWhom?: string;
}

export interface MockService {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete" | "billed" | "dropped";
  application: MockApplication | null;
  subServices: string[];
  totalAmount: number;
  billedAmount: number;
  costAmount: number;
  assignedTo: string;
  estimatedBillDate: string | null;
  billedAt: string | null;
  scopeOfWork: string;
  jobDescription?: string;
  estimatedCosts?: { discipline: string; amount: number }[];
  notes: string;
  needsDobFiling: boolean;
  tasks: MockTask[];
  requirements: MockRequirement[];
  allottedHours: number;
  parentServiceId?: string;
}

export type EngineerDiscipline = "structural" | "mechanical" | "plumbing" | "sprinkler" | "electrical" | "civil" | "environmental" | "other";

export const engineerDisciplineLabels: Record<EngineerDiscipline, string> = {
  structural: "Structural",
  mechanical: "Mechanical",
  plumbing: "Plumbing",
  sprinkler: "Sprinkler",
  electrical: "Electrical",
  civil: "Civil",
  environmental: "Environmental",
  other: "Other",
};

export interface MockContact {
  id: string;
  name: string;
  role: string;
  company: string;
  phone: string;
  email: string;
  dobRole: "applicant" | "owner" | "filing_rep" | "architect" | "engineer" | "gc" | "sia_applicant" | "tpp_applicant" | "other";
  discipline?: EngineerDiscipline;
  source: "proposal" | "pis" | "manual";
  dobRegistered: "registered" | "not_registered" | "unknown";
  review?: { rating: number; comment?: string };
  client_id?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  is_primary?: boolean;
}

export interface MockMilestone {
  id: string;
  date: string;
  event: string;
  source: "system" | "email" | "user" | "dob";
  details?: string;
}

export interface MockChangeOrder {
  id: string;
  number: string;
  description: string;
  amount: number;
  status: "draft" | "pending" | "approved" | "rejected";
  createdDate: string;
  approvedDate?: string;
  linkedServices: string[];
  reason: string;
  requestedBy: string;
  internalSigned: boolean;
  internalSignedDate?: string;
  internalSigner?: string;
  clientSigned: boolean;
  clientSignedDate?: string;
  clientSigner?: string;
}

export interface MockProposalSignature {
  proposalNumber: string;
  fullyExecuted: boolean;
  internalSignedDate?: string;
  clientSignedDate?: string;
  internalSigner?: string;
  clientSigner?: string;
}

export interface MockEmail {
  id: string;
  date: string;
  from: string;
  subject: string;
  snippet: string;
  direction: "inbound" | "outbound";
}

export interface MockDocument {
  id: string;
  name: string;
  type: string;
  category: string;
  uploadedBy: string;
  uploadedDate: string;
  size: string;
  storage_path?: string;
  filename?: string;
  storageBucket?: string;
}

export interface MockTimeEntry {
  id: string;
  date: string;
  user: string;
  service: string;
  hours: number;
  description: string;
  billable: boolean;
}

export interface MockChecklistItem {
  id: string;
  category: "missing_document" | "missing_info" | "pending_signature" | "pending_response";
  label: string;
  fromWhom: string;
  requestedDate: string;
  daysWaiting: number;
  done: boolean;
  linkedServiceId?: string;
}

export interface MockPISStatus {
  sentDate: string | null;
  totalFields: number;
  completedFields: number;
  missingFields: string[];
  missingBySection?: Record<string, string[]>;
}

// --- Checklist Items ---

const MOCK_CHECKLIST_A: MockChecklistItem[] = [
  { id: "cl1", category: "missing_document", label: "ACP5 form from landlord", fromWhom: "Mayra Maisch (BGO)", requestedDate: "02/06/2026", daysWaiting: 10, done: false },
  { id: "cl2", category: "missing_document", label: "Structural calculations for beam support", fromWhom: "Antonio Rossi", requestedDate: "02/14/2026", daysWaiting: 2, done: false, linkedServiceId: "s4" },
  { id: "cl3", category: "missing_document", label: "Sealed drawings with job numbers", fromWhom: "Antonio Rossi", requestedDate: "02/10/2026", daysWaiting: 6, done: false },
  { id: "cl4", category: "missing_info", label: "Engineer DOB NOW email (not registered)", fromWhom: "David Chen", requestedDate: "02/08/2026", daysWaiting: 8, done: false },
  { id: "cl5", category: "missing_info", label: "Credit card info for DOB filing fees", fromWhom: "Mayra Maisch (BGO)", requestedDate: "02/06/2026", daysWaiting: 10, done: false },
  { id: "cl6", category: "missing_info", label: "Gas line operating pressure", fromWhom: "Mayra Maisch (BGO)", requestedDate: "02/12/2026", daysWaiting: 4, done: false },
  { id: "cl7", category: "pending_signature", label: "Landlord e-sign on DOB application", fromWhom: "Mayra Maisch (BGO)", requestedDate: "02/10/2026", daysWaiting: 6, done: false },
  { id: "cl8", category: "pending_response", label: "Filing type confirmation (plan exam vs pro-cert)", fromWhom: "Antonio Rossi", requestedDate: "02/07/2026", daysWaiting: 9, done: false },
  { id: "cl9", category: "missing_document", label: "Asbestos investigation report (ACP5)", fromWhom: "Landlord rep", requestedDate: "02/05/2026", daysWaiting: 11, done: true },
];

const MOCK_CHECKLIST_B: MockChecklistItem[] = [
  { id: "cl10", category: "pending_response", label: "Confirm square footage with architect", fromWhom: "Architect", requestedDate: "02/15/2026", daysWaiting: 1, done: false, linkedServiceId: "s8" },
  { id: "cl11", category: "missing_document", label: "Updated site plan", fromWhom: "Architect", requestedDate: "02/10/2026", daysWaiting: 6, done: false },
];

// --- PIS Status ---

const MOCK_PIS_A: MockPISStatus = {
  sentDate: "02/05/2026",
  totalFields: 7,
  completedFields: 4,
  missingFields: ["Engineer DOB email", "CC info for fees", "Gas line pressure"],
};

const MOCK_PIS_B: MockPISStatus = {
  sentDate: "01/12/2026",
  totalFields: 7,
  completedFields: 7,
  missingFields: [],
};

// --- Services ---

const MOCK_SERVICES_A: MockService[] = [
  { id: "s1", name: "OER Approval", status: "in_progress", application: { jobNumber: "421639356", type: "FA" }, subServices: [], totalAmount: 750, billedAmount: 0, costAmount: 175, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "Obtain Office of Environmental Remediation approval for the project site.", jobDescription: "Environmental remediation clearance for commercial tenant build-out at 689 5th Avenue, 14th floor.", notes: "", needsDobFiling: false, tasks: [{ id: "t1", text: "Submit OER application", done: true }, { id: "t2", text: "Follow up on OER status", done: false, assignedTo: "Natalia S.", dueDate: "02/20/2026" }], requirements: [{ id: "r1", label: "ACP5 form received", met: false, detail: "Awaiting from landlord" }, { id: "r2", label: "OER application submitted", met: true }], allottedHours: 3 },
  { id: "s1b", name: "Alteration Type 2 — GC", status: "in_progress", application: null, subServices: ["GC"], totalAmount: 2500, billedAmount: 0, costAmount: 218.75, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "File the required applications and plans with the DOB for general construction scope.\nAttend the required plan examinations to review & resolve issued objections as required to obtain approval.", jobDescription: "Interior demolition and build-out of 14th floor commercial space for Shake Shack. New partition walls, ceiling grid, flooring, and millwork. Approximately 3,200 SF.", estimatedCosts: [{ discipline: "General Construction", amount: 245000 }], notes: "GC alteration to be filed first — other disciplines follow.", needsDobFiling: true, tasks: [{ id: "t1b1", text: "Prepare GC application package", done: true, assignedTo: "Natalia S." }, { id: "t1b2", text: "Obtain GC insurance certificate", done: true, assignedTo: "Natalia S." }, { id: "t1b3", text: "Coordinate landlord e-sign for GC filing", done: false, assignedTo: "Natalia S.", dueDate: "02/22/2026" }], requirements: [{ id: "r1b1", label: "Sealed architectural drawings received", met: true, fromWhom: "Architect" }, { id: "r1b2", label: "GC insurance certificate on file", met: true, fromWhom: "GC" }, { id: "r1b3", label: "Landlord e-sign complete", met: false, fromWhom: "Rudin Management" }], allottedHours: 6 },
  { id: "s2", name: "Work Permit — GC", status: "not_started", application: null, subServices: ["GC"], totalAmount: 250, billedAmount: 0, costAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "File and obtain general construction work permit after ALT2 GC approval.", estimatedCosts: [{ discipline: "General Construction", amount: 245000 }], notes: "", needsDobFiling: true, tasks: [], requirements: [{ id: "r3", label: "GC application approved", met: false }, { id: "r4", label: "Insurance cert on file", met: true }], allottedHours: 1, parentServiceId: "s1b" },
  { id: "s3", name: "Letter of Completion — GC", status: "not_started", application: null, subServices: [], totalAmount: 750, billedAmount: 0, costAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "06/30/2026", billedAt: null, scopeOfWork: "Obtain Letter of Completion from DOB for general construction scope.", notes: "", needsDobFiling: false, tasks: [{ id: "t3", text: "Go to DOB to pick up LOC", done: false, assignedTo: "Sheri L.", dueDate: "06/25/2026" }], requirements: [{ id: "r5", label: "All GC inspections passed", met: false }, { id: "r6", label: "Final sign-off received", met: false }], allottedHours: 2 },
  { id: "s4", name: "Alteration Type 2 — PL/SP", status: "in_progress", application: null, subServices: ["PL", "SP"], totalAmount: 3000, billedAmount: 0, costAmount: 262.50, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "File the required applications and plans with the DOB for plumbing and sprinkler scopes.\nAttend the required plan examinations to review & resolve issued objections as required to obtain approval.", jobDescription: "Plumbing rough-in for new kitchenette and restroom relocation. Sprinkler system modification and head relocation to accommodate new partition layout. 14th floor, ~3,200 SF.", estimatedCosts: [{ discipline: "Plumbing", amount: 85000 }, { discipline: "Sprinkler", amount: 42000 }], notes: "Waiting on structural calcs from architect for beam support.", needsDobFiling: true, tasks: [{ id: "t4", text: "Request structural calcs from Antonio", done: true }, { id: "t5", text: "Respond to DOB objection", done: false, assignedTo: "Natalia S.", dueDate: "02/18/2026" }], requirements: [{ id: "r7", label: "Structural calcs received", met: false, detail: "Requested from Antonio 02/14" }, { id: "r8", label: "Plans sealed with job numbers", met: false }, { id: "r9", label: "Landlord e-sign complete", met: false }], allottedHours: 8 },
  { id: "s4b", name: "Alteration Type 2 — Mechanical", status: "in_progress", application: null, subServices: ["MH"], totalAmount: 1500, billedAmount: 0, costAmount: 131.25, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "File the required applications and plans with the DOB for mechanical / HVAC scope.\nAttend plan examinations and resolve objections to obtain approval.", jobDescription: "HVAC modifications including new ductwork routing, VAV box installation, and exhaust system for 14th floor commercial tenant build-out. Approximately 3,200 SF.", estimatedCosts: [{ discipline: "HVAC / Mechanical", amount: 68000 }], notes: "Mechanical filing to run in parallel with PL/SP alteration.", needsDobFiling: true, tasks: [{ id: "t4b1", text: "Obtain sealed mechanical drawings from MEP", done: false, assignedTo: "Natalia S.", dueDate: "02/20/2026" }, { id: "t4b2", text: "Confirm PE stamp on HVAC plans", done: false }], requirements: [{ id: "r7b", label: "Sealed mechanical drawings received", met: false, detail: "From MEP engineer", fromWhom: "Antonio's MEP team" }, { id: "r8b", label: "Energy code compliance (ComCheck)", met: false, fromWhom: "MEP Engineer" }, { id: "r9b", label: "Landlord e-sign complete", met: false }], allottedHours: 4 },
  { id: "s5", name: "Work Permit — PL/SP", status: "not_started", application: null, subServices: ["PL", "SP"], totalAmount: 250, billedAmount: 0, costAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "File and obtain plumbing and sprinkler work permits.", estimatedCosts: [{ discipline: "Plumbing", amount: 85000 }, { discipline: "Sprinkler", amount: 42000 }], notes: "", needsDobFiling: true, tasks: [], requirements: [{ id: "r10", label: "PL/SP application approved", met: false }], allottedHours: 1, parentServiceId: "s4" },
  { id: "s5b", name: "Work Permit — Mechanical", status: "not_started", application: null, subServices: ["MH"], totalAmount: 250, billedAmount: 0, costAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "File and obtain mechanical work permit.", estimatedCosts: [{ discipline: "HVAC / Mechanical", amount: 68000 }], notes: "", needsDobFiling: true, tasks: [], requirements: [{ id: "r10b", label: "MH application approved", met: false }], allottedHours: 1, parentServiceId: "s4b" },
  { id: "s6", name: "Letter of Completion", status: "not_started", application: null, subServices: [], totalAmount: 750, billedAmount: 0, costAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "06/30/2026", billedAt: null, scopeOfWork: "Obtain Letter of Completion for all scopes.", notes: "", needsDobFiling: false, tasks: [], requirements: [{ id: "r11", label: "All inspections passed", met: false }], allottedHours: 2 },
];

const MOCK_SERVICES_B: MockService[] = [
  { id: "s7", name: "Zoning Analysis", status: "billed", application: { jobNumber: "520112847", type: "ALT2" }, subServices: [], totalAmount: 1200, billedAmount: 1200, costAmount: 525, assignedTo: "Sheri L.", estimatedBillDate: "01/15/2026", billedAt: "01/18/2026", scopeOfWork: "Complete zoning analysis and confirm project compliance.", notes: "Completed ahead of schedule.", needsDobFiling: false, tasks: [], requirements: [], allottedHours: 4 },
  { id: "s8", name: "DOB Filing", status: "in_progress", application: { jobNumber: "520112847", type: "ALT2" }, subServices: ["GC"], totalAmount: 650, billedAmount: 0, costAmount: 262.50, assignedTo: "Natalia S.", estimatedBillDate: "02/28/2026", billedAt: null, scopeOfWork: "Prepare and submit DOB application.", notes: "Square footage discrepancy — need architect confirmation.", needsDobFiling: false, tasks: [{ id: "t6", text: "Confirm sq footage with architect", done: false, assignedTo: "Natalia S.", dueDate: "02/20/2026" }], requirements: [{ id: "r12", label: "Square footage confirmed", met: false, detail: "Discrepancy found" }], allottedHours: 4 },
  { id: "s9", name: "Expediting", status: "not_started", application: null, subServices: [], totalAmount: 500, billedAmount: 0, costAmount: 0, assignedTo: "Sheri L.", estimatedBillDate: "03/15/2026", billedAt: null, scopeOfWork: "Expedite DOB review process.", notes: "", needsDobFiling: true, tasks: [], requirements: [{ id: "r13", label: "Application filed", met: true }], allottedHours: 3 },
  { id: "s10", name: "Inspections Coordination", status: "not_started", application: null, subServices: ["GC", "MH"], totalAmount: 400, billedAmount: 0, costAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "04/30/2026", billedAt: null, scopeOfWork: "Schedule and coordinate all required DOB inspections.", notes: "", needsDobFiling: false, tasks: [], requirements: [{ id: "r14", label: "Work permit issued", met: false }], allottedHours: 6 },
];

// --- Contacts ---

const MOCK_CONTACTS_A: MockContact[] = [
  { id: "c0", name: "Sheri Lopez", role: "SIA Applicant", company: "GLE", phone: "(212) 555-0503", email: "sheri@gle.com", dobRole: "sia_applicant", source: "manual", dobRegistered: "registered" },
  { id: "c1", name: "Mayra Maisch", role: "Project Contact", company: "BGO", phone: "(212) 555-0101", email: "mayra@bgo.com", dobRole: "owner", source: "proposal", dobRegistered: "registered" },
  { id: "c2", name: "Antonio Rossi", role: "Architect of Record", company: "Rossi Architecture", phone: "(212) 555-0202", email: "antonio@rossiarch.com", dobRole: "applicant", source: "proposal", dobRegistered: "registered" },
  { id: "c3", name: "Natalia Smith", role: "Filing Representative", company: "GLE", phone: "(212) 555-0303", email: "natalia@gle.com", dobRole: "filing_rep", source: "manual", dobRegistered: "registered" },
  { id: "c4", name: "David Chen", role: "Structural Engineer", company: "Chen Engineering", phone: "(212) 555-0404", email: "david@cheneng.com", dobRole: "engineer", discipline: "structural", source: "pis", dobRegistered: "not_registered" },
];

const MOCK_CONTACTS_B: MockContact[] = [
  { id: "c5", name: "Sarah Johnson", role: "Property Manager", company: "Brookfield Properties", phone: "(212) 555-0501", email: "sjohnson@brookfield.com", dobRole: "owner", source: "proposal", dobRegistered: "registered" },
  { id: "c6", name: "Mike Torres", role: "GC Superintendent", company: "Turner Construction", phone: "(212) 555-0502", email: "mtorres@turner.com", dobRole: "gc", source: "pis", dobRegistered: "registered" },
  { id: "c7", name: "Sheri Lopez", role: "Filing Representative", company: "GLE", phone: "(212) 555-0503", email: "sheri@gle.com", dobRole: "filing_rep", source: "manual", dobRegistered: "registered" },
];

// --- Milestones ---

const MOCK_MILESTONES_A: MockMilestone[] = [
  { id: "m1", date: "02/05/2026", event: "Project created from Proposal #021526-1", source: "system" },
  { id: "m2", date: "02/06/2026", event: "Natalia Smith assigned as Project Manager", source: "system" },
  { id: "m3", date: "02/07/2026", event: "Plans received from architect", source: "email", details: "Antonio sent architectural set v1" },
  { id: "m4", date: "02/10/2026", event: "DOB Application #421639356 filed (Fire Alarm)", source: "dob" },
  { id: "m5", date: "02/12/2026", event: "Objection received — missing structural calcs", source: "dob", details: "Examiner requires beam support calculations" },
  { id: "m6", date: "02/14/2026", event: "Email sent to architect requesting structural calcs", source: "email" },
];

const MOCK_MILESTONES_B: MockMilestone[] = [
  { id: "m7", date: "01/10/2026", event: "Project created from Proposal #011026-3", source: "system" },
  { id: "m8", date: "01/12/2026", event: "Zoning analysis started", source: "user" },
  { id: "m9", date: "01/18/2026", event: "Zoning analysis completed — compliant", source: "user" },
  { id: "m10", date: "01/20/2026", event: "DOB Application #520112847 filed (ALT2)", source: "dob" },
];

// --- Change Orders ---

const MOCK_CHANGE_ORDERS_A: MockChangeOrder[] = [
  { id: "co1", number: "CO-001", description: "Additional sprinkler heads — 3rd floor scope expansion", amount: 1200, status: "approved", createdDate: "02/10/2026", approvedDate: "02/12/2026", linkedServices: ["s4"], reason: "Client requested additional coverage on 3rd floor", requestedBy: "Mayra Maisch", internalSigned: true, internalSignedDate: "02/11/2026", internalSigner: "Sheri L.", clientSigned: true, clientSignedDate: "02/12/2026", clientSigner: "Mayra Maisch" },
  { id: "co2", number: "CO-002", description: "Structural engineer review for beam modification", amount: 800, status: "pending", createdDate: "02/14/2026", linkedServices: ["s4"], reason: "DOB objection requires additional structural review", requestedBy: "Internal", internalSigned: true, internalSignedDate: "02/14/2026", internalSigner: "Sheri L.", clientSigned: false },
];

const MOCK_CHANGE_ORDERS_B: MockChangeOrder[] = [];

// --- Proposal Signatures ---

const MOCK_PROPOSAL_SIG_A: MockProposalSignature = {
  proposalNumber: "021526-1",
  fullyExecuted: true,
  internalSignedDate: "02/04/2026",
  clientSignedDate: "02/05/2026",
  internalSigner: "Sheri L.",
  clientSigner: "Mayra Maisch",
};

const MOCK_PROPOSAL_SIG_B: MockProposalSignature = {
  proposalNumber: "011026-3",
  fullyExecuted: false,
  internalSignedDate: "01/09/2026",
  internalSigner: "Sheri L.",
};

// --- Emails ---

const MOCK_EMAILS_A: MockEmail[] = [
  { id: "e1", date: "02/14/2026", from: "Natalia Smith", subject: "RE: Structural calcs needed — 685 Third Ave", snippet: "Hi Antonio, following up on the structural calculations for the beam support...", direction: "outbound" },
  { id: "e2", date: "02/12/2026", from: "DOB Examiner", subject: "Objection Notice — Job #421639356", snippet: "Please provide structural calculations for the proposed beam support modification...", direction: "inbound" },
  { id: "e3", date: "02/07/2026", from: "Antonio Rossi", subject: "Plans — 685 Third Ave 28th Floor", snippet: "Please find attached the architectural set v1 for your review...", direction: "inbound" },
  { id: "e4", date: "02/06/2026", from: "Mayra Maisch", subject: "Project kickoff — 685 Third Ave", snippet: "Confirming we're ready to proceed with the filing. Please coordinate with...", direction: "inbound" },
];

const MOCK_EMAILS_B: MockEmail[] = [
  { id: "e5", date: "01/20/2026", from: "Natalia Smith", subject: "Filing confirmation — Job #520112847", snippet: "The ALT2 application has been filed. Job number is 520112847...", direction: "outbound" },
  { id: "e6", date: "01/18/2026", from: "Sheri Lopez", subject: "Zoning analysis complete", snippet: "Zoning analysis is done. Project is compliant with all applicable zoning...", direction: "outbound" },
];

// --- Documents ---

const MOCK_DOCUMENTS_A: MockDocument[] = [
  { id: "d1", name: "Architectural Plans v1.pdf", type: "PDF", category: "plans", uploadedBy: "Antonio Rossi", uploadedDate: "02/07/2026", size: "12.4 MB" },
  { id: "d2", name: "DOB Objection Notice.pdf", type: "PDF", category: "dob", uploadedBy: "System", uploadedDate: "02/12/2026", size: "245 KB" },
  { id: "d3", name: "Fire Alarm Layout.dwg", type: "DWG", category: "plans", uploadedBy: "Antonio Rossi", uploadedDate: "02/07/2026", size: "8.1 MB" },
  { id: "d4", name: "Insurance Certificate.pdf", type: "PDF", category: "insurance", uploadedBy: "Mayra Maisch", uploadedDate: "02/05/2026", size: "320 KB" },
  { id: "d5", name: "Proposal #021526-1.pdf", type: "PDF", category: "contract", uploadedBy: "System", uploadedDate: "02/05/2026", size: "1.1 MB" },
];

const MOCK_DOCUMENTS_B: MockDocument[] = [
  { id: "d6", name: "Zoning Analysis Report.pdf", type: "PDF", category: "reports", uploadedBy: "Sheri Lopez", uploadedDate: "01/18/2026", size: "1.2 MB" },
  { id: "d7", name: "ALT2 Application.pdf", type: "PDF", category: "dob", uploadedBy: "Natalia Smith", uploadedDate: "01/20/2026", size: "890 KB" },
];

// --- Time Entries ---

const MOCK_TIME_A: MockTimeEntry[] = [
  { id: "te1", date: "02/14/2026", user: "Natalia S.", service: "Alteration Type 2 — PL/SP", hours: 1.5, description: "Reviewed objection, drafted response", billable: true },
  { id: "te2", date: "02/10/2026", user: "Natalia S.", service: "OER Approval", hours: 1.0, description: "Submitted OER application online", billable: true },
  { id: "te3", date: "02/10/2026", user: "Natalia S.", service: "Alteration Type 2 — PL/SP", hours: 0.75, description: "Filed DOB application", billable: true },
  { id: "te4", date: "02/08/2026", user: "Natalia S.", service: "Alteration Type 2 — PL/SP", hours: 2.0, description: "Prepared application documents", billable: true },
  { id: "te5", date: "02/07/2026", user: "Natalia S.", service: "OER Approval", hours: 0.5, description: "Reviewed plans for OER requirements", billable: true },
];

const MOCK_TIME_B: MockTimeEntry[] = [
  { id: "te6", date: "01/18/2026", user: "Sheri L.", service: "Zoning Analysis", hours: 3.0, description: "Completed full zoning analysis", billable: true },
  { id: "te7", date: "01/20/2026", user: "Natalia S.", service: "DOB Filing", hours: 1.5, description: "Prepared and submitted ALT2 application", billable: true },
];

// --- Project C: 331 Port Richmond Ave (from email / Ordino screenshot) ---

const MOCK_SERVICES_C: MockService[] = [
  { id: "sc1", name: "Alteration Type 1 Approval (ALT-CO)", status: "in_progress", application: { jobNumber: "S00701588-I1", type: "ALT-CO" }, subServices: ["OT"], totalAmount: 4300, billedAmount: 0, costAmount: 1272.50, assignedTo: "Don Speaker", estimatedBillDate: null, billedAt: null, scopeOfWork: "File the required applications and plans with the DOB. Attend the required plan examinations to review & resolve issued objections as required to obtain approval.", notes: "Plans came in Feb. Pending restrictive declaration from owner to proceed with plan review. 3 DOB comments outstanding:\n1. Provide all missing dimensions on plan\n2. DEP Sewer Certification (may be able to waive)\n3. Provide elevations and sections", needsDobFiling: false, tasks: [{ id: "tc1", text: "Follow up with architect on drawing revisions", done: false, assignedTo: "Don Speaker", dueDate: "01/27/2026" }, { id: "tc2", text: "Research DEP sewer certification waiver path", done: true, assignedTo: "Don Speaker" }, { id: "tc3", text: "Schedule DOB plan exam appointment", done: false, assignedTo: "Don Speaker" }], requirements: [{ id: "rc1", label: "Revised drawings with dimensions", met: false, detail: "Architect poked 01/20, no response", fromWhom: "Dave McAlpine" }, { id: "rc2", label: "DEP Sewer Certification (or waiver)", met: false, detail: "Exploring waiver via AI-1", fromWhom: "DEP / Architect" }, { id: "rc3", label: "Elevations and sections on plans", met: false, detail: "Architect said he'd add to list", fromWhom: "Dave McAlpine" }, { id: "rc4", label: "Restrictive declaration from owner", met: false, detail: "Pending from owner", fromWhom: "David Batista (Owner)" }], allottedHours: 9 },
  { id: "sc2", name: "Work Permit", status: "not_started", application: null, subServices: ["OT"], totalAmount: 500, billedAmount: 0, costAmount: 0, assignedTo: "Don Speaker", estimatedBillDate: null, billedAt: null, scopeOfWork: "File and obtain work permit after approval.", notes: "Pending restrictive declaration from owner to proceed with plan review.", needsDobFiling: true, tasks: [], requirements: [{ id: "rc5", label: "ALT-CO approval obtained", met: false, fromWhom: "DOB" }], allottedHours: 1, parentServiceId: "sc1" },
  { id: "sc3", name: "Final Construction Sign-Off", status: "not_started", application: null, subServices: [], totalAmount: 350, billedAmount: 0, costAmount: 0, assignedTo: "Don Speaker", estimatedBillDate: null, billedAt: null, scopeOfWork: "Obtain final construction sign-off from DOB inspector.", notes: "Pending restrictive declaration from owner.", needsDobFiling: false, tasks: [{ id: "tc4", text: "Schedule DOB inspection", done: false, assignedTo: "Don Speaker" }], requirements: [{ id: "rc6", label: "Construction complete", met: false, fromWhom: "GC / Owner" }], allottedHours: 2 },
  { id: "sc4", name: "Final Electrical Sign-Off", status: "not_started", application: null, subServices: [], totalAmount: 350, billedAmount: 0, costAmount: 0, assignedTo: "Don Speaker", estimatedBillDate: null, billedAt: null, scopeOfWork: "Obtain final electrical sign-off from DOB inspector.", notes: "", needsDobFiling: false, tasks: [], requirements: [{ id: "rc7", label: "Electrical work complete", met: false, fromWhom: "Electrician / GC" }], allottedHours: 2 },
  { id: "sc5", name: "Final Elevator Sign-Off", status: "not_started", application: null, subServices: [], totalAmount: 350, billedAmount: 0, costAmount: 0, assignedTo: "Don Speaker", estimatedBillDate: null, billedAt: null, scopeOfWork: "Obtain final elevator sign-off from DOB inspector.", notes: "", needsDobFiling: false, tasks: [], requirements: [{ id: "rc8", label: "Elevator work complete", met: false, fromWhom: "Elevator contractor" }], allottedHours: 2 },
  { id: "sc6", name: "Final Plumbing Sign-Off", status: "not_started", application: null, subServices: [], totalAmount: 350, billedAmount: 0, costAmount: 0, assignedTo: "Don Speaker", estimatedBillDate: null, billedAt: null, scopeOfWork: "Obtain final plumbing sign-off from DOB inspector.", notes: "", needsDobFiling: false, tasks: [], requirements: [{ id: "rc9", label: "Plumbing work complete", met: false, fromWhom: "Plumber / GC" }], allottedHours: 2 },
  { id: "sc7", name: "Initial TCO Approval", status: "not_started", application: null, subServices: [], totalAmount: 1300, billedAmount: 0, costAmount: 0, assignedTo: "Don Speaker", estimatedBillDate: null, billedAt: null, scopeOfWork: "Obtain Temporary Certificate of Occupancy from DOB.", notes: "", needsDobFiling: false, tasks: [], requirements: [{ id: "rc10", label: "All sign-offs obtained", met: false, fromWhom: "DOB" }, { id: "rc11", label: "Fire dept clearance", met: false, fromWhom: "FDNY" }], allottedHours: 4 },
  { id: "sc8", name: "Certificate of Occupancy", status: "not_started", application: null, subServices: [], totalAmount: 7500, billedAmount: 0, costAmount: 0, assignedTo: "Don Speaker", estimatedBillDate: null, billedAt: null, scopeOfWork: "Obtain permanent Certificate of Occupancy.", notes: "", needsDobFiling: false, tasks: [], requirements: [{ id: "rc12", label: "TCO obtained", met: false, fromWhom: "DOB" }], allottedHours: 6 },
  { id: "sc9", name: "Remove ECB Violation", status: "not_started", application: null, subServices: [], totalAmount: 750, billedAmount: 0, costAmount: 0, assignedTo: "Don Speaker", estimatedBillDate: null, billedAt: null, scopeOfWork: "Research and resolve ECB violation on the property.", notes: "", needsDobFiling: false, tasks: [{ id: "tc5", text: "Pull ECB violation details from BIS", done: false, assignedTo: "Don Speaker" }], requirements: [{ id: "rc13", label: "Violation details confirmed", met: false, fromWhom: "ECB / BIS" }], allottedHours: 3 },
  { id: "sc10", name: "Remove DOB Violation", status: "not_started", application: null, subServices: [], totalAmount: 350, billedAmount: 0, costAmount: 0, assignedTo: "Don Speaker", estimatedBillDate: null, billedAt: null, scopeOfWork: "Research and resolve DOB violation on the property.", notes: "", needsDobFiling: false, tasks: [{ id: "tc6", text: "Pull DOB violation details from BIS", done: false, assignedTo: "Don Speaker" }], requirements: [{ id: "rc14", label: "Violation details confirmed", met: false, fromWhom: "DOB / BIS" }], allottedHours: 2 },
];

const MOCK_CONTACTS_C: MockContact[] = [
  { id: "cc1", name: "David Batista", role: "Owner / Client Contact", company: "Batler Food Corp", phone: "(718) 555-0601", email: "david@batlerfood.com", dobRole: "owner", source: "proposal", dobRegistered: "registered", review: { rating: 4, comment: "Responsive and easy to work with" } },
  { id: "cc2", name: "Dave McAlpine", role: "Architect of Record", company: "McAlpine Associates", phone: "(718) 555-0602", email: "mcalpineassociates@gmail.com", dobRole: "architect", source: "proposal", dobRegistered: "registered", review: { rating: 3, comment: "Slow on revisions but quality drawings" } },
  { id: "cc3", name: "Don Speaker", role: "Filing Representative / PM", company: "GLE", phone: "(718) 392-1969 x14", email: "don@greenlightexpediting.com", dobRole: "filing_rep", source: "manual", dobRegistered: "registered" },
  { id: "cc4", name: "Manny Russell", role: "Principal", company: "GLE", phone: "(718) 392-1969", email: "manny@greenlightexpediting.com", dobRole: "applicant", source: "manual", dobRegistered: "registered" },
];

const MOCK_MILESTONES_C: MockMilestone[] = [
  { id: "mc1", date: "07/29/2021", event: "Project created — 331 Port Richmond Ave", source: "system" },
  { id: "mc2", date: "05/18/2025", event: "Plans received from architect", source: "email", details: "Initial plan set from Dave McAlpine" },
  { id: "mc3", date: "05/28/2025", event: "DOB plan exam appointment scheduled", source: "dob" },
  { id: "mc4", date: "06/05/2025", event: "DOB objections received (3 comments)", source: "dob", details: "1. Missing dimensions, 2. DEP sewer cert, 3. Missing elevations/sections" },
  { id: "mc5", date: "01/15/2026", event: "Follow-up email sent to architect re: drawing revisions", source: "email", details: "Architect said 'poke me on Tuesday'" },
  { id: "mc6", date: "01/20/2026", event: "Second follow-up — checking drawing status + AI-1 waiver", source: "email", details: "No response from architect since 01/15" },
];

const MOCK_CHANGE_ORDERS_C: MockChangeOrder[] = [];

const MOCK_EMAILS_C: MockEmail[] = [
  { id: "ec1", date: "01/20/2026", from: "Don Speaker", subject: "331 Port Richmond Ave - S00701588-I1", snippet: "Just a quick check on the drawing status. Also - please see attached AI-1. I think we can waive the previous comment regarding the DEP Sewer Certification requirement.", direction: "outbound" },
  { id: "ec2", date: "01/15/2026", from: "Dave McAlpine", subject: "RE: 331 Port Richmond Ave - S00701588-I1", snippet: "I'll add the elevations and sections to my list of bits and pieces. Poke me on Tuesday and I should be finished.", direction: "inbound" },
  { id: "ec3", date: "01/15/2026", from: "Don Speaker", subject: "331 Port Richmond Ave - S00701588-I1", snippet: "Blast from the past... last we had an appointment with DOB on this they had 3 comments...", direction: "outbound" },
  { id: "ec4", date: "06/05/2025", from: "DOB Examiner", subject: "Plan Exam Comments — S00701588-I1", snippet: "1. Provide all missing dimensions on plan. 2. Provide DEP Sewer Certification. 3. Provide elevations and sections.", direction: "inbound" },
];

const MOCK_DOCUMENTS_C: MockDocument[] = [
  { id: "dc1", name: "AI-1 DEP Waiver Request.pdf", type: "PDF", category: "dob", uploadedBy: "Don Speaker", uploadedDate: "01/20/2026", size: "180 KB" },
  { id: "dc2", name: "DOB Objection Notice.pdf", type: "PDF", category: "dob", uploadedBy: "System", uploadedDate: "06/05/2025", size: "245 KB" },
  { id: "dc3", name: "Architectural Plans v1.pdf", type: "PDF", category: "plans", uploadedBy: "Dave McAlpine", uploadedDate: "05/18/2025", size: "8.5 MB" },
  { id: "dc4", name: "Proposal — 331 Port Richmond.pdf", type: "PDF", category: "contract", uploadedBy: "System", uploadedDate: "07/29/2021", size: "950 KB" },
];

const MOCK_TIME_C: MockTimeEntry[] = [
  { id: "tec1", date: "01/20/2026", user: "Don Speaker", service: "Alteration Type 1 Approval (ALT-CO)", hours: 0.5, description: "Follow-up email to architect, reviewed AI-1 waiver", billable: true },
  { id: "tec2", date: "01/15/2026", user: "Don Speaker", service: "Alteration Type 1 Approval (ALT-CO)", hours: 0.75, description: "Reviewed DOB comments, drafted follow-up to architect", billable: true },
  { id: "tec3", date: "06/05/2025", user: "Don Speaker", service: "Alteration Type 1 Approval (ALT-CO)", hours: 2.0, description: "DOB plan exam appointment — received 3 objections", billable: true },
  { id: "tec4", date: "05/28/2025", user: "Don Speaker", service: "Alteration Type 1 Approval (ALT-CO)", hours: 1.0, description: "Scheduled DOB plan exam, coordinated with architect", billable: true },
];

const MOCK_CHECKLIST_C: MockChecklistItem[] = [
  { id: "clc1", category: "missing_document", label: "Revised drawings with all dimensions", fromWhom: "Dave McAlpine (Architect)", requestedDate: "01/15/2026", daysWaiting: 32, done: false, linkedServiceId: "sc1" },
  { id: "clc2", category: "missing_document", label: "Elevations and sections on plans", fromWhom: "Dave McAlpine (Architect)", requestedDate: "01/15/2026", daysWaiting: 32, done: false, linkedServiceId: "sc1" },
  { id: "clc3", category: "missing_document", label: "DEP Sewer Certification (or waiver approval)", fromWhom: "DEP / DOB", requestedDate: "06/05/2025", daysWaiting: 256, done: false, linkedServiceId: "sc1" },
  { id: "clc4", category: "pending_response", label: "Restrictive declaration from owner", fromWhom: "David Batista (Owner)", requestedDate: "02/01/2026", daysWaiting: 15, done: false },
  { id: "clc5", category: "pending_response", label: "Architect response on drawing timeline", fromWhom: "Dave McAlpine", requestedDate: "01/20/2026", daysWaiting: 27, done: false },
];

const MOCK_PIS_C: MockPISStatus = {
  sentDate: "07/29/2021",
  totalFields: 7,
  completedFields: 5,
  missingFields: ["Updated estimated job cost", "Current contractor info"],
};

const MOCK_PROPOSAL_SIG_C: MockProposalSignature = {
  proposalNumber: "072921-1",
  fullyExecuted: true,
  internalSignedDate: "07/28/2021",
  clientSignedDate: "07/29/2021",
  internalSigner: "Manny Russell",
  clientSigner: "David Batista",
};

// --- Project E: 689 5th Ave — ALT Type 2 (No Application Number) ---

const MOCK_SERVICES_E: MockService[] = [
  { id: "se1", name: "Alteration Type 2 Filing", status: "in_progress", application: null, subServices: ["GC", "PL"], totalAmount: 3800, billedAmount: 0, costAmount: 875, assignedTo: "Don Speaker", estimatedBillDate: "03/15/2026", billedAt: null, scopeOfWork: "Prepare and file Alteration Type 2 application with DOB for general construction and plumbing scopes.", jobDescription: "Interior renovation of 14th floor commercial space. Work includes new partition walls, plumbing rough-in for kitchenette, and electrical panel upgrade. Approximately 3,200 SF of renovated space.", estimatedCosts: [{ discipline: "General Construction", amount: 320000 }, { discipline: "Plumbing", amount: 95000 }], notes: "Application not yet submitted — awaiting final sealed drawings from architect. Client pushing for expedited timeline.", needsDobFiling: true, tasks: [{ id: "te1t1", text: "Prepare DOB NOW application draft", done: true, assignedTo: "Don Speaker" }, { id: "te1t2", text: "Request final sealed drawings from architect", done: false, assignedTo: "Don Speaker", dueDate: "02/20/2026" }, { id: "te1t3", text: "Coordinate owner signature for filing", done: false, assignedTo: "Natalia S.", dueDate: "02/25/2026" }], requirements: [{ id: "re1", label: "Final sealed drawings received", met: false, detail: "Architect promised by 02/20", fromWhom: "James Whitfield (Architect)" }, { id: "re2", label: "Owner DOB NOW account active", met: true, fromWhom: "Margaret Chen" }, { id: "re3", label: "Insurance certificate current", met: true, fromWhom: "GC" }, { id: "re4", label: "Asbestos report (ACP5) on file", met: false, detail: "Environmental firm scheduled for 02/18", fromWhom: "EcoTest Labs" }], allottedHours: 10 },
  { id: "se1b", name: "Alteration Type 2 Filing — Mechanical", status: "in_progress", application: null, subServices: ["MH"], totalAmount: 2200, billedAmount: 0, costAmount: 450, assignedTo: "Don Speaker", estimatedBillDate: "03/15/2026", billedAt: null, scopeOfWork: "Prepare and file separate Alteration Type 2 application for mechanical / HVAC scope.", jobDescription: "HVAC modifications including new ductwork, VAV boxes, and exhaust system for 14th floor renovation. Mechanical permit required separately per DOB.", estimatedCosts: [{ discipline: "HVAC / Mechanical", amount: 70000 }], notes: "Mechanical filing to be submitted in parallel with GC/PL alteration.", needsDobFiling: true, tasks: [{ id: "te1bt1", text: "Obtain sealed mechanical drawings", done: false, assignedTo: "Don Speaker", dueDate: "02/22/2026" }, { id: "te1bt2", text: "Confirm PE stamp on HVAC plans", done: false, assignedTo: "Don Speaker" }], requirements: [{ id: "re1b1", label: "Sealed mechanical drawings received", met: false, detail: "From MEP engineer", fromWhom: "Rivera Engineering" }, { id: "re1b2", label: "Energy code compliance (ComCheck)", met: false, fromWhom: "MEP Engineer" }, { id: "re1b3", label: "Owner DOB NOW account active", met: true, fromWhom: "Margaret Chen" }], allottedHours: 6 },
  { id: "se2", name: "Work Permit — GC/PL", status: "not_started", application: null, subServices: ["GC", "PL"], totalAmount: 500, billedAmount: 0, costAmount: 0, assignedTo: "Don Speaker", estimatedBillDate: "04/01/2026", billedAt: null, scopeOfWork: "File and obtain GC and plumbing work permits after ALT2 approval.", jobDescription: "General construction and plumbing work permits for interior renovation.", estimatedCosts: [{ discipline: "General Construction", amount: 320000 }, { discipline: "Plumbing", amount: 95000 }], notes: "", needsDobFiling: true, tasks: [], requirements: [{ id: "re5", label: "ALT2 (GC/PL) application approved", met: false, fromWhom: "DOB" }], allottedHours: 2, parentServiceId: "se1" },
  { id: "se2b", name: "Work Permit — Mechanical", status: "not_started", application: null, subServices: ["MH"], totalAmount: 400, billedAmount: 0, costAmount: 0, assignedTo: "Don Speaker", estimatedBillDate: "04/01/2026", billedAt: null, scopeOfWork: "File and obtain mechanical work permit after ALT2 mechanical approval.", jobDescription: "Mechanical work permit for HVAC modifications.", estimatedCosts: [{ discipline: "HVAC / Mechanical", amount: 70000 }], notes: "", needsDobFiling: true, tasks: [], requirements: [{ id: "re5b", label: "ALT2 (Mechanical) application approved", met: false, fromWhom: "DOB" }], allottedHours: 2, parentServiceId: "se1b" },
  { id: "se3", name: "Plan Review Coordination", status: "complete", application: null, subServices: [], totalAmount: 1200, billedAmount: 1200, costAmount: 525, assignedTo: "Natalia S.", estimatedBillDate: "01/30/2026", billedAt: "02/01/2026", scopeOfWork: "Coordinate plan review between architect, engineer, and DOB examiner. Resolve all objections.", notes: "Completed ahead of schedule. All zoning and code compliance confirmed.", needsDobFiling: false, tasks: [{ id: "te3t1", text: "Review zoning compliance", done: true, assignedTo: "Natalia S." }, { id: "te3t2", text: "Confirm code compliance with engineer", done: true, assignedTo: "Natalia S." }], requirements: [{ id: "re6", label: "Zoning analysis complete", met: true }, { id: "re7", label: "Code compliance confirmed", met: true }], allottedHours: 4 },
  { id: "se4", name: "Inspection Coordination", status: "not_started", application: null, subServices: ["GC", "PL", "MH"], totalAmount: 800, billedAmount: 0, costAmount: 0, assignedTo: "Don Speaker", estimatedBillDate: "06/15/2026", billedAt: null, scopeOfWork: "Schedule and coordinate all required DOB inspections for GC, plumbing, and mechanical work.", notes: "Cannot begin until work permit is issued.", needsDobFiling: false, tasks: [{ id: "te4t1", text: "Create inspection schedule template", done: false, assignedTo: "Don Speaker" }, { id: "te4t2", text: "Coordinate with GC on construction timeline", done: false, assignedTo: "Don Speaker", dueDate: "04/15/2026" }], requirements: [{ id: "re8", label: "Work permit issued", met: false, fromWhom: "DOB" }, { id: "re9", label: "GC construction schedule received", met: false, fromWhom: "Rivera Construction" }], allottedHours: 8 },
  { id: "se5", name: "Letter of Completion", status: "not_started", application: null, subServices: [], totalAmount: 750, billedAmount: 0, costAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "08/30/2026", billedAt: null, scopeOfWork: "Obtain Letter of Completion from DOB upon project completion and all inspections passed.", notes: "", needsDobFiling: false, tasks: [{ id: "te5t1", text: "Compile all inspection sign-off documents", done: false, assignedTo: "Natalia S." }], requirements: [{ id: "re10", label: "All inspections passed", met: false, fromWhom: "DOB" }, { id: "re11", label: "Final construction sign-off", met: false, fromWhom: "DOB Inspector" }], allottedHours: 3 },
  { id: "se6", name: "Expediting", status: "in_progress", application: null, subServices: [], totalAmount: 600, billedAmount: 0, costAmount: 262.50, assignedTo: "Don Speaker", estimatedBillDate: "03/30/2026", billedAt: null, scopeOfWork: "Expedite DOB review process through direct engagement with examiner and plan review scheduling.", notes: "Working to get pre-filing meeting with examiner before formal submission.", needsDobFiling: false, tasks: [{ id: "te6t1", text: "Schedule pre-filing meeting with DOB", done: false, assignedTo: "Don Speaker", dueDate: "02/22/2026" }, { id: "te6t2", text: "Prepare expediting checklist", done: true, assignedTo: "Don Speaker" }], requirements: [{ id: "re12", label: "All filing documents ready", met: false, fromWhom: "Internal" }], allottedHours: 4 },
];

const MOCK_CONTACTS_E: MockContact[] = [
  { id: "ce1", name: "Margaret Chen", role: "Property Owner / Client", company: "689 Fifth LLC", phone: "(212) 555-0701", email: "mchen@689fifth.com", dobRole: "owner", source: "proposal", dobRegistered: "registered", review: { rating: 5, comment: "Excellent communicator, always responsive" } },
  { id: "ce2", name: "James Whitfield", role: "Architect of Record", company: "Whitfield + Partners", phone: "(212) 555-0702", email: "jwhitfield@wparch.com", dobRole: "architect", source: "proposal", dobRegistered: "registered", review: { rating: 3, comment: "Quality work but slow on deliverables" } },
  { id: "ce3", name: "Patricia Novak", role: "Structural Engineer", company: "Novak Engineering", phone: "(212) 555-0703", email: "pnovak@novakeng.com", dobRole: "engineer", source: "pis", dobRegistered: "registered", review: { rating: 4, comment: "Thorough calculations, meets deadlines" } },
  { id: "ce4", name: "Carlos Rivera", role: "General Contractor", company: "Rivera Construction", phone: "(718) 555-0704", email: "carlos@riveraconstruction.com", dobRole: "gc", source: "pis", dobRegistered: "not_registered" },
  { id: "ce5", name: "Don Speaker", role: "Filing Representative / PM", company: "GLE", phone: "(718) 392-1969 x14", email: "don@greenlightexpediting.com", dobRole: "filing_rep", source: "manual", dobRegistered: "registered" },
  { id: "ce6", name: "Don Speaker", role: "SIA Applicant", company: "GLE", phone: "(718) 392-1969 x14", email: "don@greenlightexpediting.com", dobRole: "sia_applicant", source: "manual", dobRegistered: "registered" },
  { id: "ce7", name: "James Whitfield", role: "TPP Applicant", company: "Whitfield + Partners", phone: "(212) 555-0702", email: "jwhitfield@wparch.com", dobRole: "tpp_applicant", source: "manual", dobRegistered: "registered" },
];

const MOCK_MILESTONES_E: MockMilestone[] = [
  { id: "me1", date: "01/15/2026", event: "Project created from Proposal #011526-2", source: "system" },
  { id: "me2", date: "01/16/2026", event: "Don Speaker assigned as Project Manager", source: "system" },
  { id: "me3", date: "01/20/2026", event: "Initial plans received from architect", source: "email", details: "Preliminary set — not yet sealed" },
  { id: "me4", date: "01/25/2026", event: "Plan review coordination started", source: "user" },
  { id: "me5", date: "01/30/2026", event: "Zoning and code compliance confirmed", source: "user", details: "All clear for ALT2 filing" },
  { id: "me6", date: "02/01/2026", event: "Plan review billed — $1,200", source: "system" },
  { id: "me7", date: "02/10/2026", event: "Client requested expedited timeline — wants filing by end of Feb", source: "email", details: "Margaret Chen emailed requesting faster turnaround. **CRITICAL DECISION**: Client overrode recommendation to wait for final sealed drawings before filing." },
  { id: "me8", date: "02/14/2026", event: "Pre-filing meeting requested with DOB examiner", source: "user" },
  { id: "me9", date: "02/15/2026", event: "Environmental firm scheduled for ACP5 inspection", source: "email", details: "EcoTest Labs confirmed 02/18 site visit" },
];

const MOCK_CHANGE_ORDERS_E: MockChangeOrder[] = [
  { id: "coe1", number: "CO-001", description: "Expedited filing coordination — additional DOB liaison hours", amount: 600, status: "approved", createdDate: "02/10/2026", approvedDate: "02/11/2026", linkedServices: ["se6"], reason: "Client requested expedited timeline requiring additional coordination effort", requestedBy: "Margaret Chen", internalSigned: true, internalSignedDate: "02/10/2026", internalSigner: "Don Speaker", clientSigned: true, clientSignedDate: "02/11/2026", clientSigner: "Margaret Chen" },
  { id: "coe2", number: "CO-002", description: "Additional environmental testing — lead paint survey", amount: 450, status: "pending", createdDate: "02/15/2026", linkedServices: ["se1"], reason: "DOB may require lead paint survey for pre-1978 building", requestedBy: "Internal", internalSigned: true, internalSignedDate: "02/15/2026", internalSigner: "Don Speaker", clientSigned: false },
];

const MOCK_EMAILS_E: MockEmail[] = [
  { id: "ee1", date: "02/15/2026", from: "EcoTest Labs", subject: "ACP5 Inspection Confirmation — 689 5th Ave", snippet: "Confirming our asbestos inspection is scheduled for Tuesday 02/18 at 9:00 AM. Please ensure site access is arranged...", direction: "inbound" },
  { id: "ee2", date: "02/14/2026", from: "Don Speaker", subject: "Pre-filing meeting request — 689 5th Ave ALT2", snippet: "Requesting a pre-filing meeting with the examiner to discuss the ALT2 application before formal submission...", direction: "outbound" },
  { id: "ee3", date: "02/10/2026", from: "Margaret Chen", subject: "RE: Filing timeline — 689 5th Ave", snippet: "I understand the risks you outlined, but we need to move forward as quickly as possible. The tenant is pressuring us to begin construction by March...", direction: "inbound" },
  { id: "ee4", date: "02/10/2026", from: "Don Speaker", subject: "Filing timeline — 689 5th Ave", snippet: "Margaret, I'd recommend waiting for the final sealed drawings before submitting. Filing with preliminary drawings could result in objections...", direction: "outbound" },
  { id: "ee5", date: "02/01/2026", from: "Natalia S.", subject: "Plan review complete — 689 5th Ave", snippet: "The plan review coordination is complete. Zoning compliance confirmed, code compliance verified with engineer...", direction: "outbound" },
  { id: "ee6", date: "01/20/2026", from: "James Whitfield", subject: "Preliminary plans — 689 5th Ave Renovation", snippet: "Please find attached the preliminary architectural plans for the 12th floor renovation. Final sealed set to follow...", direction: "inbound" },
  { id: "ee7", date: "01/16/2026", from: "Don Speaker", subject: "Project kickoff — 689 5th Ave ALT2", snippet: "Margaret, confirming we've received the signed proposal and are beginning work on the ALT2 filing...", direction: "outbound" },
];

const MOCK_DOCUMENTS_E: MockDocument[] = [
  { id: "de1", name: "Preliminary Architectural Plans.pdf", type: "PDF", category: "plans", uploadedBy: "James Whitfield", uploadedDate: "01/20/2026", size: "15.2 MB" },
  { id: "de2", name: "Zoning Analysis Report.pdf", type: "PDF", category: "reports", uploadedBy: "Natalia S.", uploadedDate: "01/30/2026", size: "1.8 MB" },
  { id: "de3", name: "Structural Calculations.pdf", type: "PDF", category: "reports", uploadedBy: "Patricia Novak", uploadedDate: "01/28/2026", size: "4.2 MB" },
  { id: "de4", name: "Insurance Certificate — Rivera Construction.pdf", type: "PDF", category: "insurance", uploadedBy: "Carlos Rivera", uploadedDate: "01/22/2026", size: "380 KB" },
  { id: "de5", name: "Proposal #011526-2.pdf", type: "PDF", category: "contract", uploadedBy: "System", uploadedDate: "01/15/2026", size: "1.1 MB" },
  { id: "de6", name: "CO-001 Expedited Filing.pdf", type: "PDF", category: "contract", uploadedBy: "Don Speaker", uploadedDate: "02/10/2026", size: "420 KB" },
  { id: "de7", name: "Site Photos — 12th Floor.zip", type: "ZIP", category: "other", uploadedBy: "Carlos Rivera", uploadedDate: "01/25/2026", size: "28.5 MB" },
  { id: "de8", name: "Code Compliance Memo.pdf", type: "PDF", category: "reports", uploadedBy: "Patricia Novak", uploadedDate: "01/29/2026", size: "650 KB" },
];

const MOCK_TIME_E: MockTimeEntry[] = [
  { id: "tee1", date: "02/14/2026", user: "Don Speaker", service: "Expediting", hours: 1.5, description: "Drafted pre-filing meeting request, coordinated with DOB liaison", billable: true },
  { id: "tee2", date: "02/10/2026", user: "Don Speaker", service: "Alteration Type 2 Filing", hours: 2.0, description: "Prepared application draft on DOB NOW, reviewed client timeline request", billable: true },
  { id: "tee3", date: "02/01/2026", user: "Natalia S.", service: "Plan Review Coordination", hours: 1.5, description: "Finalized plan review, compiled compliance report", billable: true },
  { id: "tee4", date: "01/30/2026", user: "Natalia S.", service: "Plan Review Coordination", hours: 2.0, description: "Zoning analysis and code compliance verification", billable: true },
  { id: "tee5", date: "01/25/2026", user: "Natalia S.", service: "Plan Review Coordination", hours: 1.0, description: "Initial plan review and architect coordination", billable: true },
  { id: "tee6", date: "01/20/2026", user: "Don Speaker", service: "Alteration Type 2 Filing", hours: 0.75, description: "Reviewed preliminary plans, identified filing requirements", billable: true },
  { id: "tee7", date: "01/16/2026", user: "Don Speaker", service: "Alteration Type 2 Filing", hours: 0.5, description: "Project setup and initial client call", billable: true },
];

const MOCK_CHECKLIST_E: MockChecklistItem[] = [
  { id: "cle1", category: "missing_document", label: "Final sealed architectural drawings", fromWhom: "James Whitfield (Architect)", requestedDate: "02/10/2026", daysWaiting: 6, done: false, linkedServiceId: "se1" },
  { id: "cle2", category: "missing_document", label: "ACP5 asbestos report", fromWhom: "EcoTest Labs", requestedDate: "02/15/2026", daysWaiting: 1, done: false, linkedServiceId: "se1" },
  { id: "cle3", category: "pending_signature", label: "Owner e-sign on DOB NOW application", fromWhom: "Margaret Chen", requestedDate: "02/14/2026", daysWaiting: 2, done: false },
  { id: "cle4", category: "pending_response", label: "GC construction schedule", fromWhom: "Carlos Rivera (Rivera Construction)", requestedDate: "02/12/2026", daysWaiting: 4, done: false, linkedServiceId: "se4" },
  { id: "cle5", category: "missing_info", label: "Lead paint survey determination", fromWhom: "DOB / Internal", requestedDate: "02/15/2026", daysWaiting: 1, done: false },
  { id: "cle6", category: "missing_document", label: "DOB NOW filing fee payment authorization", fromWhom: "Margaret Chen", requestedDate: "02/10/2026", daysWaiting: 6, done: false },
  { id: "cle7", category: "missing_document", label: "Preliminary plans reviewed and annotated", fromWhom: "Internal", requestedDate: "01/20/2026", daysWaiting: 27, done: true },
];

const MOCK_PIS_E: MockPISStatus = {
  sentDate: "01/16/2026",
  totalFields: 7,
  completedFields: 5,
  missingFields: ["GC DOB NOW email", "Lead paint survey status"],
};

const MOCK_PROPOSAL_SIG_E: MockProposalSignature = {
  proposalNumber: "011526-2",
  fullyExecuted: true,
  internalSignedDate: "01/14/2026",
  clientSignedDate: "01/15/2026",
  internalSigner: "Don Speaker",
  clientSigner: "Margaret Chen",
};

// --- Export sets ---

export const SERVICE_SETS = [MOCK_SERVICES_A, MOCK_SERVICES_B, MOCK_SERVICES_C, MOCK_SERVICES_A, MOCK_SERVICES_E];
export const CONTACT_SETS = [MOCK_CONTACTS_A, MOCK_CONTACTS_B, MOCK_CONTACTS_C, MOCK_CONTACTS_A, MOCK_CONTACTS_E];
export const MILESTONE_SETS = [MOCK_MILESTONES_A, MOCK_MILESTONES_B, MOCK_MILESTONES_C, MOCK_MILESTONES_A, MOCK_MILESTONES_E];
export const CO_SETS = [MOCK_CHANGE_ORDERS_A, MOCK_CHANGE_ORDERS_B, MOCK_CHANGE_ORDERS_C, MOCK_CHANGE_ORDERS_A, MOCK_CHANGE_ORDERS_E];
export const EMAIL_SETS = [MOCK_EMAILS_A, MOCK_EMAILS_B, MOCK_EMAILS_C, MOCK_EMAILS_A, MOCK_EMAILS_E];
export const DOCUMENT_SETS = [MOCK_DOCUMENTS_A, MOCK_DOCUMENTS_B, MOCK_DOCUMENTS_C, MOCK_DOCUMENTS_A, MOCK_DOCUMENTS_E];
export const TIME_SETS = [MOCK_TIME_A, MOCK_TIME_B, MOCK_TIME_C, MOCK_TIME_A, MOCK_TIME_E];
export const CHECKLIST_SETS = [MOCK_CHECKLIST_A, MOCK_CHECKLIST_B, MOCK_CHECKLIST_C, MOCK_CHECKLIST_A, MOCK_CHECKLIST_E];

const MOCK_PIS_D: MockPISStatus = {
  sentDate: null,
  totalFields: 7,
  completedFields: 0,
  missingFields: ["Owner Info", "Architect Info", "DOB Roles", "Insurance Certs", "Site Contact", "Billing Contact", "Special Access"],
};

export const PIS_SETS = [MOCK_PIS_A, MOCK_PIS_B, MOCK_PIS_C, MOCK_PIS_D, MOCK_PIS_E];
export const PROPOSAL_SIG_SETS = [MOCK_PROPOSAL_SIG_A, MOCK_PROPOSAL_SIG_B, MOCK_PROPOSAL_SIG_C, MOCK_PROPOSAL_SIG_A, MOCK_PROPOSAL_SIG_E];

// --- Shared configs ---

export const serviceStatusStyles: Record<string, { label: string; className: string }> = {
  not_started: { label: "Not Started", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  complete: { label: "Complete", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  billed: { label: "Billed", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
  dropped: { label: "Dropped", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 line-through" },
};

export const dobRoleLabels: Record<string, string> = {
  applicant: "Applicant",
  owner: "Owner",
  filing_rep: "Filing Rep",
  architect: "Architect",
  engineer: "Engineer",
  gc: "General Contractor",
  sia_applicant: "SIA Applicant",
  tpp_applicant: "TPP Applicant",
  other: "Other",
};

export const coStatusStyles: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

export const docCategoryLabels: Record<string, string> = {
  plans: "Plans",
  dob: "DOB",
  insurance: "Insurance",
  contract: "Contract",
  change_order: "Change Order",
  reports: "Reports",
  permits: "Permits",
  correspondence: "Correspondence",
  general: "General",
  other: "Other",
};

export const checklistCategoryLabels: Record<string, { label: string; icon: string }> = {
  missing_document: { label: "Missing Documents", icon: "📄" },
  missing_info: { label: "Missing Info", icon: "❓" },
  pending_signature: { label: "Pending Signatures", icon: "✍️" },
  pending_response: { label: "Pending Responses", icon: "⏳" },
  ai_follow_up: { label: "AI Follow-Up", icon: "🤖" },
};

export const formatCurrency = (value: number | null) => {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);
};
