import type { InvoiceStatus } from "@/hooks/useInvoices";

/**
 * Derives the *effective* status of an invoice.
 *
 * The DB only stores transitions that we manually trigger (draft → ready → sent → paid).
 * Nothing automatically flips a `sent` invoice to `overdue` once its due_date passes.
 * Treat `sent` + `due_date < today` as overdue on read so counts/totals/badges stay accurate
 * without needing a cron job.
 */
export function effectiveStatus(invoice: {
  status: InvoiceStatus | string | null | undefined;
  due_date?: string | null;
}): InvoiceStatus {
  const status = (invoice.status || "draft") as InvoiceStatus;
  if (status !== "sent") return status;
  if (!invoice.due_date) return status;
  const due = new Date(invoice.due_date);
  if (isNaN(due.getTime())) return status;
  // Compare date-only (ignore time-of-day) — overdue starts the day after due.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today ? "overdue" : status;
}

export function isEffectivelyOverdue(invoice: {
  status: InvoiceStatus | string | null | undefined;
  due_date?: string | null;
}): boolean {
  return effectiveStatus(invoice) === "overdue";
}
