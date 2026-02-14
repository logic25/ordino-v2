import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { LineItemsEditor } from "./LineItemsEditor";
import { useUpdateInvoice, type InvoiceWithRelations, type LineItem } from "@/hooks/useInvoices";
import { format } from "date-fns";
import { Edit2, Save, X, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface InvoiceDetailSheetProps {
  invoice: InvoiceWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendInvoice?: (invoice: InvoiceWithRelations) => void;
}

export function InvoiceDetailSheet({ invoice, open, onOpenChange, onSendInvoice }: InvoiceDetailSheetProps) {
  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<LineItem[]>([]);
  const updateInvoice = useUpdateInvoice();

  if (!invoice) return null;

  const lineItems: LineItem[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];

  const startEdit = () => {
    setEditItems([...lineItems]);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditItems([]);
  };

  const saveEdit = async () => {
    const subtotal = editItems.reduce((sum, i) => sum + i.amount, 0);
    try {
      await updateInvoice.mutateAsync({
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

  const pmName = invoice.created_by_profile
    ? `${invoice.created_by_profile.first_name || ""} ${invoice.created_by_profile.last_name || ""}`.trim()
    : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-mono text-lg">
              {invoice.invoice_number}
            </SheetTitle>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Project Info */}
          <section>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Project</h4>
            <p className="text-sm font-medium">
              {invoice.projects
                ? `${invoice.projects.project_number || ""} - ${invoice.projects.name || "Untitled"}`
                : "No project linked"}
            </p>
            <p className="text-sm text-muted-foreground">
              Client: {invoice.clients?.name || "—"}
            </p>
            <p className="text-sm text-muted-foreground">
              Created by: {pmName} • {invoice.created_at ? format(new Date(invoice.created_at), "M/d/yyyy h:mm a") : "—"}
            </p>
          </section>

          <Separator />

          {/* Bill To */}
          <section>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Bill To</h4>
            <p className="text-sm font-medium">
              {invoice.billed_to_contact?.name || invoice.clients?.name || "—"}
            </p>
            {invoice.billed_to_contact?.email && (
              <p className="text-sm text-muted-foreground">{invoice.billed_to_contact.email}</p>
            )}
          </section>

          <Separator />

          {/* Line Items */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-muted-foreground">Line Items</h4>
              {!editing && (invoice.status === "draft" || invoice.status === "ready_to_send" || invoice.status === "needs_review") && (
                <Button variant="ghost" size="sm" onClick={startEdit}>
                  <Edit2 className="h-3 w-3 mr-1" /> Edit
                </Button>
              )}
              {editing && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                    <X className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={saveEdit} disabled={updateInvoice.isPending}>
                    <Save className="h-3 w-3 mr-1" /> Save
                  </Button>
                </div>
              )}
            </div>
            <LineItemsEditor
              items={editing ? editItems : lineItems}
              onChange={setEditItems}
              readOnly={!editing}
            />
          </section>

          <Separator />

          {/* Totals */}
          <section className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">${Number(invoice.subtotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            {Number(invoice.retainer_applied) > 0 && (
              <div className="flex justify-between text-success">
                <span>Retainer Applied</span>
                <span className="font-mono">-${Number(invoice.retainer_applied).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-1 border-t">
              <span>Total Due</span>
              <span className="font-mono">${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
          </section>

          {/* Payment Terms */}
          <section>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Payment Terms</h4>
            <p className="text-sm">{invoice.payment_terms || "Net 30"}</p>
            {invoice.due_date && (
              <p className="text-sm text-muted-foreground">
                Due: {format(new Date(invoice.due_date), "MMMM d, yyyy")}
              </p>
            )}
          </section>

          {/* Special Instructions */}
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

          {/* Actions */}
          <div className="flex gap-2">
            {(invoice.status === "draft" || invoice.status === "ready_to_send") && onSendInvoice && (
              <Button
                onClick={() => onSendInvoice(invoice)}
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Send className="h-4 w-4 mr-2" /> Send Invoice
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
