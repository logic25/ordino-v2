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
import { useCreatePaymentPlan, useSaveACHAuthorization } from "@/hooks/usePaymentPlans";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { ACHAuthorizationStep } from "./ACHAuthorizationStep";
import { toast } from "@/hooks/use-toast";
import { useTelemetry } from "@/hooks/useTelemetry";
import { format, addMonths } from "date-fns";
import { Calendar, Loader2, Percent, SplitSquareVertical } from "lucide-react";

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
  const { track } = useTelemetry();
  const [step, setStep] = useState<1 | 2>(1);
  const [numInstallmentsStr, setNumInstallmentsStr] = useState("3");
  const [useCustomAmounts, setUseCustomAmounts] = useState(false);
  const [interestRateStr, setInterestRateStr] = useState("0");
  const [startDate, setStartDate] = useState(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [customInstallments, setCustomInstallments] = useState<{ amount: string; due_date: string }[]>([]);
  const createPlan = useCreatePaymentPlan();
  const saveACH = useSaveACHAuthorization();
  const { data: companyData } = useCompanySettings();

  const numInstallments = Math.max(2, Math.min(24, parseInt(numInstallmentsStr) || 2));
  const interestRate = parseFloat(interestRateStr) || 0;
  const totalWithInterest = totalDue * (1 + interestRate / 100);

  // Reset step when dialog opens
  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

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

  const handleProceedToACH = () => {
    track("invoices", "payment_plan_started");
    if (!isBalanced && useCustomAmounts) {
      toast({
        title: "Amounts don't add up",
        description: `Installments total $${installmentTotal.toFixed(2)} but invoice is $${totalWithInterest.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }
    setStep(2);
  };

  const handleACHSign = async (achData: {
    clientName: string;
    bankName: string;
    routingLast4: string;
    accountLast4: string;
    accountType: "checking" | "savings";
    authorizationText: string;
    signatureData: string;
    paymentMethod: "ach" | "credit_card";
  }) => {
    try {
      // 1. Create the payment plan
      const plan = await createPlan.mutateAsync({
        invoice_id: invoiceId,
        client_id: clientId,
        total_amount: totalDue,
        num_installments: activeInstallments.length,
        interest_rate: interestRate,
        notes,
        installments: activeInstallments,
      });

      // 2. Save ACH authorization
      await saveACH.mutateAsync({
        payment_plan_id: (plan as any).id,
        invoice_id: invoiceId,
        client_id: clientId,
        client_name: achData.clientName,
        bank_name: achData.bankName,
        routing_last4: achData.routingLast4,
        account_last4: achData.accountLast4,
        account_type: achData.accountType,
        authorization_text: achData.authorizationText,
        signature_data: achData.signatureData,
        payment_method: achData.paymentMethod,
      });

      toast({
        title: "Payment plan created with ACH authorization",
        description: `${activeInstallments.length} installments for ${invoiceNumber}`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const companyName = (companyData?.settings as any)?.company_name || "Your Company";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {step === 1 ? (
          <>
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
                <p className="text-xs text-muted-foreground" data-clarity-mask="true">{clientName || "Unknown Client"}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold font-mono" data-clarity-mask="true">
                    ${totalDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  {interestRate > 0 && (
                    <p className="text-xs text-muted-foreground" data-clarity-mask="true">
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
                    value={numInstallmentsStr}
                    onChange={(e) => setNumInstallmentsStr(e.target.value)}
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
                    value={interestRateStr}
                    onChange={(e) => setInterestRateStr(e.target.value)}
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
                          <span className="text-sm font-mono font-medium w-28" data-clarity-mask="true">
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
                  <span className={`font-mono font-medium ${isBalanced ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`} data-clarity-mask="true">
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
                onClick={handleProceedToACH}
                disabled={!isBalanced && useCustomAmounts}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Continue to ACH Authorization →
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <SplitSquareVertical className="h-5 w-5 text-primary" />
                Payment Plan — ACH Authorization
              </DialogTitle>
              <DialogDescription>
                {invoiceNumber} • {activeInstallments.length} installments
              </DialogDescription>
            </DialogHeader>

            <ACHAuthorizationStep
              companyName={companyName}
              clientName={clientName || ""}
              invoiceNumber={invoiceNumber}
              installments={activeInstallments}
              totalAmount={totalWithInterest}
              onBack={() => setStep(1)}
              onSign={handleACHSign}
              isLoading={createPlan.isPending || saveACH.isPending}
              achTemplate={companyData?.settings?.ach_authorization_template}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}