import { z } from "zod";

export const FEE_TYPES = [
  { value: "fixed", label: "Fixed" },
  { value: "monthly", label: "Monthly" },
  { value: "hourly", label: "Hourly" },
] as const;

export const LEAD_SOURCES = [
  "Referral", "Website", "Cold Call", "Architect", "Repeat Client", "Walk-in", "Other",
] as const;

export const PROJECT_TYPES = [
  "Residential", "Commercial", "Industrial", "Mixed-Use", "Institutional", "Healthcare", "Hospitality", "Retail", "Other",
] as const;

export const STEPS = [
  { key: "property", label: "Property & Contacts" },
  { key: "parties", label: "Parties & Plans" },
  { key: "services", label: "Services" },
  { key: "details", label: "Details & Terms" },
] as const;

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  quantity: z.coerce.number().min(0),
  unit_price: z.coerce.number().min(0),
  estimated_hours: z.coerce.number().min(0).optional(),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
  fee_type: z.string().optional(),
  sort_order: z.number().optional(),
  is_optional: z.boolean().optional(),
  disciplines: z.array(z.string()).optional(),
  discipline_fee: z.coerce.number().min(0).optional(),
});

export const proposalSchema = z.object({
  property_id: z.string().min(1, "Property is required"),
  title: z.string().min(1, "Title is required"),
  payment_terms: z.string().optional(),
  deposit_required: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().min(0).optional()),
  deposit_percentage: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().min(0).max(100).optional()),
  valid_until: z.string().optional(),
  client_id: z.string().optional(),
  client_name: z.string().optional(),
  client_email: z.string().email().optional().or(z.literal("")),
  assigned_pm_id: z.string().optional(),
  notes: z.string().optional(),
  terms_conditions: z.string().optional(),
  lead_source: z.string().optional(),
  referred_by: z.string().optional(),
  referred_by_person: z.string().optional(),
  project_type: z.string().optional(),
  sales_person_id: z.string().optional(),
  billed_to_name: z.string().optional(),
  billed_to_email: z.string().email().optional().or(z.literal("")),
  reminder_date: z.string().optional(),
  notable: z.boolean().optional(),
  job_description: z.string().optional(),
  unit_number: z.string().optional(),
  architect_company: z.string().optional(),
  architect_name: z.string().optional(),
  architect_phone: z.string().optional(),
  architect_email: z.string().optional(),
  architect_license_type: z.string().optional(),
  architect_license_number: z.string().optional(),
  gc_company: z.string().optional(),
  gc_name: z.string().optional(),
  gc_phone: z.string().optional(),
  gc_email: z.string().optional(),
  sia_name: z.string().optional(),
  sia_company: z.string().optional(),
  sia_phone: z.string().optional(),
  sia_email: z.string().optional(),
  tpp_name: z.string().optional(),
  tpp_email: z.string().optional(),
  items: z.array(itemSchema),
});

export type ProposalFormData = z.infer<typeof proposalSchema>;

export const DEFAULT_ITEM = {
  name: "", description: "", quantity: 1, unit_price: 0,
  estimated_hours: 0, discount_percent: 0, fee_type: "fixed",
  is_optional: false,
} as const;

export function getDefaultValues(defaultPropertyId?: string, defaultTerms?: string): ProposalFormData {
  return {
    property_id: defaultPropertyId || "", title: "", payment_terms: "",
    deposit_required: undefined, deposit_percentage: undefined,
    valid_until: "", client_id: "", client_name: "", client_email: "",
    assigned_pm_id: "",
    notes: "", terms_conditions: defaultTerms || "", lead_source: "", referred_by: "", referred_by_person: "",
    project_type: "", sales_person_id: "", billed_to_name: "",
    billed_to_email: "", reminder_date: "", notable: false,
    architect_company: "", architect_name: "", architect_phone: "", architect_email: "",
    architect_license_type: "", architect_license_number: "",
    gc_company: "", gc_name: "", gc_phone: "", gc_email: "",
    sia_name: "", sia_company: "", sia_phone: "", sia_email: "",
    tpp_name: "", tpp_email: "",
    job_description: "", unit_number: "",
    items: [{ ...DEFAULT_ITEM }],
  };
}

export function calculateLineTotal(item: { quantity?: number; unit_price?: number; discount_percent?: number; discipline_fee?: number; disciplines?: string[] }) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unit_price) || 0;
  const discountPct = Number(item.discount_percent) || 0;
  const disciplineFee = Number(item.discipline_fee) || 0;
  const disciplineCount = (item.disciplines || []).length;
  const subtotal = (qty * price) + (disciplineFee * disciplineCount);
  return subtotal - subtotal * (discountPct / 100);
}

// Re-export from canonical location for backward compat
export { formatCurrency } from "@/lib/utils";
