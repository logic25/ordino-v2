import { useState } from "react";
import { format } from "date-fns";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Receipt, ChevronDown, ChevronRight, Send, FileText, Eye } from "lucide-react";
import {
  useBillingRequests,
  useCreateInvoiceFromRequest,
  useRejectBillingRequest,
  type BillingRequestWithRelations,
} from "@/hooks/useBillingRequests";
import { useInvoices, type InvoiceWithRelations } from "@/hooks/useInvoices";
import { InvoiceDetailSheet } from "@/components/invoices/InvoiceDetailSheet";
import { SendInvoiceModal } from "@/components/invoices/SendInvoiceModal";
import { toast } from "@/hooks/use-toast";

export function BillingInboxView() {
  const { data: requests = [], isLoading } = useBillingRequests("pending");
  const { data: drafts = [], isLoading: draftsLoading } = useInvoices("draft");
  const { data: readyInvoices = [], isLoading: readyLoading } = useInvoices("ready_to_send");
  const createInvoice = useCreateInvoiceFromRequest();
  const rejectRequest = useRejectBillingRequest();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<InvoiceWithRelations | null>(null);
  const [sendInvoice, setSendInvoice] = useState<InvoiceWithRelations | null>(null);

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
      toast({ title: "Request rejected" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateAll = async () => {
    for (const req of requests) {
      await handleCreateInvoice(req);
    }
  };

  const requestsTotal = requests.reduce((s, r) => s + r.total_amount, 0);
  const draftsTotal = drafts.reduce((s, i) => s + Number(i.total_due || 0), 0);
  const readyTotal = readyInvoices.reduce((s, i) => s + Number(i.total_due || 0), 0);
  const grandTotal = requestsTotal + draftsTotal + readyTotal;
  const grandCount = requests.length + drafts.length + readyInvoices.length;

  return (
    <div className="space-y-6 py-4">
      {/* Combined header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{grandCount}</span> item{grandCount !== 1 ? "s" : ""} ready to invoice totaling{" "}
            <span className="font-semibold text-foreground tabular-nums">
              ${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {requests.length} PM submission{requests.length !== 1 ? "s" : ""} · {readyInvoices.length} ready to send · {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
          </p>
        </div>
        {requests.length > 1 && (
          <Button size="sm" onClick={handleCreateAll} disabled={!!processingId}>
            <Receipt className="h-4 w-4 mr-1.5" />
            Create All Invoices
          </Button>
        )}
      </div>

      {/* Section 1: PM submissions */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">PM Submissions</h3>
          <Badge variant="secondary" className="text-xs">{requests.length}</Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            ${requestsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Services</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">Loading...</TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-muted-foreground/50" />
                    <p className="text-sm">No pending PM submissions</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              requests.map((req) => {
                const services = (req.services as any[]) || [];
                const serviceNames = services.map((s) => s.name || s.description || "Service").join(", ");
                const isProcessing = processingId === req.id;
                const isExpanded = expandedId === req.id;

                return (
                  <>
                    <TableRow
                      key={req.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    >
                      <TableCell className="w-8 pr-0">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {format(new Date(req.created_at), "MM/dd/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{req.projects?.project_number || "—"}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {req.projects?.name || "—"}
                        </div>
                        {req.projects?.properties?.address && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {req.projects.properties.address}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm truncate max-w-[200px]">{serviceNames}</div>
                        <div className="text-xs text-muted-foreground">{services.length} item{services.length !== 1 ? "s" : ""}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-sm">
                        ${req.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {req.created_by_profile
                          ? `${req.created_by_profile.first_name || ""} ${req.created_by_profile.last_name || ""}`.trim()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="default"
                            disabled={isProcessing}
                            onClick={() => handleCreateInvoice(req)}
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
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={isProcessing}
                            onClick={() => handleReject(req.id)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${req.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
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
                                {services.map((s: any, i: number) => (
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
                                    ${req.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
      </section>

      {/* Section 2: Ready to send invoices */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Ready to Send</h3>
          <Badge variant="secondary" className="text-xs">{readyInvoices.length}</Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            ${readyTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Client / Project</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {readyLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>
            ) : readyInvoices.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">No invoices ready to send</TableCell></TableRow>
            ) : (
              readyInvoices.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailInvoice(inv)}>
                  <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>
                    <div className="text-sm">{inv.clients?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                      {inv.projects?.project_number ? `${inv.projects.project_number} · ` : ""}{inv.projects?.name || ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{format(new Date(inv.created_at), "MM/dd/yyyy")}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-sm">
                    ${Number(inv.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="default" onClick={() => setSendInvoice(inv)}>
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Send
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {/* Section 3: Drafts */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Drafts</h3>
          <Badge variant="secondary" className="text-xs">{drafts.length}</Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            ${draftsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Client / Project</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {draftsLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>
            ) : drafts.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">No drafts</TableCell></TableRow>
            ) : (
              drafts.map((inv) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailInvoice(inv)}>
                  <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>
                    <div className="text-sm">{inv.clients?.name || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                      {inv.projects?.project_number ? `${inv.projects.project_number} · ` : ""}{inv.projects?.name || ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{format(new Date(inv.created_at), "MM/dd/yyyy")}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-sm">
                    ${Number(inv.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => setDetailInvoice(inv)}>
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

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
