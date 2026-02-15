import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { BillingCalendarItem } from "@/hooks/useBillingCalendarItems";

export const EVENT_TYPE_LABELS: Record<string, string> = {
  inspection: "Inspection",
  hearing: "Hearing",
  deadline: "Deadline",
  meeting: "Meeting",
  site_visit: "Site Visit",
  filing: "Filing",
  milestone: "Milestone",
  general: "General",
  invoice_due: "Invoice Due",
  follow_up: "Follow-up",
  installment: "Installment",
  promise: "Promise",
  rfp_deadline: "RFP Deadline",
};

export const BILLING_EVENT_TYPES = new Set([
  "invoice_due",
  "follow_up",
  "installment",
  "promise",
  "rfp_deadline",
]);

export const EVENT_TYPE_COLORS: Record<string, string> = {
  inspection: "bg-orange-500/20 text-orange-700 border-orange-300",
  hearing: "bg-red-500/20 text-red-700 border-red-300",
  deadline: "bg-yellow-500/20 text-yellow-700 border-yellow-300",
  meeting: "bg-blue-500/20 text-blue-700 border-blue-300",
  site_visit: "bg-green-500/20 text-green-700 border-green-300",
  filing: "bg-purple-500/20 text-purple-700 border-purple-300",
  milestone: "bg-pink-500/20 text-pink-700 border-pink-300",
  general: "bg-muted text-muted-foreground border-border",
  invoice_due: "bg-emerald-500/20 text-emerald-700 border-emerald-300",
  follow_up: "bg-amber-500/20 text-amber-700 border-amber-300",
  installment: "bg-cyan-500/20 text-cyan-700 border-cyan-300",
  promise: "bg-violet-500/20 text-violet-700 border-violet-300",
  rfp_deadline: "bg-rose-500/20 text-rose-700 border-rose-300",
};

export type UnifiedEvent = (CalendarEvent | BillingCalendarItem) & {
  is_billing?: boolean;
};

export type CalendarViewMode = "month" | "week" | "day";
