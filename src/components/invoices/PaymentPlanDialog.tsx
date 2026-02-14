import { useState, useMemo, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useCreatePaymentPlan } from "@/hooks/usePaymentPlans";
import { toast } from "@/hooks/use-toast";
import { format, addMonths } from "date-fns";
import { Calendar, DollarSign, Loader2, Percent, SplitSquareVertical } from "lucide-react";

interface PaymentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  totalDue: number;
  clientId?: string | null;
  clientName?: string;
}

export function PaymentPlanDialog({
  open, onOpenChange, invoiceId, invoiceNumber, totalDue, clientId, clientName,
}: PaymentPlanDialogProps) {
  const [numInstallments, setNumInstallments] = useState(3);
  const [useCustomAmounts, setUseCustomAmounts] = useState(false);
  const [interestRate, setInterestRate] = useState(0);
  const [startDate, setStartDate] = useState(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [customInstallments, setCustomInstallments] = useState<{ amount: string; due_date: string }[]>([]);
  const createPlan = useCreatePaymentPlan();

  const totalWithInterest = totalDue * (1 + interestRate / 100);

  // Generate equal installments
  const equalInstallments = useMemo(() => {
    const perInstallment = Math.floor((totalWithInterest / numInstallments) * 100) / 100;
    const remainder = Math.round((totalWithInterest - perInstallment * numInstallments) * 100) / 100;
    return Array.from({ length: numInstallments }, (_, i) => ({
      amount: i === 0 ? perInstallment + remainder : perInstallment,
      due_date: format(addMonths(new Date(startDate), i), "yyyy-MM-dd"),
    }));
  }, [numInstallments, totalWithInterest, startDate]);

  // Init custom installments when switching to custom
  useEffect(() => {
    if (useCustomAmounts) {
      setCustomInstallments(
        equalInstallments.map((inst) => ({
          amount: inst.amount.toFixed(2),
          due_date: inst.due_date,
        }))
      );
    }
  }, [useCustomAmounts, numInstallments]);

  const activeInstallments = useCustomAmounts
    ? customInstallments.map((c) => ({ amount: parseFloat(c.amount) || 0, due_date: c.due_date }))
    : equalInstallments;

  const installmentTotal = activeInstallments.reduce((sum, i) => sum + i.amount, 0);
  const balanceDiff = Math.abs(installmentTotal - totalWithInterest);
  const isBalanced = balanceDiff < 0.02;

  const updateCustomInstallment = (idx: number, field: "amount" | "due_date", value: string) => {
    setCustomInstallments((prev) =>
      prev.map((inst, i) => (i === idx ? { ...inst, [field]: value } : inst))
    );
  };

  const handleSubmit = async () => {
    if (!isBalanced && useCustomAmounts) {
      toast({
        title: "Amounts don't add up",
        description: `Installments total $${installmentTotal.toFixed(2)} but invoice is $${totalWithInterest.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    try {
      await createPlan.mutateAsync({
        invoice_id: invoiceId,
        client_id: clientId,
        total_amount: totalDue,
        num_installments: activeInstallments.length,
        interest_rate: interestRate,
        notes,
        installments: activeInstallments,
      });
      toast({ title: "Payment plan created", description: `${activeInstallments.length} installments for ${invoiceNumber}` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SplitSquareVertical className="h-5 w-5 text-primary" />
            Create Payment Plan
          </DialogTitle>
          <DialogDescription>
            Set up an installment schedule for {invoiceNumber}
            {clientName ? ` — ${clientName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/50 border">
            <div>
              <p className="text-sm font-medium">{invoiceNumber}</p>
              <p className="text-xs text-muted-foreground">{clientName || "Unknown Client"}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold font-mono">
                ${totalDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              {interestRate > 0 && (
                <p className="text-xs text-muted-foreground">
                  + {interestRate}% = ${totalWithInterest.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                # of Installments
              </Label>
              <Input
                type="number"
                min={2}
                max={24}
                value={numInstallments}
                onChange={(e) => setNumInstallments(Math.max(2, Math.min(24, parseInt(e.target.value) || 2)))}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5" />
                Interest Rate (%)
              </Label>
              <Input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>First Payment Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Custom toggle */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Custom amounts & dates</Label>
            <Switch checked={useCustomAmounts} onCheckedChange={setUseCustomAmounts} />
          </div>

          <Separator />

          {/* Installment schedule */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Installment Schedule</Label>
            <div className="space-y-2">
              {activeInstallments.map((inst, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded-md border bg-background"
                >
                  <Badge variant="outline" className="w-8 h-8 flex items-center justify-center text-xs shrink-0">
                    {idx + 1}
                  </Badge>
                  {useCustomAmounts ? (
                    <>
                      <Input
                        type="number"
                        step={0.01}
                        value={customInstallments[idx]?.amount || ""}
                        onChange={(e) => updateCustomInstallment(idx, "amount", e.target.value)}
                        className="w-28"
                        placeholder="Amount"
                      />
                      <Input
                        type="date"
                        value={customInstallments[idx]?.due_date || ""}
                        onChange={(e) => updateCustomInstallment(idx, "due_date", e.target.value)}
                        className="flex-1"
                      />
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-mono font-medium w-28">
                        ${inst.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-sm text-muted-foreground flex-1">
                        Due {format(new Date(inst.due_date), "MMM d, yyyy")}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Total validation */}
            <div className="flex items-center justify-between pt-2 text-sm">
              <span className="text-muted-foreground">Schedule Total</span>
              <span className={`font-mono font-medium ${isBalanced ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                ${installmentTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                {!isBalanced && useCustomAmounts && (
                  <span className="text-xs ml-1">
                    ({installmentTotal > totalWithInterest ? "+" : "-"}${balanceDiff.toFixed(2)})
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this payment arrangement..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={createPlan.isPending || (!isBalanced && useCustomAmounts)}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {createPlan.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
