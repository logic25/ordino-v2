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
  notes: string;
  needsDobFiling: boolean;
  tasks: MockTask[];
  requirements: MockRequirement[];
  allottedHours: number;
}

export interface MockContact {
  id: string;
  name: string;
  role: string;
  company: string;
  phone: string;
  email: string;
  dobRole: "applicant" | "owner" | "filing_rep" | "architect" | "engineer" | "gc" | "other";
  source: "proposal" | "pis" | "manual";
  dobRegistered: "registered" | "not_registered" | "unknown";
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
  sentDate: string;
  totalFields: number;
  completedFields: number;
  missingFields: string[];
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
  { id: "s1", name: "OER Approval", status: "in_progress", application: { jobNumber: "421639356", type: "FA" }, subServices: [], totalAmount: 750, billedAmount: 0, costAmount: 175, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "Obtain Office of Environmental Remediation approval for the project site.", notes: "", needsDobFiling: false, tasks: [{ id: "t1", text: "Submit OER application", done: true }, { id: "t2", text: "Follow up on OER status", done: false, assignedTo: "Natalia S.", dueDate: "02/20/2026" }], requirements: [{ id: "r1", label: "ACP5 form received", met: false, detail: "Awaiting from landlord" }, { id: "r2", label: "OER application submitted", met: true }], allottedHours: 3 },
  { id: "s2", name: "Work Permit", status: "not_started", application: null, subServices: ["OT"], totalAmount: 250, billedAmount: 0, costAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "File and obtain work permit for overtime work at the site.", notes: "", needsDobFiling: true, tasks: [], requirements: [{ id: "r3", label: "DOB application approved", met: false }, { id: "r4", label: "Insurance cert on file", met: true }], allottedHours: 1 },
  { id: "s3", name: "Letter of Completion", status: "not_started", application: null, subServices: [], totalAmount: 750, billedAmount: 0, costAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "06/30/2026", billedAt: null, scopeOfWork: "Obtain Letter of Completion from DOB upon project completion.", notes: "", needsDobFiling: false, tasks: [{ id: "t3", text: "Go to DOB to pick up LOC", done: false, assignedTo: "Sheri L.", dueDate: "06/25/2026" }], requirements: [{ id: "r5", label: "All inspections passed", met: false }, { id: "r6", label: "Final sign-off received", met: false }], allottedHours: 2 },
  { id: "s4", name: "Alteration Type 2 D14 Approval", status: "in_progress", application: { jobNumber: "520112847", type: "ALT2" }, subServices: ["MH", "PL", "SP"], totalAmount: 4500, billedAmount: 0, costAmount: 393.75, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "File the required applications and plans with the DOB.\nAttend the required plan examinations to review & resolve issued objections as required to obtain approval.", notes: "Waiting on structural calcs from architect for beam support.", needsDobFiling: false, tasks: [{ id: "t4", text: "Request structural calcs from Antonio", done: true }, { id: "t5", text: "Respond to DOB objection", done: false, assignedTo: "Natalia S.", dueDate: "02/18/2026" }], requirements: [{ id: "r7", label: "Structural calcs received", met: false, detail: "Requested from Antonio 02/14" }, { id: "r8", label: "Plans sealed with job numbers", met: false }, { id: "r9", label: "Landlord e-sign complete", met: false }], allottedHours: 12 },
  { id: "s5", name: "Work Permit", status: "not_started", application: null, subServices: ["MH"], totalAmount: 250, billedAmount: 0, costAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "File and obtain mechanical work permit.", notes: "", needsDobFiling: true, tasks: [], requirements: [{ id: "r10", label: "MH application approved", met: false }], allottedHours: 1 },
  { id: "s6", name: "Letter of Completion", status: "not_started", application: null, subServices: [], totalAmount: 750, billedAmount: 0, costAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "06/30/2026", billedAt: null, scopeOfWork: "Obtain Letter of Completion for mechanical systems.", notes: "", needsDobFiling: false, tasks: [], requirements: [{ id: "r11", label: "MH inspections passed", met: false }], allottedHours: 2 },
];

