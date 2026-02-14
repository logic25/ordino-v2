import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RotateCcw, PenLine, ArrowLeft, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

interface Installment {
  amount: number;
  due_date: string;
}

type PaymentMethod = "ach" | "credit_card";

interface ACHAuthorizationStepProps {
  companyName: string;
  clientName: string;
  invoiceNumber: string;
  installments: Installment[];
  totalAmount: number;
  onBack: () => void;
  onSign: (data: {
    clientName: string;
    bankName: string;
    routingLast4: string;
    accountLast4: string;
    accountType: "checking" | "savings";
    authorizationText: string;
    signatureData: string;
    paymentMethod: PaymentMethod;
  }) => void;
  isLoading?: boolean;
}

export function ACHAuthorizationStep({
  companyName,
  clientName: defaultClientName,
  invoiceNumber,
  installments,
  totalAmount,
  onBack,
  onSign,
  isLoading,
}: ACHAuthorizationStepProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState(defaultClientName);
  const [bankName, setBankName] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ach");

  const authorizationText = buildAuthText(companyName, invoiceNumber, installments, totalAmount);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  };

  const handleSign = () => {
    if (!canvasRef.current || !hasSignature || !signerName.trim()) return;
    const signatureData = canvasRef.current.toDataURL("image/png");
    onSign({
      clientName: signerName.trim(),
      bankName: paymentMethod === "ach" ? bankName.trim() : "",
      routingLast4: paymentMethod === "ach" ? routingNumber.slice(-4) : "",
      accountLast4: paymentMethod === "ach" ? accountNumber.slice(-4) : "",
      accountType,
      authorizationText,
      signatureData,
      paymentMethod,
    });
  };

  const isValid = hasSignature && signerName.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Installments
      </Button>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
          <ShieldCheck className="h-3 w-3 mr-1" />
          Step 2 of 2
        </Badge>
        <span className="text-sm font-medium">ACH Authorization Agreement</span>
      </div>

      {/* Payment method selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Payment Method</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPaymentMethod("ach")}
            className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors text-sm ${
              paymentMethod === "ach"
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/30"
            }`}
          >
            <span className="font-medium">ACH / Bank Transfer</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">No fee</span>
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("credit_card")}
            className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors text-sm ${
              paymentMethod === "credit_card"
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/30"
            }`}
          >
            <span className="font-medium">Credit Card</span>
            <span className="text-xs text-warning">3% processing fee</span>
          </button>
        </div>
      </div>

      {/* Agreement text */}
      <div className="rounded-md border bg-muted/30 p-3 max-h-48 overflow-y-auto">
        <p className="text-xs leading-relaxed whitespace-pre-line text-muted-foreground">
          {authorizationText}
        </p>
      </div>

      {/* Signer name */}
      <div className="space-y-2">
        <Label>Authorized Signer Name *</Label>
        <Input
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Full legal name"
        />
      </div>

      {/* Bank info — only for ACH */}
      {paymentMethod === "ach" ? (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Bank Information</Label>
          <p className="text-xs text-muted-foreground">
            Only the last 4 digits will be stored. Full processing deferred until payment processor is connected.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Bank Name</Label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Chase, BofA..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Account Type</Label>
              <Select value={accountType} onValueChange={(v) => setAccountType(v as "checking" | "savings")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Routing Number</Label>
              <Input
                type="password"
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="•••••••••"
                maxLength={9}
              />
              {routingNumber.length > 0 && (
                <p className="text-[10px] text-muted-foreground">Last 4: {routingNumber.slice(-4)}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Account Number</Label>
              <Input
                type="password"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 17))}
                placeholder="••••••••••••"
                maxLength={17}
              />
              {accountNumber.length > 0 && (
                <p className="text-[10px] text-muted-foreground">Last 4: {accountNumber.slice(-4)}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-1.5">
          <p className="text-sm font-medium">Credit Card Payment</p>
          <p className="text-xs text-muted-foreground">
            Credit card details will be collected when the self-service payment portal is available. A <strong>3% processing surcharge</strong> will be applied to each installment.
          </p>
          <p className="text-xs text-muted-foreground">
            By signing below, the client acknowledges and agrees to the 3% credit card processing fee on all installment payments.
          </p>
        </div>
      )}

      {/* Signature pad */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Signature *</Label>
          <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
        <div className="border rounded-lg overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            width={400}
            height={150}
            className="w-full cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Draw your signature above to authorize ACH debits per the agreement
        </p>
      </div>

      {/* Sign button */}
      <Button
        onClick={handleSign}
        disabled={!isValid || isLoading}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Processing...
          </span>
        ) : (
          <>
            <PenLine className="h-4 w-4 mr-2" />
            I Agree &amp; Sign
          </>
        )}
      </Button>
    </div>
  );
}

function buildAuthText(
  companyName: string,
  invoiceNumber: string,
  installments: { amount: number; due_date: string }[],
  totalAmount: number,
): string {
  const scheduleLines = installments
    .map((inst, i) => `  ${i + 1}. $${inst.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} due ${format(new Date(inst.due_date), "MMMM d, yyyy")}`)
    .join("\n");

  return `ACH DEBIT AUTHORIZATION AGREEMENT

I hereby authorize ${companyName || "[Company]"} ("Company") to initiate electronic debit entries to my bank account indicated below for payment of amounts owed under invoice ${invoiceNumber}.

PAYMENT SCHEDULE:
Total Amount: $${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
${scheduleLines}

TERMS & CONDITIONS:
1. This authorization is to remain in full force and effect until the Company has received written notification from me of its termination in such time and manner as to afford the Company a reasonable opportunity to act on it.
2. I understand that if any debit is returned unpaid, I may be subject to a return fee.
3. I may revoke this authorization at any time by providing written notice to the Company at least 3 business days prior to the next scheduled debit date.
4. The Company will provide at least 10 days advance notice of any changes to the debit amount or schedule.

This authorization is provided in compliance with the National Automated Clearing House Association (NACHA) Operating Rules.

Effective Date: ${format(new Date(), "MMMM d, yyyy")}`;
}
