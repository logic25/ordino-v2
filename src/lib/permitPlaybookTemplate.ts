export type PlaybookSlotKind = "text" | "url" | "contact" | "fee" | "duration";

export type PlaybookQAItem = {
  id: string;
  question: string;
  answer: string;
  kind: PlaybookSlotKind;
  ai_generated?: boolean;
  source?: string | null;
  confidence?: number | null;
  verified?: boolean;
  verified_by?: string | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
};

export type PlaybookAttachment = {
  id: string;
  name: string;
  storage_path: string;
  size?: number;
  uploaded_at: string;
  uploaded_by?: string | null;
};

export const PLAYBOOK_STANDARD_SLOTS: { id: string; question: string; kind: PlaybookSlotKind }[] = [
  { id: "submission_method", question: "How is the application submitted (online, in person, mail)?", kind: "text" },
  { id: "turnaround", question: "What is the typical turnaround / review time?", kind: "duration" },
  { id: "fees", question: "What are the fees associated with filing this?", kind: "fee" },
  { id: "department_contact", question: "Who is the department contact (name, phone, email)?", kind: "contact" },
  { id: "required_forms", question: "What forms or documents are required?", kind: "text" },
  { id: "prerequisites", question: "What pre-requisites or approvals must happen first?", kind: "text" },
  { id: "inspections", question: "What inspections are required and how are they scheduled?", kind: "text" },
  { id: "renewal", question: "What is the renewal / expiration policy?", kind: "duration" },
  { id: "gotchas", question: "Known gotchas, common rejections, or local quirks?", kind: "text" },
];

export function makeEmptyQA(): PlaybookQAItem[] {
  return PLAYBOOK_STANDARD_SLOTS.map((s) => ({
    id: s.id,
    question: s.question,
    answer: "",
    kind: s.kind,
    ai_generated: false,
    verified: false,
  }));
}

export const COMMON_PERMIT_TYPES = [
  "Sign Permit",
  "Building Permit",
  "Alteration Permit",
  "Demolition Permit",
  "Plumbing Permit",
  "Electrical Permit",
  "Certificate of Occupancy",
  "Sidewalk Shed Permit",
];