const MOCK_SERVICES_B: MockService[] = [
  { id: "s7", name: "Zoning Analysis", status: "billed", application: { jobNumber: "520112847", type: "ALT2" }, subServices: [], totalAmount: 1200, billedAmount: 1200, costAmount: 525, assignedTo: "Sheri L.", estimatedBillDate: "01/15/2026", billedAt: "01/18/2026", scopeOfWork: "Complete zoning analysis and confirm project compliance.", notes: "Completed ahead of schedule.", needsDobFiling: false, tasks: [], requirements: [], allottedHours: 4 },
  { id: "s8", name: "DOB Filing", status: "in_progress", application: { jobNumber: "520112847", type: "ALT2" }, subServices: ["GC"], totalAmount: 650, billedAmount: 0, costAmount: 262.50, assignedTo: "Natalia S.", estimatedBillDate: "02/28/2026", billedAt: null, scopeOfWork: "Prepare and submit DOB application.", notes: "Square footage discrepancy — need architect confirmation.", needsDobFiling: false, tasks: [{ id: "t6", text: "Confirm sq footage with architect", done: false, assignedTo: "Natalia S.", dueDate: "02/20/2026" }], requirements: [{ id: "r12", label: "Square footage confirmed", met: false, detail: "Discrepancy found" }], allottedHours: 4 },
  { id: "s9", name: "Expediting", status: "not_started", application: null, subServices: [], totalAmount: 500, billedAmount: 0, costAmount: 0, assignedTo: "Sheri L.", estimatedBillDate: "03/15/2026", billedAt: null, scopeOfWork: "Expedite DOB review process.", notes: "", needsDobFiling: true, tasks: [], requirements: [{ id: "r13", label: "Application filed", met: true }], allottedHours: 3 },
  { id: "s10", name: "Inspections Coordination", status: "not_started", application: null, subServices: ["GC", "MH"], totalAmount: 400, billedAmount: 0, costAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "04/30/2026", billedAt: null, scopeOfWork: "Schedule and coordinate all required DOB inspections.", notes: "", needsDobFiling: false, tasks: [], requirements: [{ id: "r14", label: "Work permit issued", met: false }], allottedHours: 6 },
];

// --- Contacts ---

const MOCK_CONTACTS_A: MockContact[] = [
  { id: "c1", name: "Mayra Maisch", role: "Project Contact", company: "BGO", phone: "(212) 555-0101", email: "mayra@bgo.com", dobRole: "owner", source: "proposal", dobRegistered: "registered" },
  { id: "c2", name: "Antonio Rossi", role: "Architect of Record", company: "Rossi Architecture", phone: "(212) 555-0202", email: "antonio@rossiarch.com", dobRole: "architect", source: "proposal", dobRegistered: "registered" },
  { id: "c3", name: "Natalia Smith", role: "Filing Representative", company: "GLE", phone: "(212) 555-0303", email: "natalia@gle.com", dobRole: "filing_rep", source: "manual", dobRegistered: "registered" },
  { id: "c4", name: "David Chen", role: "Structural Engineer", company: "Chen Engineering", phone: "(212) 555-0404", email: "david@cheneng.com", dobRole: "engineer", source: "pis", dobRegistered: "not_registered" },
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
  { id: "te1", date: "02/14/2026", user: "Natalia S.", service: "Alteration Type 2 D14 Approval", hours: 1.5, description: "Reviewed objection, drafted response", billable: true },
  { id: "te2", date: "02/10/2026", user: "Natalia S.", service: "OER Approval", hours: 1.0, description: "Submitted OER application online", billable: true },
  { id: "te3", date: "02/10/2026", user: "Natalia S.", service: "Alteration Type 2 D14 Approval", hours: 0.75, description: "Filed DOB application #421639356", billable: true },
  { id: "te4", date: "02/08/2026", user: "Natalia S.", service: "Alteration Type 2 D14 Approval", hours: 2.0, description: "Prepared application documents", billable: true },
  { id: "te5", date: "02/07/2026", user: "Natalia S.", service: "OER Approval", hours: 0.5, description: "Reviewed plans for OER requirements", billable: true },
];

const MOCK_TIME_B: MockTimeEntry[] = [
  { id: "te6", date: "01/18/2026", user: "Sheri L.", service: "Zoning Analysis", hours: 3.0, description: "Completed full zoning analysis", billable: true },
  { id: "te7", date: "01/20/2026", user: "Natalia S.", service: "DOB Filing", hours: 1.5, description: "Prepared and submitted ALT2 application", billable: true },
];

// --- Project C: 331 Port Richmond Ave (from email / Ordino screenshot) ---

