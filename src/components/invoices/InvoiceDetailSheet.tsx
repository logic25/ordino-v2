import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { type InvoiceWithRelations, type LineItem } from "@/hooks/useInvoices";
import { useInvoiceFollowUps, useInvoiceActivityLog } from "@/hooks/useInvoiceFollowUps";
import { useClientPaymentAnalytics } from "@/hooks/useClientAnalytics";
import { usePaymentPrediction } from "@/hooks/usePaymentPredictions";
import { usePaymentPromises } from "@/hooks/usePaymentPromises";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

// Extracted sub-components
import { useInvoiceActions } from "./invoice-detail/useInvoiceActions";
import { ClientInfoSection } from "./invoice-detail/ClientInfoSection";
import { PaymentAnalyticsSection, RiskPredictionSection, PromisesSection } from "./invoice-detail/AnalyticsSections";
import { FollowUpNotesSection } from "./invoice-detail/FollowUpNotesSection";
import { ActivityLogSection } from "./invoice-detail/ActivityLogSection";
import { ActionDialogs } from "./invoice-detail/ActionDialogs";
import { DeliveryStatusSection } from "./invoice-detail/DeliveryStatusSection";
import { LineItemsSection } from "./invoice-detail/LineItemsSection";
import { TotalsSection } from "./invoice-detail/TotalsSection";
import { InvoiceActionsSection } from "./invoice-detail/InvoiceActionsSection";
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
  const [claimFlowOpen, setClaimFlowOpen] = useState(false);

  const actions = useInvoiceActions(invoice);
  const { data: followUps } = useInvoiceFollowUps(invoice?.id);
  const { data: activityLog } = useInvoiceActivityLog(invoice?.id);
  const { data: clientAnalytics } = useClientPaymentAnalytics(invoice?.client_id ?? undefined);
  const { data: prediction } = usePaymentPrediction(invoice?.id ?? undefined);
  const { data: promises } = usePaymentPromises(invoice?.id ?? undefined);

  if (!invoice) return null;

  const lineItems: LineItem[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const canEdit = invoice.status === "draft" || invoice.status === "ready_to_send" || invoice.status === "needs_review";

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
            <DeliveryStatusSection invoice={invoice} />
            <Separator />
            <ClientInfoSection invoice={invoice} />
            <Separator />
            <PaymentAnalyticsSection clientAnalytics={clientAnalytics} />
            <RiskPredictionSection prediction={prediction} />
            <PromisesSection promises={promises} />

            <LineItemsSection
              lineItems={lineItems}
              editing={editing}
              editItems={editItems}
              onEditItemsChange={setEditItems}
              canEdit={canEdit}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onSaveEdit={saveEdit}
              saving={actions.updateInvoice.isPending}
            />

            <Separator />
            <TotalsSection invoice={invoice} />

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

            <InvoiceActionsSection
              invoice={invoice}
              actions={actions}
              onSendInvoice={onSendInvoice}
              onOpenClaimFlow={() => setClaimFlowOpen(true)}
            />
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
