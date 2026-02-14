import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/hooks/useInvoices";

const statusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  ready_to_send: { label: "Ready", className: "bg-info/15 text-info border-info/30" },
  needs_review: { label: "Needs Review", className: "bg-warning/15 text-warning border-warning/30" },
  sent: { label: "Sent", className: "bg-primary/15 text-primary border-primary/30" },
  overdue: { label: "Overdue", className: "bg-destructive/15 text-destructive border-destructive/30" },
  paid: { label: "Paid", className: "bg-success/15 text-success border-success/30" },
  legal_hold: { label: "Legal Hold", className: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" },
};

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
