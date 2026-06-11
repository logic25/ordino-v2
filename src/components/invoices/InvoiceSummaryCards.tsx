import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Send, AlertTriangle, CheckCircle, Wallet } from "lucide-react";
import type { InvoiceStatus, InvoiceCounts } from "@/hooks/useInvoices";
import type { BillingTab } from "@/components/invoices/InvoiceFilterTabs";

interface InvoiceSummaryCardsProps {
  counts: InvoiceCounts;
  totals: Record<InvoiceStatus, number>;
  pendingBillingTotal?: number;
  pendingBillingCount?: number;
  activeFilter: BillingTab;
  onFilterChange: (filter: BillingTab) => void;
  depositSummary?: { totalBalance: number; activeCount: number };
}

const cardTooltips: Record<string, string> = {
  to_invoice: "Submissions from PMs plus drafts/ready-to-send invoices waiting on you to bill",
  sent: "Invoices that have been delivered to clients and are awaiting payment",
  overdue: "Invoices past their due date that haven't been paid yet",
  paid: "Invoices that have been fully paid this month",
  needs_review: "Invoices flagged for review — open the invoice detail and change status to 'Needs Review' to flag one",
  deposits: "Client deposit balances available to apply toward future invoices",
};

export function InvoiceSummaryCards({ counts, totals, pendingBillingTotal = 0, pendingBillingCount = 0, activeFilter, onFilterChange, depositSummary }: InvoiceSummaryCardsProps) {
  const readyToInvoiceAmount = (totals.draft || 0) + (totals.ready_to_send || 0) + pendingBillingTotal;
  const readyToInvoiceParts: string[] = [];
  if (pendingBillingCount > 0) readyToInvoiceParts.push(`${pendingBillingCount} submission${pendingBillingCount === 1 ? "" : "s"}`);
  if (counts.ready_to_send > 0) readyToInvoiceParts.push(`${counts.ready_to_send} ready`);
  if (counts.draft > 0) readyToInvoiceParts.push(`${counts.draft} draft${counts.draft === 1 ? "" : "s"}`);
  const readyToInvoiceSubtitle = readyToInvoiceParts.length ? readyToInvoiceParts.join(" · ") : "All clear";

  const cards: {
    key: BillingTab;
    label: string;
    icon: typeof FileText;
    amount: number;
    subtitle: string;
    colorClass: string;
  }[] = [
    {
      key: "to_invoice",
      label: "Ready to Invoice",
      icon: FileText,
      amount: readyToInvoiceAmount,
      subtitle: readyToInvoiceSubtitle,
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
  ];
  // Needs Review intentionally removed as a top-level card — it now lives inside the
  // "Ready to Invoice" worklist as a filter chip so accounting works it in one place.

  if (depositSummary) {
    cards.push({
      key: "deposits",
      label: "Deposits",
      icon: Wallet,
      amount: depositSummary.totalBalance,
      subtitle: `${depositSummary.activeCount} clients`,
      colorClass: "text-primary",
    });
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          const isActive = activeFilter === card.key;
          return (
            <Tooltip key={card.key}>
              <TooltipTrigger asChild>
                <Card
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
                    <div className="text-2xl font-bold" data-clarity-mask="true">
                      ${card.amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-center">
                <p className="text-xs">{cardTooltips[card.key] || card.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
