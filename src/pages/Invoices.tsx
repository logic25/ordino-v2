import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, Send, Trash2, Receipt, Wallet } from "lucide-react";
import { InvoiceSummaryCards } from "@/components/invoices/InvoiceSummaryCards";
import { InvoiceFilterTabs, type BillingTab } from "@/components/invoices/InvoiceFilterTabs";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { CreateInvoiceDialog } from "@/components/invoices/CreateInvoiceDialog";
import { InvoiceDetailSheet } from "@/components/invoices/InvoiceDetailSheet";
import { QBOConnectionWidget } from "@/components/invoices/QBOConnectionWidget";
import { SendInvoiceModal } from "@/components/invoices/SendInvoiceModal";
import { SendToBillingDialog } from "@/components/invoices/SendToBillingDialog";
import { CollectionsView } from "@/components/invoices/CollectionsView";
import { PromisesView } from "@/components/invoices/PromisesView";
import { RetainersView } from "@/components/invoices/RetainersView";
import { AnalyticsView } from "@/components/invoices/AnalyticsView";
import { AutomationActivityPanel } from "@/components/invoices/AutomationActivityPanel";
import {
  useInvoices, useInvoiceCounts, useDeleteInvoice,
  type InvoiceStatus, type InvoiceWithRelations,
} from "@/hooks/useInvoices";
import { useRetainers } from "@/hooks/useRetainers";
import { toast } from "@/hooks/use-toast";

// ── Mock invoice data ────────────────────────────────────────────
const mkInv = (
  id: string, num: string, status: InvoiceStatus, total: number,
  clientName: string, clientId: string, projName: string, projNum: string, projId: string,
  dueDate: string, createdAt: string, sentAt?: string, paidAt?: string,
  contactName?: string,
): InvoiceWithRelations => ({
  id, company_id: "mock", invoice_number: num, project_id: projId, client_id: clientId,
  billing_request_id: null, line_items: [{ description: "Professional services", quantity: 1, rate: total, amount: total }],
  subtotal: total, retainer_applied: 0, fees: {}, total_due: total,
  status, review_reason: status === "needs_review" ? "CC markup missing" : null,
  payment_terms: "Net 30", due_date: dueDate, billed_to_contact_id: null,
  created_by: null, sent_at: sentAt || null, paid_at: paidAt || null,
  payment_amount: paidAt ? total : null, payment_method: paidAt ? "check" : null,
  qbo_invoice_id: null, qbo_synced_at: null, qbo_payment_status: null,
  gmail_message_id: sentAt ? "mock-gmail" : null, special_instructions: null,
  created_at: createdAt, updated_at: createdAt,
  projects: { id: projId, name: projName, project_number: projNum },
  clients: { id: clientId, name: clientName, phone: null, email: null, address: null },
  billed_to_contact: contactName ? { id: "mc", name: contactName, email: null, phone: null, mobile: null, title: null, company_name: null, first_name: null, last_name: null } : null,
  created_by_profile: null,
});

