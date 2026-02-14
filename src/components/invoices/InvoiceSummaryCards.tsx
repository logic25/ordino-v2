import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Send, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import type { InvoiceStatus, InvoiceCounts } from "@/hooks/useInvoices";

interface InvoiceSummaryCardsProps {
  counts: InvoiceCounts;
  totals: Record<InvoiceStatus, number>;
  activeFilter: InvoiceStatus | "all";
  onFilterChange: (filter: InvoiceStatus | "all") => void;
}

export function InvoiceSummaryCards({ counts, totals, activeFilter, onFilterChange }: InvoiceSummaryCardsProps) {
  const cards = [
    {
      key: "draft" as const,
      label: "Draft",
      icon: FileText,
      count: counts.draft + counts.ready_to_send,
      amount: totals.draft + totals.ready_to_send,
      subtitle: counts.ready_to_send > 0 ? `${counts.ready_to_send} ready, ${counts.draft} drafts` : `${counts.draft} invoices`,
      colorClass: "text-muted-foreground",
    },
    {
      key: "sent" as const,
      label: "Sent",
      icon: Send,
      count: counts.sent,
      amount: totals.sent,
      subtitle: `${counts.sent} invoices`,
      colorClass: "text-primary",
    },
    {
      key: "overdue" as const,
      label: "Overdue",
      icon: AlertTriangle,
      count: counts.overdue,
      amount: totals.overdue,
      subtitle: `${counts.overdue} invoices`,
      colorClass: "text-destructive",
    },
    {
      key: "paid" as const,
      label: "Paid",
      icon: CheckCircle,
      count: counts.paid,
      amount: totals.paid,
      subtitle: "This month",
      colorClass: "text-success",
    },
    {
      key: "needs_review" as const,
      label: "Needs Review",
      icon: Clock,
      count: counts.needs_review,
      amount: totals.needs_review,
      subtitle: counts.needs_review > 0 ? "Requires action" : "All clear",
      colorClass: "text-warning",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.key;
        return (
          <Card
            key={card.key}
            className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
              isActive ? "ring-2 ring-accent border-accent" : ""
            }`}
            onClick={() => onFilterChange(isActive ? "all" : card.key)}
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className={`text-sm font-medium ${card.colorClass}`}>
                {card.label}
              </CardTitle>
              <Icon className={`h-4 w-4 ${card.colorClass}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${card.amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
