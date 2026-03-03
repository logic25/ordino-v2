import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Send, Trash2 } from "lucide-react";
import { BillingInboxView } from "@/components/invoices/BillingInboxView";
import { BillingSchedulesView } from "@/components/invoices/BillingSchedulesView";
import { InvoiceSummaryCards } from "@/components/invoices/InvoiceSummaryCards";
import { InvoiceFilterTabs, type BillingTab } from "@/components/invoices/InvoiceFilterTabs";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { CreateInvoiceDialog } from "@/components/invoices/CreateInvoiceDialog";
import { InvoiceDetailSheet } from "@/components/invoices/InvoiceDetailSheet";
import { QBOConnectionWidget } from "@/components/invoices/QBOConnectionWidget";
import { SendInvoiceModal } from "@/components/invoices/SendInvoiceModal";
import { SendToBillingDialog } from "@/components/invoices/SendToBillingDialog";
import { CollectionsView } from "@/components/invoices/CollectionsView";
import { RetainersView } from "@/components/invoices/RetainersView";
import { AnalyticsView } from "@/components/invoices/AnalyticsView";
import { PaidView } from "@/components/invoices/PaidView";
import { AutomationActivityPanel } from "@/components/invoices/AutomationActivityPanel";
import {
  useInvoices, useInvoiceCounts, useDeleteInvoice,
  type InvoiceStatus, type InvoiceWithRelations,
} from "@/hooks/useInvoices";
import { usePendingBillingCount } from "@/hooks/useBillingRequests";
import { useRetainers } from "@/hooks/useRetainers";
import { toast } from "@/hooks/use-toast";
import { useTelemetry } from "@/hooks/useTelemetry";

export default function Invoices() {
  const [activeFilter, setActiveFilter] = useState<BillingTab>("to_invoice");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<InvoiceWithRelations | null>(null);
  const [sendInvoice, setSendInvoice] = useState<InvoiceWithRelations | null>(null);
  const [billingOpen, setBillingOpen] = useState(false);
  const { track } = useTelemetry();

  const isSpecialTab = ["to_invoice", "deposits", "analytics", "schedules", "paid"].includes(activeFilter);
  const queryFilter = isSpecialTab ? "all" : activeFilter;
  const { data: dbInvoices = [], isLoading } = useInvoices(queryFilter as InvoiceStatus | "all");
  const { data: dbCounts } = useInvoiceCounts();
  const { data: pendingCount = 0 } = usePendingBillingCount();
  const { data: dbRetainers = [] } = useRetainers();
  const deleteInvoice = useDeleteInvoice();

  const depositSummary = useMemo(() => {
    const activeDeposits = dbRetainers.filter(r => r.status === "active");
    const totalBalance = activeDeposits.reduce((s, r) => s + Number(r.current_balance), 0);
    return {
      totalBalance,
      activeCount: activeDeposits.length,
    };
  }, [dbRetainers]);

  const counts = useMemo(() => {
    const dc = dbCounts || { draft: 0, ready_to_send: 0, needs_review: 0, sent: 0, overdue: 0, paid: 0, total: 0 };
    return dc;
  }, [dbCounts]);

  const totals = useMemo(() => {
    const t: Record<InvoiceStatus, number> = {
      draft: 0, ready_to_send: 0, needs_review: 0, sent: 0, overdue: 0, paid: 0, legal_hold: 0,
    };
    dbInvoices.forEach((inv) => {
      if (inv.status in t) {
        t[inv.status as InvoiceStatus] += Number(inv.total_due) || 0;
      }
    });
    return t;
  }, [dbInvoices]);

  const filteredInvoices = useMemo(() => {
    if (!search) return dbInvoices;
    const q = search.toLowerCase();
    return dbInvoices.filter(
      (inv) =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.clients?.name?.toLowerCase().includes(q) ||
        inv.projects?.name?.toLowerCase().includes(q) ||
        inv.projects?.project_number?.toLowerCase().includes(q)
    );
  }, [dbInvoices, search]);

  const handleDelete = async (id: string) => {
    try {
      await deleteInvoice.mutateAsync(id);
      toast({ title: "Invoice deleted" });
      setSelectedIds((prev) => prev.filter((s) => s !== id));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSendInvoice = (inv: InvoiceWithRelations) => {
    track("invoices", "send_started", { invoice_id: inv.id });
    setDetailInvoice(null);
    setSendInvoice(inv);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in" data-tour="billing-page">
        {/* Header */}
        <div className="flex items-center justify-between" data-tour="billing-header">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
            <p className="text-muted-foreground mt-1">
              Track invoices, collections, and payment status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </div>
        </div>

        <QBOConnectionWidget />

        <InvoiceSummaryCards
          counts={counts}
          totals={totals}
          activeFilter={activeFilter}
          onFilterChange={(f) => setActiveFilter(f)}
          depositSummary={depositSummary}
          data-tour="billing-summary-cards"
        />

        <Card>
          <div className="border-b overflow-hidden">
            <div className="flex items-end justify-between px-6 pt-4 pb-0 gap-4">
              <div className="min-w-0 overflow-x-auto flex-1">
                <InvoiceFilterTabs
                  activeTab={activeFilter}
                  onTabChange={setActiveFilter}
                  counts={counts as unknown as { [key: string]: number; total: number }}
                  pendingBillingCount={pendingCount}
                />
              </div>
              {!isSpecialTab && (
                <div className="relative w-56 shrink-0 pb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search invoices..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              )}
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 px-6 py-3 border-b bg-muted/30">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} selected
              </span>
              <Button variant="outline" size="sm">
                <Send className="h-4 w-4 mr-1" /> Approve & Send
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => selectedIds.forEach(handleDelete)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
          )}
          <CardContent className="pt-0 px-4">
            {activeFilter === "to_invoice" ? (
              <BillingInboxView />
            ) : activeFilter === "overdue" ? (
              <div className="space-y-6">
                <AutomationActivityPanel />
                <CollectionsView
                  invoices={dbInvoices}
                  onViewInvoice={(inv) => setDetailInvoice(inv)}
                  onSendReminder={handleSendInvoice}
                />
              </div>
            ) : activeFilter === "deposits" ? (
              <RetainersView />
            ) : activeFilter === "paid" ? (
              <PaidView />
            ) : activeFilter === "analytics" ? (
              <AnalyticsView />
            ) : activeFilter === "schedules" ? (
              <BillingSchedulesView />
            ) : (
              <InvoiceTable
                invoices={filteredInvoices}
                isLoading={isLoading}
                onViewInvoice={(inv) => setDetailInvoice(inv)}
                onSendInvoice={handleSendInvoice}
                onDeleteInvoice={handleDelete}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <CreateInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(inv) => setDetailInvoice(inv)} />
      <SendToBillingDialog open={billingOpen} onOpenChange={setBillingOpen} />

      <InvoiceDetailSheet
        invoice={detailInvoice}
        open={!!detailInvoice}
        onOpenChange={(open) => !open && setDetailInvoice(null)}
        onSendInvoice={handleSendInvoice}
      />

      <SendInvoiceModal
        invoice={sendInvoice}
        open={!!sendInvoice}
        onOpenChange={(open) => !open && setSendInvoice(null)}
        onSent={() => setSendInvoice(null)}
      />
    </AppLayout>
  );
}