const MOCK_INVOICES: InvoiceWithRelations[] = [
  // Rudin Management — multiple projects
  mkInv("m1","INV-00145","sent",28500,"Rudin Management","c1","340 Park Ave - Lobby Reno","PJ2025-0012","p1","2026-03-01","2026-01-28","2026-01-29",undefined,"Antonio Ruiz"),
  mkInv("m2","INV-00139","overdue",42000,"Rudin Management","c1","345 Park Ave - Mechanical","PJ2025-0008","p2","2026-01-15","2025-12-14","2025-12-15",undefined,"Antonio Ruiz"),
  mkInv("m3","INV-00112","paid",18750,"Rudin Management","c1","340 Park Ave - Lobby Reno","PJ2025-0012","p1","2025-12-20","2025-11-18","2025-11-19","2025-12-18","Antonio Ruiz"),
  mkInv("m4","INV-00160","draft",15200,"Rudin Management","c1","110 Wall St - Fire Alarm","PJ2026-0003","p3","2026-03-15","2026-02-10"),
  // Related Companies
  mkInv("m5","INV-00148","sent",65000,"Related Companies","c2","Hudson Yards Tower C","PJ2025-0015","p4","2026-03-10","2026-02-05","2026-02-06",undefined,"Jessica Park"),
  mkInv("m6","INV-00131","overdue",38500,"Related Companies","c2","Hudson Yards Tower C","PJ2025-0015","p4","2026-01-05","2025-11-30","2025-12-01",undefined,"Jessica Park"),
  mkInv("m7","INV-00098","paid",52000,"Related Companies","c2","15 Hudson Yards - MEP","PJ2025-0006","p5","2025-10-30","2025-09-28","2025-09-29","2025-10-25","Mike Torres"),
  mkInv("m8","INV-00155","ready_to_send",22400,"Related Companies","c2","15 Hudson Yards - MEP","PJ2025-0006","p5","2026-03-15","2026-02-08"),
  // Brookfield Properties
  mkInv("m9","INV-00152","sent",35800,"Brookfield Properties","c3","Manhattan West - Sprinkler","PJ2025-0018","p6","2026-03-05","2026-02-01","2026-02-02",undefined,"Sarah Chen"),
  mkInv("m10","INV-00127","overdue",48200,"Brookfield Properties","c3","Brookfield Place - Elevator","PJ2025-0014","p7","2025-12-28","2025-11-25","2025-11-26",undefined,"Sarah Chen"),
  mkInv("m11","INV-00105","paid",29500,"Brookfield Properties","c3","Manhattan West - Sprinkler","PJ2025-0018","p6","2025-11-15","2025-10-10","2025-10-11","2025-11-10","Sarah Chen"),
  // SL Green Realty
  mkInv("m12","INV-00156","sent",41200,"SL Green Realty","c4","One Vanderbilt - Facade","PJ2025-0020","p8","2026-03-12","2026-02-08","2026-02-09",undefined,"David Kim"),
  mkInv("m13","INV-00138","overdue",33900,"SL Green Realty","c4","One Vanderbilt - Facade","PJ2025-0020","p8","2026-01-10","2025-12-08","2025-12-09",undefined,"David Kim"),
  mkInv("m14","INV-00161","draft",19800,"SL Green Realty","c4","280 Park Ave - HVAC","PJ2026-0001","p9","2026-03-20","2026-02-12"),
  mkInv("m15","INV-00100","paid",27600,"SL Green Realty","c4","280 Park Ave - HVAC","PJ2026-0001","p9","2025-11-01","2025-09-30","2025-10-01","2025-10-28","David Kim"),
  // Vornado Realty Trust
  mkInv("m16","INV-00150","sent",24900,"Vornado Realty Trust","c5","Penn 1 - Violation Resolution","PJ2025-0022","p10","2026-03-08","2026-02-03","2026-02-04",undefined,"Linda Vasquez"),
  mkInv("m17","INV-00135","overdue",31500,"Vornado Realty Trust","c5","PENN 2 - DOB Filing","PJ2025-0019","p11","2026-01-02","2025-11-28","2025-11-29",undefined,"Linda Vasquez"),
  mkInv("m18","INV-00162","needs_review",16200,"Vornado Realty Trust","c5","Penn 1 - Violation Resolution","PJ2025-0022","p10","2026-03-15","2026-02-13"),
  // Tishman Speyer
  mkInv("m19","INV-00143","sent",37500,"Tishman Speyer","c6","Rockefeller Center - Alt 1","PJ2025-0025","p12","2026-02-28","2026-01-25","2026-01-26",undefined,"Karen Lee"),
  mkInv("m20","INV-00120","paid",45000,"Tishman Speyer","c6","200 Park Ave - Demo","PJ2025-0010","p13","2025-12-10","2025-11-05","2025-11-06","2025-12-05","Karen Lee"),
  // Extell Development
  mkInv("m21","INV-00158","ready_to_send",28900,"Extell Development","c7","Central Park Tower - Plumbing","PJ2025-0028","p14","2026-03-18","2026-02-10"),
  mkInv("m22","INV-00130","overdue",56000,"Extell Development","c7","One Manhattan Square - MEP","PJ2025-0016","p15","2025-12-30","2025-11-28","2025-11-29",undefined,"James Wang"),
  // Silverstein Properties
  mkInv("m23","INV-00153","needs_review",19500,"Silverstein Properties","c8","3 WTC - Sprinkler Mod","PJ2025-0030","p16","2026-03-10","2026-02-02"),
  mkInv("m24","INV-00110","paid",34200,"Silverstein Properties","c8","7 WTC - Fire Alarm","PJ2025-0011","p17","2025-11-20","2025-10-15","2025-10-16","2025-11-15","Robert Diaz"),
];

const MOCK_COUNTS = {
  draft: 3, ready_to_send: 2, needs_review: 2, sent: 6, overdue: 6, paid: 5, total: 24,
};

