import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Send, AlertTriangle, CheckCircle, Clock, Wallet } from "lucide-react";
import type { InvoiceStatus, InvoiceCounts } from "@/hooks/useInvoices";
import type { BillingTab } from "@/components/invoices/InvoiceFilterTabs";

interface InvoiceSummaryCardsProps {
  counts: InvoiceCounts;
  totals: Record<InvoiceStatus, number>;
  activeFilter: BillingTab;
  onFilterChange: (filter: BillingTab) => void;
  retainerSummary?: { totalBalance: number; activeCount: number };
}

export function InvoiceSummaryCards({ counts, totals, activeFilter, onFilterChange, retainerSummary }: InvoiceSummaryCardsProps) {
  const cards: {
    key: BillingTab;
    label: string;
    icon: typeof FileText;
    amount: number;
    subtitle: string;
    colorClass: string;
  }[] = [
    {
      key: "draft",
      label: "Draft",
      icon: FileText,
      amount: totals.draft + totals.ready_to_send,
      subtitle: counts.ready_to_send > 0 ? `${counts.ready_to_send} ready, ${counts.draft} drafts` : `${counts.draft} invoices`,
      colorClass: "text-muted-foreground",
    },
    {
      key: "sent",
      label: "Sent",
      icon: Send,
      amount: totals.sent,
      subtitle: `${counts.sent} invoices`,
      colorClass: "text-primary",
    },
    {
      key: "overdue",
      label: "Overdue",
      icon: AlertTriangle,
      amount: totals.overdue,
      subtitle: `${counts.overdue} invoices`,
      colorClass: "text-destructive",
    },
    {
      key: "paid",
      label: "Paid",
      icon: CheckCircle,
      amount: totals.paid,
      subtitle: "This month",
      colorClass: "text-success",
    },
    {
      key: "needs_review",
      label: "Needs Review",
      icon: Clock,
      amount: totals.needs_review,
      subtitle: counts.needs_review > 0 ? "Requires action" : "All clear",
      colorClass: "text-warning",
    },
  ];

  // Add retainer card if data provided
  if (retainerSummary) {
    cards.push({
      key: "retainers",
      label: "Retainers",
      icon: Wallet,
      amount: retainerSummary.totalBalance,
      subtitle: `${retainerSummary.activeCount} clients`,
      colorClass: "text-primary",
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
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