const MOCK_SERVICES_C: MockService[] = [
  { id: "sc1", name: "Alteration Type 1 Approval (ALT-CO)", status: "in_progress", application: { jobNumber: "S00701588-I1", type: "ALT-CO" }, subServices: ["OT"], totalAmount: 4300, billedAmount: 0, costAmount: 1272.50, assignedTo: "Don Speaker", estimatedBillDate: null, billedAt: null, scopeOfWork: "File the required applications and plans with the DOB. Attend the required plan examinations to review & resolve issued objections as required to obtain approval.", notes: "Plans came in Feb. Pending restrictive declaration from owner to proceed with plan review. 3 DOB comments outstanding:\n1. Provide all missing dimensions on plan\n2. DEP Sewer Certification (may be able to waive)\n3. Provide elevations and sections", needsDobFiling: false, tasks: [{ id: "tc1", text: "Follow up with architect on drawing revisions", done: false, assignedTo: "Don Speaker", dueDate: "01/27/2026" }, { id: "tc2", text: "Research DEP sewer certification waiver path", done: true, assignedTo: "Don Speaker" }, { id: "tc3", text: "Schedule DOB plan exam appointment", done: false, assignedTo: "Don Speaker" }], requirements: [{ id: "rc1", label: "Revised drawings with dimensions", met: false, detail: "Architect poked 01/20, no response", fromWhom: "Dave McAlpine" }, { id: "rc2", label: "DEP Sewer Certification (or waiver)", met: false, detail: "Exploring waiver via AI-1", fromWhom: "DEP / Architect" }, { id: "rc3", label: "Elevations and sections on plans", met: false, detail: "Architect said he'd add to list", fromWhom: "Dave McAlpine" }, { id: "rc4", label: "Restrictive declaration from owner", met: false, detail: "Pending from owner", fromWhom: "David Batista (Owner)" }], allottedHours: 9 },
  { id: "sc2", name: "Work Permit", status: "not_started", application: null, subServices: ["OT"], totalAmount: 500, billedAmount: 0, costAmount: 0, assignedTo: "Don Speaker", estimatedBillDate: null, billedAt: null, scopeOfWork: "File and obtain work permit after approval.", notes: "Pending restrictive declaration from owner to proceed with plan review.", needsDobFiling: true, tasks: [], requirements: [{ id: "rc5", label: "ALT-CO approval obtained", met: false, fromWhom: "DOB" }], allottedHours: 1 },
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
  { id: "cc1", name: "David Batista", role: "Owner / Client Contact", company: "Batler Food Corp", phone: "(718) 555-0601", email: "david@batlerfood.com", dobRole: "owner", source: "proposal", dobRegistered: "registered" },
  { id: "cc2", name: "Dave McAlpine", role: "Architect of Record", company: "McAlpine Associates", phone: "(718) 555-0602", email: "mcalpineassociates@gmail.com", dobRole: "architect", source: "proposal", dobRegistered: "registered" },
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

// --- Export sets ---

export const SERVICE_SETS = [MOCK_SERVICES_A, MOCK_SERVICES_B, MOCK_SERVICES_C];
export const CONTACT_SETS = [MOCK_CONTACTS_A, MOCK_CONTACTS_B, MOCK_CONTACTS_C];
export const MILESTONE_SETS = [MOCK_MILESTONES_A, MOCK_MILESTONES_B, MOCK_MILESTONES_C];
export const CO_SETS = [MOCK_CHANGE_ORDERS_A, MOCK_CHANGE_ORDERS_B, MOCK_CHANGE_ORDERS_C];
export const EMAIL_SETS = [MOCK_EMAILS_A, MOCK_EMAILS_B, MOCK_EMAILS_C];
export const DOCUMENT_SETS = [MOCK_DOCUMENTS_A, MOCK_DOCUMENTS_B, MOCK_DOCUMENTS_C];
export const TIME_SETS = [MOCK_TIME_A, MOCK_TIME_B, MOCK_TIME_C];
export const CHECKLIST_SETS = [MOCK_CHECKLIST_A, MOCK_CHECKLIST_B, MOCK_CHECKLIST_C];
export const PIS_SETS = [MOCK_PIS_A, MOCK_PIS_B, MOCK_PIS_C];
export const PROPOSAL_SIG_SETS = [MOCK_PROPOSAL_SIG_A, MOCK_PROPOSAL_SIG_B, MOCK_PROPOSAL_SIG_C];

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
  reports: "Reports",
  permits: "Permits",
  correspondence: "Correspondence",
  other: "Other",
};

export const checklistCategoryLabels: Record<string, { label: string; icon: string }> = {
  missing_document: { label: "Missing Documents", icon: "📄" },
  missing_info: { label: "Missing Info", icon: "❓" },
  pending_signature: { label: "Pending Signatures", icon: "✍️" },
  pending_response: { label: "Pending Responses", icon: "⏳" },
};

export const formatCurrency = (value: number | null) => {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);
};
