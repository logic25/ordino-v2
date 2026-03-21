import { format } from "date-fns";
import { Mail, MailOpen, Clock } from "lucide-react";
import type { InvoiceWithRelations } from "@/hooks/useInvoices";

interface DeliveryStatusSectionProps {
  invoice: InvoiceWithRelations;
}

export function DeliveryStatusSection({ invoice }: DeliveryStatusSectionProps) {
  const isOverdue = invoice.status === "overdue";

  return (
    <section>
      <h4 className="text-sm font-medium text-muted-foreground mb-2">Delivery Status</h4>
      {invoice.sent_at ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-primary" />
            <span>Sent on {format(new Date(invoice.sent_at), "MMMM d, yyyy 'at' h:mm a")}</span>
          </div>
          {invoice.paid_at && (
            <div className="flex items-center gap-2 text-sm">
              <MailOpen className="h-4 w-4 text-success" />
              <span>Paid on {format(new Date(invoice.paid_at), "MMMM d, yyyy 'at' h:mm a")}</span>
            </div>
          )}
          {isOverdue && invoice.due_date && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <Clock className="h-4 w-4" />
              <span>Overdue since {format(new Date(invoice.due_date), "MMMM d, yyyy")}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Not yet sent</p>
      )}
    </section>
  );
}
