import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InvoiceStatus } from "@/hooks/useInvoices";

export type BillingTab = InvoiceStatus | "all" | "collections" | "promises" | "analytics";

interface InvoiceFilterTabsProps {
  activeTab: BillingTab;
  onTabChange: (tab: BillingTab) => void;
  counts: { [key: string]: number; total: number };
}

const tabs: { value: string; label: string; showCount?: boolean }[] = [
  { value: "all", label: "All", showCount: true },
  { value: "ready_to_send", label: "Ready to Send", showCount: true },
  { value: "needs_review", label: "Needs Review", showCount: true },
  { value: "sent", label: "Sent", showCount: true },
  { value: "overdue", label: "Overdue", showCount: true },
  { value: "paid", label: "Paid", showCount: true },
  { value: "legal_hold", label: "Legal Hold", showCount: true },
  { value: "collections", label: "Collections" },
  { value: "promises", label: "Promises" },
  { value: "analytics", label: "Analytics" },
];

export function InvoiceFilterTabs({ activeTab, onTabChange, counts }: InvoiceFilterTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as BillingTab)}>
      <TabsList className="h-auto bg-transparent p-0 gap-0">
        {tabs.map((tab) => {
          const count = tab.showCount ? (tab.value === "all" ? counts.total : counts[tab.value] || 0) : 0;
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
    </Tabs>
  );
}
