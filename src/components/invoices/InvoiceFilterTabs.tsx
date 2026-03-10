import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InvoiceStatus } from "@/hooks/useInvoices";

export type BillingTab = InvoiceStatus | "all" | "to_invoice" | "deposits" | "analytics" | "schedules";

interface InvoiceFilterTabsProps {
  activeTab: BillingTab;
  onTabChange: (tab: BillingTab) => void;
  counts: { [key: string]: number; total: number };
  pendingBillingCount?: number;
}

const tabs: { value: string; label: string; showCount?: boolean; countKey?: string }[] = [
  { value: "to_invoice", label: "To Invoice", showCount: true, countKey: "pending_billing" },
  { value: "sent", label: "Sent", showCount: true },
  { value: "overdue", label: "Overdue", showCount: true },
  { value: "paid", label: "Paid", showCount: true },
  { value: "deposits", label: "Deposits" },
  { value: "schedules", label: "Schedules" },
  { value: "analytics", label: "Analytics" },
];

export function InvoiceFilterTabs({ activeTab, onTabChange, counts, pendingBillingCount = 0 }: InvoiceFilterTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as BillingTab)}>
      <div className="overflow-x-auto scrollbar-hide">
      <TabsList className="h-auto bg-transparent p-0 gap-0 inline-flex w-auto">
        {tabs.map((tab) => {
          let count = 0;
          if (tab.countKey === "pending_billing") {
            count = pendingBillingCount;
          } else if (tab.showCount) {
            count = counts[tab.value] || 0;
          }
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="relative rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 text-sm font-medium text-muted-foreground transition-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-foreground"
            >
              {tab.label}
              {count > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                  {count}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      </div>
    </Tabs>
  );
}
