import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, Send, Trash2, Receipt } from "lucide-react";
import { InvoiceSummaryCards } from "@/components/invoices/InvoiceSummaryCards";
import { InvoiceFilterTabs } from "@/components/invoices/InvoiceFilterTabs";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { CreateInvoiceDialog } from "@/components/invoices/CreateInvoiceDialog";
import { InvoiceDetailSheet } from "@/components/invoices/InvoiceDetailSheet";
import { QBOConnectionWidget } from "@/components/invoices/QBOConnectionWidget";
import { SendInvoiceModal } from "@/components/invoices/SendInvoiceModal";
import { CollectionsView } from "@/components/invoices/CollectionsView";
import { SendToBillingDialog } from "@/components/invoices/SendToBillingDialog";
import {
  useInvoices, useInvoiceCounts, useDeleteInvoice,
  type InvoiceStatus, type InvoiceWithRelations,
} from "@/hooks/useInvoices";
import { toast } from "@/hooks/use-toast";

export default function Invoices() {
  const [activeFilter, setActiveFilter] = useState<InvoiceStatus | "all" | "collections">("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<InvoiceWithRelations | null>(null);
  const [sendInvoice, setSendInvoice] = useState<InvoiceWithRelations | null>(null);

  const queryFilter = activeFilter === "collections" ? "overdue" : activeFilter;
  const { data: invoices = [], isLoading } = useInvoices(queryFilter as InvoiceStatus | "all");
  const { data: counts } = useInvoiceCounts();
  const deleteInvoice = useDeleteInvoice();

  const { data: allInvoices = [] } = useInvoices("all");
  const totals = useMemo(() => {
    const t: Record<InvoiceStatus, number> = {
      draft: 0, ready_to_send: 0, needs_review: 0, sent: 0, overdue: 0, paid: 0,
    };
    allInvoices.forEach((inv) => {
      if (inv.status in t) {
        t[inv.status as InvoiceStatus] += Number(inv.total_due) || 0;
      }
    });
    return t;
  }, [allInvoices]);

  const filteredInvoices = useMemo(() => {
    if (!search) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.clients?.name?.toLowerCase().includes(q) ||
        inv.projects?.name?.toLowerCase().includes(q) ||
        inv.projects?.project_number?.toLowerCase().includes(q)
    );
  }, [invoices, search]);

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
    setDetailInvoice(null);
    setSendInvoice(inv);
  };

  const defaultCounts = counts || {
    draft: 0, ready_to_send: 0, needs_review: 0, sent: 0, overdue: 0, paid: 0, total: 0,
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
            <p className="text-muted-foreground mt-1">
              Track billing and payment status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBillingOpen(true)}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Send to Billing
            </Button>
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

        {/* QBO Connection Status */}
        <QBOConnectionWidget />

        {/* Summary Cards */}
        <InvoiceSummaryCards
          counts={defaultCounts}
          totals={totals}
          activeFilter={activeFilter === "collections" ? "overdue" : activeFilter}
          onFilterChange={(f) => setActiveFilter(f)}
        />

        {/* Filter Tabs + Search */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <InvoiceFilterTabs
                activeTab={activeFilter}
                onTabChange={setActiveFilter}
                counts={defaultCounts as unknown as { [key: string]: number; total: number }}
              />
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
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
          </CardHeader>
          <CardContent className="pt-0">
            {activeFilter === "collections" ? (
              <CollectionsView
                invoices={allInvoices}
                onViewInvoice={(inv) => setDetailInvoice(inv)}
                onSendReminder={handleSendInvoice}
              />
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

      <CreateInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} />
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