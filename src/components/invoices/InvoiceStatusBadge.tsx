import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { InvoiceStatus } from "@/hooks/useInvoices";

const statusConfig: Record<InvoiceStatus, { label: string; className: string; tooltip: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-border", tooltip: "Invoice is being prepared" },
  ready_to_send: { label: "Ready", className: "bg-info/15 text-info border-info/30", tooltip: "Reviewed and ready to send to client" },
  needs_review: { label: "Needs Review", className: "bg-warning/15 text-warning border-warning/30", tooltip: "Flagged for accounting review before sending" },
  sent: { label: "Sent", className: "bg-primary/15 text-primary border-primary/30", tooltip: "Delivered to client, awaiting payment" },
  overdue: { label: "Overdue", className: "bg-destructive/15 text-destructive border-destructive/30", tooltip: "Past due date — payment not yet received" },
  paid: { label: "Paid", className: "bg-success/15 text-success border-success/30", tooltip: "Payment received in full" },
  legal_hold: { label: "Legal Hold", className: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30", tooltip: "Under legal review — collections paused" },
};

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={config.className}>
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
