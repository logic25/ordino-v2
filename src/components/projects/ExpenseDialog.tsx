import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, FileText, X } from "lucide-react";
import { useCreateExpense, uploadExpenseReceipt } from "@/hooks/useProjectExpenses";
import { useClientContacts } from "@/hooks/useClients";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  clientId?: string | null;
  defaultServiceId?: string | null;
}

type Flow = "ready_to_bill" | "on_hold" | "needs_approval";

export function ExpenseDialog({ open, onOpenChange, projectId, clientId, defaultServiceId }: ExpenseDialogProps) {
  const [flow, setFlow] = useState<Flow>("ready_to_bill");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [markupPct, setMarkupPct] = useState("0");
  const [holdReason, setHoldReason] = useState("");
  const [billedToContactId, setBilledToContactId] = useState<string>("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [autoThreshold, setAutoThreshold] = useState<number>(250);

  const { data: contacts } = useClientContacts(clientId || undefined);
  const createExpense = useCreateExpense();

  useEffect(() => {
    if (!open) return;
    // reset
    setFlow("ready_to_bill");
    setDescription(""); setVendor(""); setAmount(""); setMarkupPct("0");
    setHoldReason(""); setReceiptFile(null);
    // Load company auto-approve threshold
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
      if (!prof?.company_id) return;
      const { data: co } = await supabase.from("companies").select("settings").eq("id", prof.company_id).maybeSingle();
      const t = Number((co?.settings as any)?.expense_auto_approve_threshold ?? 250);
      setAutoThreshold(t);
    })();
  }, [open]);

  useEffect(() => {
    if (contacts && contacts.length > 0 && !billedToContactId) {
      const primary = contacts.find((c: any) => c.is_primary);
      setBilledToContactId(primary?.id || contacts[0].id);
    }
  }, [contacts]);

  const numAmount = Number(amount) || 0;
  const numMarkup = Number(markupPct) || 0;
  const billable = +(numAmount * (1 + numMarkup / 100)).toFixed(2);
  const willAutoApprove = flow === "needs_approval" && numAmount < autoThreshold && numAmount > 0;

  const submit = async () => {
    if (!description.trim()) {
      toast({ title: "Description required", variant: "destructive" });
      return;
    }
    if (numAmount <= 0) {
      toast({ title: "Amount must be greater than 0", variant: "destructive" });
      return;
    }
    if (flow === "on_hold" && !holdReason.trim()) {
      toast({ title: "Hold reason required", description: "Why is this not ready to bill?", variant: "destructive" });
      return;
    }

    let receipt_url: string | null = null;
    if (receiptFile) {
      setUploading(true);
      try {
        receipt_url = await uploadExpenseReceipt(receiptFile);
      } catch (err: any) {
        setUploading(false);
        toast({ title: "Receipt upload failed", description: err.message, variant: "destructive" });
        return;
      }
      setUploading(false);
    }

    try {
      await createExpense.mutateAsync({
        project_id: projectId,
        description: description.trim(),
        vendor: vendor.trim() || null,
        amount: numAmount,
        markup_pct: numMarkup,
        billed_to_contact_id: billedToContactId || null,
        service_id: defaultServiceId || null,
        receipt_url,
        flow,
        hold_reason: flow === "on_hold" ? holdReason.trim() : null,
      });

      let msg = "";
      if (flow === "ready_to_bill") msg = "Sent to billing — Sai will be notified.";
      else if (flow === "on_hold") msg = "Saved as on hold. Release it when ready.";
      else if (willAutoApprove) msg = `Auto-approved (under $${autoThreshold}). Pay it then mark as paid.`;
      else msg = "Approval request sent to admins.";

      toast({ title: "Expense logged", description: msg });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to save expense", description: err.message, variant: "destructive" });
    }
  };

  const isBusy = createExpense.isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>Filing fees, asbestos fees, anything paid out of pocket or that needs pre-approval.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Flow selector */}
          <div className="space-y-2">
            <Label>This expense is…</Label>
            <RadioGroup value={flow} onValueChange={(v) => setFlow(v as Flow)} className="gap-2">
              <Label htmlFor="flow-ready" className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                <RadioGroupItem value="ready_to_bill" id="flow-ready" className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Already paid → ready to bill</div>
                  <div className="text-xs text-muted-foreground">Sends to Sai/accounting now</div>
                </div>
              </Label>
              <Label htmlFor="flow-hold" className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                <RadioGroupItem value="on_hold" id="flow-hold" className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Already paid → hold for later</div>
                  <div className="text-xs text-muted-foreground">Capture now, release to billing when ready</div>
                </div>
              </Label>
              <Label htmlFor="flow-approve" className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5">
                <RadioGroupItem value="needs_approval" id="flow-approve" className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Needs approval before I pay</div>
                  <div className="text-xs text-muted-foreground">Notifies admins. Auto-approves under ${autoThreshold}.</div>
                </div>
              </Label>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="exp-desc">Description *</Label>
              <Input id="exp-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="DOB filing fee, asbestos fee, etc." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-amt">Amount *</Label>
              <Input id="exp-amt" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-mk">Markup %</Label>
              <Input id="exp-mk" type="number" step="0.01" min="0" value={markupPct} onChange={(e) => setMarkupPct(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="exp-vendor">Vendor (optional)</Label>
              <Input id="exp-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="NYC DOB, ACME Lab, etc." />
            </div>
            {contacts && contacts.length > 0 && (
              <div className="col-span-2 space-y-1.5">
                <Label>Bill to</Label>
                <Select value={billedToContactId} onValueChange={setBilledToContactId}>
                  <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                  <SelectContent>
                    {contacts.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}{c.is_primary ? " (primary)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {flow === "on_hold" && (
            <div className="space-y-1.5">
              <Label htmlFor="exp-hold">Hold reason *</Label>
              <Textarea id="exp-hold" value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="Waiting on CO #4 approval, billing at closeout, etc." rows={2} />
            </div>
          )}

          {/* Receipt upload */}
          <div className="space-y-1.5">
            <Label>Receipt (optional)</Label>
            {receiptFile ? (
              <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{receiptFile.name}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReceiptFile(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground cursor-pointer hover:bg-muted/40">
                <Upload className="h-4 w-4" />
                <span>Upload receipt (PDF or image)</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>

          {/* Summary */}
          {numAmount > 0 && (
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Cost</span><span>${numAmount.toFixed(2)}</span></div>
              {numMarkup > 0 && <div className="flex justify-between"><span className="text-muted-foreground">+ {numMarkup}% markup</span><span>+${(billable - numAmount).toFixed(2)}</span></div>}
              <div className="flex justify-between font-semibold mt-1 pt-1 border-t"><span>Bills to client</span><span>${billable.toFixed(2)}</span></div>
              {willAutoApprove && (
                <div className="mt-2 text-xs text-emerald-600">Auto-approved (under ${autoThreshold} threshold)</div>
              )}
              {flow === "needs_approval" && !willAutoApprove && numAmount >= autoThreshold && (
                <div className="mt-2 text-xs text-amber-600">Will require admin approval</div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>Cancel</Button>
          <Button onClick={submit} disabled={isBusy}>
            {isBusy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save Expense
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
