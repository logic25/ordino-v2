import { Activity } from "lucide-react";
import { format } from "date-fns";
import type { InvoiceWithRelations } from "@/hooks/useInvoices";
import { METHOD_LABELS } from "./FollowUpNotesSection";

interface ActivityLogSectionProps {
  invoice: InvoiceWithRelations;
  activityLog: any[] | undefined;
}

export function ActivityLogSection({ invoice, activityLog }: ActivityLogSectionProps) {
  // Build combined timeline: explicit log entries + synthetic entries from invoice timestamps
  const syntheticEntries: { id: string; created_at: string; action: string; details: string | null }[] = [];

  if (invoice.created_at) {
    syntheticEntries.push({ id: "syn-created", created_at: invoice.created_at, action: "created", details: `Invoice ${invoice.invoice_number} created` });
  }
  if (invoice.sent_at && !(activityLog || []).some((e) => e.action === "sent")) {
    syntheticEntries.push({ id: "syn-sent", created_at: invoice.sent_at, action: "sent", details: "Invoice sent" });
  }
  if (invoice.paid_at && !(activityLog || []).some((e) => e.action === "paid")) {
    const paymentDetails = ["Payment received", invoice.payment_method ? `via ${invoice.payment_method}` : null, invoice.payment_amount ? `$${Number(invoice.payment_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : null].filter(Boolean).join(" — ");
    syntheticEntries.push({ id: "syn-paid", created_at: invoice.paid_at, action: "paid", details: paymentDetails });
  }

  const explicitActions = new Set((activityLog || []).map((e) => e.action));
  const filtered = syntheticEntries.filter((s) => !explicitActions.has(s.action));
  const combined = [...(activityLog || []), ...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium text-muted-foreground">Activity Log</h4>
      </div>
      {combined.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded</p>
      ) : (
        <div className="space-y-1.5">
          {combined.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground whitespace-nowrap">{format(new Date(entry.created_at), "M/d/yy h:mm a")}</span>
              <span className="font-medium">{METHOD_LABELS[entry.action] || entry.action}</span>
              {entry.details && <span className="text-muted-foreground truncate">— {entry.details}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
