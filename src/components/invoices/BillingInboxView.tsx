import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
  CheckCircle2, XCircle, Loader2, Receipt, ChevronDown, ChevronRight,
  Send, Eye, MoreHorizontal, Trash2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useBillingRequests,
  useCreateInvoiceFromRequest,
  useRejectBillingRequest,
  type BillingRequestWithRelations,
} from "@/hooks/useBillingRequests";
import { useInvoices, useDeleteInvoice, type InvoiceWithRelations } from "@/hooks/useInvoices";
import { InvoiceDetailSheet } from "@/components/invoices/InvoiceDetailSheet";
import { SendInvoiceModal } from "@/components/invoices/SendInvoiceModal";
import { toast } from "@/hooks/use-toast";

type RowKind = "submission" | "draft" | "ready" | "needs_review";

interface UnifiedRow {
  id: string;
  kind: RowKind;
  date: string;
  clientName: string;
  projectNumber: string;
  projectName: string;
  address?: string;
  services: { name: string; description?: string; quantity?: number; rate?: number; amount?: number }[];
  servicesLabel: string;
  amount: number;
  submittedBy?: string;
  invoiceNumber?: string;
  isDeposit?: boolean;
  request?: BillingRequestWithRelations;
  invoice?: InvoiceWithRelations;
}

const KIND_LABELS: Record<RowKind, string> = {
  submission: "Submission",
  draft: "Draft",
  ready: "Ready",
  needs_review: "Needs Review",
};

const KIND_CHIP: Record<RowKind, string> = {
  submission: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  draft: "bg-muted text-muted-foreground border-border",
  ready: "bg-primary/15 text-primary border-primary/30",
  needs_review: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
};

type FilterKey = "all" | RowKind;