export default function Invoices() {
  const [activeFilter, setActiveFilter] = useState<BillingTab>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<InvoiceWithRelations | null>(null);
  const [sendInvoice, setSendInvoice] = useState<InvoiceWithRelations | null>(null);
  const [billingOpen, setBillingOpen] = useState(false);

  const isSpecialTab = ["collections", "promises", "retainers", "analytics"].includes(activeFilter);
  const queryFilter = activeFilter === "collections" ? "overdue" : isSpecialTab ? "all" : activeFilter;
  const { data: dbInvoices = [], isLoading } = useInvoices(queryFilter as InvoiceStatus | "all");
  const { data: dbCounts } = useInvoiceCounts();
  const { data: dbRetainers = [] } = useRetainers();
  const deleteInvoice = useDeleteInvoice();

  // Mock retainer totals (same data as RetainersView)
  const retainerSummary = useMemo(() => {
    const mockBalance = 204690; // sum of mock retainer balances
    const mockCount = 5; // active mock retainers
    const realActive = dbRetainers.filter(r => r.status === "active");
    const realBalance = realActive.reduce((s, r) => s + Number(r.current_balance), 0);
    return {
      totalBalance: realBalance + mockBalance,
      activeCount: realActive.length + mockCount,
    };
  }, [dbRetainers]);

  // Merge mock + real invoices
  const allInvoices = useMemo(() => {
    const statusMatches = (inv: InvoiceWithRelations) =>
      queryFilter === "all" || inv.status === queryFilter;
    const filteredMock = MOCK_INVOICES.filter(statusMatches);
    return [...dbInvoices, ...filteredMock];
  }, [dbInvoices, queryFilter]);

  const allInvoicesAll = useMemo(() => [...(dbInvoices || []), ...MOCK_INVOICES], [dbInvoices]);

  const totals = useMemo(() => {
    const t: Record<InvoiceStatus, number> = {
      draft: 0, ready_to_send: 0, needs_review: 0, sent: 0, overdue: 0, paid: 0, legal_hold: 0,
    };
    allInvoicesAll.forEach((inv) => {
      if (inv.status in t) {
        t[inv.status as InvoiceStatus] += Number(inv.total_due) || 0;
      }
    });
    return t;
  }, [allInvoicesAll]);

  // Merge counts
  const counts = useMemo(() => {
    const dc = dbCounts || { draft: 0, ready_to_send: 0, needs_review: 0, sent: 0, overdue: 0, paid: 0, total: 0 };
    return {
      draft: dc.draft + MOCK_COUNTS.draft,
      ready_to_send: dc.ready_to_send + MOCK_COUNTS.ready_to_send,
      needs_review: dc.needs_review + MOCK_COUNTS.needs_review,
      sent: dc.sent + MOCK_COUNTS.sent,
      overdue: dc.overdue + MOCK_COUNTS.overdue,
      paid: dc.paid + MOCK_COUNTS.paid,
      total: dc.total + MOCK_COUNTS.total,
    };
  }, [dbCounts]);

  const filteredInvoices = useMemo(() => {
    if (!search) return allInvoices;
    const q = search.toLowerCase();
    return allInvoices.filter(
      (inv) =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.clients?.name?.toLowerCase().includes(q) ||
        inv.projects?.name?.toLowerCase().includes(q) ||
        inv.projects?.project_number?.toLowerCase().includes(q)
    );
  }, [allInvoices, search]);

  const handleDelete = async (id: string) => {
    if (id.startsWith("m")) return; // mock data
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

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
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

        {/* QBO Connection Status */}
        <QBOConnectionWidget />

        {/* Summary Cards */}
        <InvoiceSummaryCards
          counts={counts}
          totals={totals}
          activeFilter={isSpecialTab ? "all" : activeFilter as InvoiceStatus | "all"}
          onFilterChange={(f) => setActiveFilter(f)}
        />

        {/* Retainer Summary Card */}
        <Card
          className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
            activeFilter === "retainers" ? "ring-2 ring-accent border-accent" : ""
          }`}
          onClick={() => setActiveFilter(activeFilter === "retainers" ? "all" : "retainers")}
        >
          <CardContent className="flex items-center gap-4 py-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Active Retainers</p>
              <p className="text-2xl font-bold tabular-nums">
                ${retainerSummary.totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium tabular-nums">{retainerSummary.activeCount}</p>
              <p className="text-xs text-muted-foreground">clients</p>
            </div>
          </CardContent>
        </Card>

        {/* Filter Tabs + Search */}
        <Card>
          <div className="border-b overflow-hidden">
            <div className="flex items-end justify-between px-6 pt-4 pb-0 gap-4">
              <div className="min-w-0 overflow-x-auto flex-1">
                <InvoiceFilterTabs
                  activeTab={activeFilter}
                  onTabChange={setActiveFilter}
                  counts={counts as unknown as { [key: string]: number; total: number }}
                />
              </div>
              <div className="relative w-56 shrink-0 pb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
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
            {activeFilter === "collections" ? (
              <div className="space-y-6">
                <AutomationActivityPanel />
                <CollectionsView
                  invoices={allInvoicesAll}
                  onViewInvoice={(inv) => setDetailInvoice(inv)}
                  onSendReminder={handleSendInvoice}
                />
              </div>
            ) : activeFilter === "promises" ? (
              <PromisesView />
            ) : activeFilter === "retainers" ? (
              <RetainersView />
            ) : activeFilter === "analytics" ? (
              <AnalyticsView />
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