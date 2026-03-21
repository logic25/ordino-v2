import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ServiceSelectionList } from "./billing/ServiceSelectionList";
import { ManualServiceEntry } from "./billing/ManualServiceEntry";
import { useSendToBilling } from "./billing/useSendToBilling";

interface SendToBillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedProjectId?: string;
  preselectedServiceIds?: Set<string>;
}

export function SendToBillingDialog({ open, onOpenChange, preselectedProjectId, preselectedServiceIds }: SendToBillingDialogProps) {
  const billing = useSendToBilling({ open, preselectedProjectId, preselectedServiceIds, onOpenChange });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send to Billing</DialogTitle>
          <DialogDescription>Submit completed services for invoicing. An invoice will be auto-created.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={billing.projectId} onValueChange={billing.setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {(billing.projects || []).filter((p) => p.status === "open").map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.project_number || "—"} - {p.name || "Untitled"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Input readOnly value={billing.selectedClient?.name || "Auto-filled from project"} className="bg-muted" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bill To (Contact)</Label>
            <Select value={billing.billedToContactId} onValueChange={billing.setBilledToContactId}>
              <SelectTrigger><SelectValue placeholder={billing.contacts?.length ? "Select billing contact" : "Select a project first"} /></SelectTrigger>
              <SelectContent>
                {(billing.contacts || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.title ? ` — ${c.title}` : ""}{c.is_primary ? " (Primary)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {billing.selectedContact && <p className="text-xs text-muted-foreground">{billing.selectedContact.email || "No email"}{billing.selectedContact.phone ? ` · ${billing.selectedContact.phone}` : ""}</p>}
          </div>

          {billing.activeRule && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Client Billing Rules Applied</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {billing.activeRule.require_waiver && <Badge variant="outline" className="text-[10px]">Waiver Required</Badge>}
                {billing.activeRule.require_pay_app && <Badge variant="outline" className="text-[10px]">Pay App Required</Badge>}
                {billing.activeRule.special_portal_required && <Badge variant="outline" className="text-[10px]">Portal Upload Required</Badge>}
                {billing.activeRule.wire_fee && billing.activeRule.wire_fee > 0 && <Badge variant="secondary" className="text-[10px]">Wire Fee: ${billing.activeRule.wire_fee}</Badge>}
                {billing.activeRule.cc_markup && billing.activeRule.cc_markup > 0 && <Badge variant="secondary" className="text-[10px]">CC Markup: {billing.activeRule.cc_markup}%</Badge>}
                {billing.activeRule.vendor_id && <Badge variant="outline" className="text-[10px]">Vendor ID: {billing.activeRule.vendor_id}</Badge>}
              </div>
              {billing.activeRule.special_instructions && (
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 text-warning shrink-0" />{billing.activeRule.special_instructions}
                </p>
              )}
            </div>
          )}

          <Separator />

          {billing.hasProjectServices ? (
            <ServiceSelectionList
              projectServices={billing.projectServices}
              selectedServices={billing.selectedServices}
              previouslyBilled={billing.previouslyBilled}
              billingHistory={billing.billingHistory}
              onToggleService={billing.toggleService}
              onUpdateService={billing.updateSelectedService}
              onBillAgain={billing.handleBillAgain}
            />
          ) : (
            <ManualServiceEntry
              services={billing.manualServices}
              onUpdate={billing.updateManualService}
              onAdd={() => billing.setManualServices((prev) => [...prev, { name: "", description: "", quantity: 1, rate: 0, amount: 0 }])}
              onRemove={(idx) => { if (billing.manualServices.length > 1) billing.setManualServices((prev) => prev.filter((_, i) => i !== idx)); }}
            />
          )}

          <Separator />

          <div className="flex justify-end">
            <div className="text-right space-y-1">
              <div className="flex justify-between gap-8 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">${billing.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              {Object.entries(billing.fees).map(([label, amount]) => (
                <div key={label} className="flex justify-between gap-8 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="tabular-nums">${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              {billing.totalFees > 0 && <Separator className="my-1" />}
              <div className="flex justify-between gap-8">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold tabular-nums">${billing.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={billing.handleSubmit} disabled={billing.isSubmitting} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {billing.isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