export function BillingInboxView() {
  const { data: requests = [], isLoading: reqLoading } = useBillingRequests("pending");
  const { data: drafts = [], isLoading: draftsLoading } = useInvoices("draft");
  const { data: readyInvoices = [], isLoading: readyLoading } = useInvoices("ready_to_send");
  const { data: reviewInvoices = [], isLoading: reviewLoading } = useInvoices("needs_review");
  const createInvoice = useCreateInvoiceFromRequest();
  const rejectRequest = useRejectBillingRequest();
  const deleteInvoice = useDeleteInvoice();

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<InvoiceWithRelations | null>(null);
  const [sendInvoice, setSendInvoice] = useState<InvoiceWithRelations | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const isLoading = reqLoading || draftsLoading || readyLoading || reviewLoading;

  const rows = useMemo<UnifiedRow[]>(() => {
    const submissionRows: UnifiedRow[] = requests.map((r) => {
      const services = ((r.services as any[]) || []).map((s) => ({
        name: s.name || s.description || "Service",
        description: s.description,
        quantity: s.quantity ?? 1,
        rate: Number(s.rate || 0),
        amount: Number(s.amount || 0),
      }));
      return {
        id: `sub-${r.id}`,
        kind: "submission",
        date: r.created_at,
        clientName: (r.projects as any)?.clients?.name || (r as any).clients?.name || "—",
        projectNumber: r.projects?.project_number || "—",
        projectName: r.projects?.name || "",
        address: r.projects?.properties?.address,
        services,
        servicesLabel: services.map((s) => s.name).join(", "),
        amount: Number(r.total_amount || 0),
        submittedBy: r.created_by_profile
          ? `${r.created_by_profile.first_name || ""} ${r.created_by_profile.last_name || ""}`.trim()
          : undefined,
        request: r,
      };
    });

    const invoiceRows: UnifiedRow[] = [...drafts, ...readyInvoices, ...reviewInvoices].map((inv) => {
      const services = (inv.line_items || []).map((li: any) => ({
        name: li.description || "Line item",
        description: li.description,
        quantity: Number(li.quantity || 1),
        rate: Number(li.rate || 0),
        amount: Number(li.amount || 0),
      }));
      const kind: RowKind =
        inv.status === "draft" ? "draft"
        : inv.status === "needs_review" ? "needs_review"
        : "ready";
      return {
        id: `inv-${inv.id}`,
        kind,
        date: inv.created_at,
        clientName: inv.clients?.name || "—",
        projectNumber: inv.projects?.project_number || "—",
        projectName: inv.projects?.name || "",
        services,
        servicesLabel: services.map((s) => s.name).join(", ") || `Invoice ${inv.invoice_number}`,
        amount: Number(inv.total_due || 0),
        invoiceNumber: inv.invoice_number,
        isDeposit: Boolean((inv as any).is_deposit),
        invoice: inv,
      };
    });

    return [...submissionRows, ...invoiceRows].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [requests, drafts, readyInvoices, reviewInvoices]);

  const counts = useMemo(() => ({
    all: rows.length,
    submission: rows.filter((r) => r.kind === "submission").length,
    draft: rows.filter((r) => r.kind === "draft").length,
    ready: rows.filter((r) => r.kind === "ready").length,
    needs_review: rows.filter((r) => r.kind === "needs_review").length,
  }), [rows]);

  const totals = useMemo(() => ({
    all: rows.reduce((s, r) => s + r.amount, 0),
    submission: rows.filter((r) => r.kind === "submission").reduce((s, r) => s + r.amount, 0),
    draft: rows.filter((r) => r.kind === "draft").reduce((s, r) => s + r.amount, 0),
    ready: rows.filter((r) => r.kind === "ready").reduce((s, r) => s + r.amount, 0),
    needs_review: rows.filter((r) => r.kind === "needs_review").reduce((s, r) => s + r.amount, 0),
  }), [rows]);

  const visibleRows = filter === "all" ? rows : rows.filter((r) => r.kind === filter);

  const handleCreateInvoice = async (req: BillingRequestWithRelations) => {
    setProcessingId(req.id);
    try {
      await createInvoice.mutateAsync(req);
      toast({ title: "Invoice created", description: `Invoice created for ${req.projects?.project_number || "project"}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await rejectRequest.mutateAsync(id);
      toast({ title: "Submission rejected" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    setProcessingId(id);
    try {
      await deleteInvoice.mutateAsync(id);
      toast({ title: "Invoice deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateAllSubmissions = async () => {
    const subs = rows.filter((r) => r.kind === "submission" && r.request);
    for (const r of subs) {
      if (r.request) await handleCreateInvoice(r.request);
    }
  };

  const filterChips: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "submission", label: "Submissions" },
    { key: "ready", label: "Ready" },
    { key: "draft", label: "Drafts" },
    { key: "needs_review", label: "Needs Review" },
  ];

  return (
    <div className="space-y-4 py-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{counts.all}</span>{" "}
            <span className="text-muted-foreground">item{counts.all !== 1 ? "s" : ""} · </span>
            <span className="font-semibold tabular-nums">
              ${totals.all.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>{" "}
            <span className="text-muted-foreground">ready to bill</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {counts.submission} submission{counts.submission !== 1 ? "s" : ""} · {counts.ready} ready · {counts.draft} draft{counts.draft !== 1 ? "s" : ""}{counts.needs_review > 0 ? ` · ${counts.needs_review} needs review` : ""}
          </p>
        </div>
        {counts.submission > 1 && (
          <Button size="sm" onClick={handleCreateAllSubmissions} disabled={!!processingId}>
            <Receipt className="h-4 w-4 mr-1.5" />
            Create All Invoices ({counts.submission})
          </Button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {filterChips.map((chip) => {
          const isActive = filter === chip.key;
          const c = counts[chip.key];
          const tip = chip.key === "needs_review"
            ? "Invoices flagged by accounting or where QBO sync failed. Open one to review and resolve."
            : chip.key === "submission" ? "Billing requests submitted by PMs that haven't been turned into invoices yet."
            : chip.key === "ready" ? "Invoices ready to send to the client."
            : chip.key === "draft" ? "In-progress invoice drafts that haven't been finalized."
            : null;
          const button = (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/40"
              }`}
            >
              {chip.label}
              <span className={`tabular-nums ${isActive ? "opacity-80" : "opacity-60"}`}>{c}</span>
            </button>
          );
          if (!tip) return button;
          return (
            <TooltipProvider key={chip.key}>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">{tip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>


      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead className="w-[110px]">Status</TableHead>
            <TableHead className="w-[110px]">Date</TableHead>
            <TableHead>Client / Project</TableHead>
            <TableHead>Services</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right w-[220px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell>
            </TableRow>
          ) : visibleRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
                  <p>All caught up — nothing to invoice</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            visibleRows.map((row) => {
              const isExpanded = expandedId === row.id;
              const rawId = row.request?.id || row.invoice?.id || row.id;
              const isProcessing = processingId === rawId;

              const openDetail = () => {
                if (row.invoice) {
                  setDetailInvoice(row.invoice);
                } else {
                  setExpandedId(isExpanded ? null : row.id);
                }
              };

              return (
                <>
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={openDetail}
                  >
                    <TableCell className="w-8 pr-0">
                      {row.kind === "submission" ? (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[9px] font-medium uppercase tracking-wide px-1.5 py-0 h-4 leading-none ${KIND_CHIP[row.kind]}`}>
                        {KIND_LABELS[row.kind]}
                      </Badge>

                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {format(new Date(row.date), "MM/dd/yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium truncate max-w-[240px]">{row.clientName}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[240px]">
                        {row.projectNumber}{row.projectName ? ` · ${row.projectName}` : ""}
                      </div>
                      {row.address && (
                        <div className="text-xs text-muted-foreground truncate max-w-[240px]">{row.address}</div>
                      )}
                      {row.invoiceNumber && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          #{row.invoiceNumber}
                          {row.isDeposit && (
                            <span className="ml-1 inline-flex items-center rounded-sm bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-1 py-px text-[9px] font-semibold uppercase tracking-wide">
                              Deposit
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm truncate max-w-[220px]">{row.servicesLabel || "—"}</div>
                      {row.services.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {row.services.length} item{row.services.length !== 1 ? "s" : ""}
                          {row.submittedBy ? ` · by ${row.submittedBy}` : ""}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-sm">
                      ${row.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {row.kind === "submission" && row.request && (
                          <Button
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleCreateInvoice(row.request!)}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Receipt className="h-3.5 w-3.5 mr-1" />
                                Create Invoice
                              </>
                            )}
                          </Button>
                        )}
                        {row.kind === "ready" && row.invoice && (
                          <Button size="sm" onClick={() => setSendInvoice(row.invoice!)}>
                            <Send className="h-3.5 w-3.5 mr-1" />
                            Send
                          </Button>
                        )}
                        {row.kind === "draft" && row.invoice && (
                          <Button size="sm" variant="outline" onClick={() => setDetailInvoice(row.invoice!)}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Finish
                          </Button>
                        )}
                        {row.kind === "needs_review" && row.invoice && (
                          <Button size="sm" variant="outline" onClick={() => setDetailInvoice(row.invoice!)}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Resolve
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {row.kind === "submission" && row.request && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleReject(row.request!.id)}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject submission
                              </DropdownMenuItem>
                            )}
                            {row.invoice && (
                              <DropdownMenuItem onClick={() => setDetailInvoice(row.invoice!)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Open invoice
                              </DropdownMenuItem>
                            )}
                            {row.kind === "draft" && row.invoice && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteInvoice(row.invoice!.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete draft
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>

                  {row.kind === "submission" && isExpanded && (
                    <TableRow key={`${row.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={7} className="p-0">
                        <div className="px-6 py-4 space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Line Items</p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-muted-foreground border-b border-border/50">
                                <th className="text-left py-1.5 font-medium">Service</th>
                                <th className="text-left py-1.5 font-medium">Description</th>
                                <th className="text-right py-1.5 font-medium">Qty</th>
                                <th className="text-right py-1.5 font-medium">Rate</th>
                                <th className="text-right py-1.5 font-medium">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.services.map((s, i) => (
                                <tr key={i} className="border-b border-border/30 last:border-0">
                                  <td className="py-2 font-medium">{s.name || "—"}</td>
                                  <td className="py-2 text-muted-foreground">{s.description || "—"}</td>
                                  <td className="py-2 text-right tabular-nums">{s.quantity ?? 1}</td>
                                  <td className="py-2 text-right tabular-nums">
                                    ${Number(s.rate || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2 text-right tabular-nums font-medium">
                                    ${Number(s.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-border">
                                <td colSpan={4} className="py-2 text-right font-semibold text-xs uppercase text-muted-foreground">Total</td>
                                <td className="py-2 text-right tabular-nums font-bold">
                                  ${row.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })
          )}
        </TableBody>
      </Table>

      <InvoiceDetailSheet
        invoice={detailInvoice}
        open={!!detailInvoice}
        onOpenChange={(open) => !open && setDetailInvoice(null)}
        onSendInvoice={(inv) => { setDetailInvoice(null); setSendInvoice(inv); }}
      />
      <SendInvoiceModal
        invoice={sendInvoice}
        open={!!sendInvoice}
        onOpenChange={(open) => !open && setSendInvoice(null)}
        onSent={() => setSendInvoice(null)}
      />
    </div>
  );
}
