import { useState, lazy, Suspense } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { LineItemsEditor } from "./LineItemsEditor";
import { generateInvoicePDFBlob } from "./InvoicePDFPreview";
const InvoicePDFPreview = lazy(() => import("./InvoicePDFPreview").then(m => ({ default: m.InvoicePDFPreview })));
import { type InvoiceWithRelations, type LineItem } from "@/hooks/useInvoices";
import { useInvoiceFollowUps, useInvoiceActivityLog } from "@/hooks/useInvoiceFollowUps";
import { useClientPaymentAnalytics } from "@/hooks/useClientAnalytics";
import { usePaymentPrediction } from "@/hooks/usePaymentPredictions";
import { usePaymentPromises } from "@/hooks/usePaymentPromises";
import { format } from "date-fns";
import {
  Edit2, Save, X, Send, Mail, MailOpen, Clock, FileWarning, Loader2,
  Eye, Download, Trash2, Gavel,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Extracted sub-components
import { useInvoiceActions } from "./invoice-detail/useInvoiceActions";
import { ClientInfoSection } from "./invoice-detail/ClientInfoSection";
import { PaymentAnalyticsSection, RiskPredictionSection, PromisesSection } from "./invoice-detail/AnalyticsSections";
import { FollowUpNotesSection } from "./invoice-detail/FollowUpNotesSection";
import { ActivityLogSection } from "./invoice-detail/ActivityLogSection";
import { ActionDialogs } from "./invoice-detail/ActionDialogs";
import { ClaimFlowDialog } from "./ClaimFlowDialog";

interface InvoiceDetailSheetProps {
  invoice: InvoiceWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendInvoice?: (invoice: InvoiceWithRelations) => void;
}

export function InvoiceDetailSheet({ invoice, open, onOpenChange, onSendInvoice }: InvoiceDetailSheetProps) {
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<LineItem[]>([]);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [claimFlowOpen, setClaimFlowOpen] = useState(false);

  const actions = useInvoiceActions(invoice);
  const { data: followUps } = useInvoiceFollowUps(invoice?.id);
  const { data: activityLog } = useInvoiceActivityLog(invoice?.id);
  const { data: clientAnalytics } = useClientPaymentAnalytics(invoice?.client_id ?? undefined);
  const { data: prediction } = usePaymentPrediction(invoice?.id ?? undefined);
  const { data: promises } = usePaymentPromises(invoice?.id ?? undefined);

  if (!invoice) return null;

  const lineItems: LineItem[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const isOverdue = invoice.status === "overdue";
  const isSent = invoice.status === "sent";

  const pmName = invoice.created_by_profile
    ? `${invoice.created_by_profile.first_name || ""} ${invoice.created_by_profile.last_name || ""}`.trim()
    : "—";

  const startEdit = () => { setEditItems([...lineItems]); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setEditItems([]); };

  const saveEdit = async () => {
    const subtotal = editItems.reduce((sum, i) => sum + i.amount, 0);
    try {
      await actions.updateInvoice.mutateAsync({
        id: invoice.id,
        line_items: editItems,
        subtotal,
        total_due: subtotal - Number(invoice.retainer_applied || 0),
      });
      toast({ title: "Invoice updated" });
      setEditing(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="space-y-1 pr-8">
            <div className="flex items-center gap-3">
              <SheetTitle className="text-lg tracking-tight">{invoice.invoice_number}</SheetTitle>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Label className="text-xs text-muted-foreground">Status:</Label>
              <Select value={invoice.status} onValueChange={async (val) => {
                try {
                  await actions.updateInvoice.mutateAsync({ id: invoice.id, status: val as any });
                  toast({ title: `Status changed to ${val.replace(/_/g, " ")}` });
                } catch (err: any) {
                  toast({ title: "Error", description: err.message, variant: "destructive" });
                }
              }}>
                <SelectTrigger className="h-7 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ready_to_send">Ready to Send</SelectItem>
                  <SelectItem value="needs_review">Needs Review</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="legal_hold">Legal Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Project Info */}
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Project</h4>
              <p className="text-sm font-medium">
                {invoice.projects ? `${invoice.projects.project_number || ""} - ${invoice.projects.name || "Untitled"}` : "No project linked"}
              </p>
              <p className="text-sm text-muted-foreground">Client: {invoice.clients?.name || "—"}</p>
              <p className="text-sm text-muted-foreground">Created by: {pmName} • {invoice.created_at ? format(new Date(invoice.created_at), "M/d/yyyy h:mm a") : "—"}</p>
            </section>

            <Separator />

            {/* Delivery Status */}
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Delivery Status</h4>
              {invoice.sent_at ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-primary" /><span>Sent on {format(new Date(invoice.sent_at), "MMMM d, yyyy 'at' h:mm a")}</span></div>
                  {invoice.paid_at && <div className="flex items-center gap-2 text-sm"><MailOpen className="h-4 w-4 text-success" /><span>Paid on {format(new Date(invoice.paid_at), "MMMM d, yyyy 'at' h:mm a")}</span></div>}
                  {isOverdue && invoice.due_date && <div className="flex items-center gap-2 text-sm text-destructive"><Clock className="h-4 w-4" /><span>Overdue since {format(new Date(invoice.due_date), "MMMM d, yyyy")}</span></div>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not yet sent</p>
              )}
            </section>

            <Separator />
            <ClientInfoSection invoice={invoice} />
            <Separator />
            <PaymentAnalyticsSection clientAnalytics={clientAnalytics} />
            <RiskPredictionSection prediction={prediction} />
            <PromisesSection promises={promises} />

            {/* Line Items */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-muted-foreground">Line Items</h4>
                {!editing && (invoice.status === "draft" || invoice.status === "ready_to_send" || invoice.status === "needs_review") && (
                  <Button variant="ghost" size="sm" onClick={startEdit}><Edit2 className="h-3 w-3 mr-1" /> Edit</Button>
                )}
                {editing && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={cancelEdit}><X className="h-3 w-3 mr-1" /> Cancel</Button>
                    <Button size="sm" onClick={saveEdit} disabled={actions.updateInvoice.isPending}><Save className="h-3 w-3 mr-1" /> Save</Button>
                  </div>
                )}
              </div>
              <LineItemsEditor items={editing ? editItems : lineItems} onChange={setEditItems} readOnly={!editing} />
            </section>

            <Separator />

            {/* Totals */}
            <section className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums" data-clarity-mask="true">${Number(invoice.subtotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              {Number(invoice.retainer_applied) > 0 && (
                <div className="flex justify-between text-success">
                  <span>Deposit Applied</span>
                  <span className="tabular-nums" data-clarity-mask="true">-${Number(invoice.retainer_applied).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-1 border-t">
                <span>Total Due</span>
                <span className="tabular-nums" data-clarity-mask="true">${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            </section>

            {/* Payment Terms */}
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Payment Terms</h4>
              <p className="text-sm">{invoice.payment_terms || "Net 30"}</p>
              {invoice.due_date && <p className="text-sm text-muted-foreground">Due: {format(new Date(invoice.due_date), "MMMM d, yyyy")}</p>}
            </section>

            {invoice.special_instructions && (
              <>
                <Separator />
                <section>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Special Instructions</h4>
                  <p className="text-sm">{invoice.special_instructions}</p>
                </section>
              </>
            )}

            <Separator />
            <FollowUpNotesSection followUps={followUps} onAddNote={actions.handleAddNote} />
            <Separator />
            <ActivityLogSection invoice={invoice} activityLog={activityLog} />
            <Separator />

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setPdfPreviewOpen(true)}>
                  <Eye className="h-4 w-4 mr-2" /> Preview PDF
                </Button>
                <Button variant="outline" size="sm" className="flex-1" disabled={downloading} onClick={async () => {
                  setDownloading(true);
                  try {
                    const blob = await generateInvoicePDFBlob(invoice, actions.companyData?.settings);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `${invoice.invoice_number}.pdf`; a.click();
                    URL.revokeObjectURL(url);
                  } catch (err: any) {
                    toast({ title: "PDF Error", description: err.message, variant: "destructive" });
                  } finally { setDownloading(false); }
                }}>
                  {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />} Download
                </Button>
              </div>

              {(invoice.status === "draft" || invoice.status === "ready_to_send") && onSendInvoice && (
                <Button onClick={() => onSendInvoice(invoice)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Send className="h-4 w-4 mr-2" /> Send Invoice
                </Button>
              )}

              {(isOverdue || isSent) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Collections Actions</h4>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { actions.setActiveAction("reminder"); actions.setActionNote(""); }}>
                      <Mail className="h-3.5 w-3.5 mr-1.5" /> Send Reminder
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={actions.openDemandLetter}>
                      <FileWarning className="h-3.5 w-3.5 mr-1.5" /> Demand Letter
                    </Button>
                  </div>
                  {isOverdue && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground" onClick={() => { actions.setActiveAction("writeoff"); actions.setActionNote(""); }}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Write Off
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setClaimFlowOpen(true)}>
                        <Gavel className="h-3.5 w-3.5 mr-1.5" /> ClaimCurrent
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ActionDialogs
        invoice={invoice}
        activeAction={actions.activeAction}
        setActiveAction={actions.setActiveAction}
        actionNote={actions.actionNote}
        setActionNote={actions.setActionNote}
        processing={actions.processing}
        aiGenerating={actions.aiGenerating}
        demandStep={actions.demandStep}
        setDemandStep={actions.setDemandStep}
        demandLetterText={actions.demandLetterText}
        setDemandLetterText={actions.setDemandLetterText}
        onAction={actions.handleAction}
        onGenerateAi={actions.generateAiMessage}
      />

      <Suspense fallback={null}>
        <InvoicePDFPreview invoice={invoice} open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen} />
      </Suspense>

      <ClaimFlowDialog
        open={claimFlowOpen}
        onOpenChange={setClaimFlowOpen}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoice_number}
        totalDue={Number(invoice.total_due)}
        dueDate={invoice.due_date}
        clientId={invoice.client_id}
        clientName={invoice.clients?.name}
      />
    </>
  );
}
