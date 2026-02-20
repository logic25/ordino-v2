import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateClaimFlowReferral, useGenerateClaimFlowPackage } from "@/hooks/useClaimFlow";
import { useTelemetry } from "@/hooks/useTelemetry";
import { toast } from "@/hooks/use-toast";
import {
  Gavel, Loader2, FileText, Mail, HandCoins, Clock,
  FileSignature, Users, Scale, CheckCircle2, Download, Package,
} from "lucide-react";
import { differenceInDays, format, addYears } from "date-fns";

interface ClaimFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  totalDue: number;
  dueDate: string | null;
  clientId?: string | null;
  clientName?: string;
  companyName?: string;
}

const packageItems = [
  { id: "invoices", label: "Invoice PDFs & line items", icon: FileText },
  { id: "followups", label: "Follow-up history & notes", icon: Mail },
  { id: "demands", label: "Demand letters sent", icon: Clock },
  { id: "promises", label: "Payment promises (kept & broken)", icon: HandCoins },
  { id: "proposal", label: "Signed proposal / contract (if available)", icon: FileSignature },
  { id: "contacts", label: "Client contact information & billing details", icon: Users },
];

export function ClaimFlowDialog({
  open, onOpenChange, invoiceId, invoiceNumber, totalDue, dueDate, clientId, clientName, companyName,
}: ClaimFlowDialogProps) {
  const { track } = useTelemetry();
  const [caseNotes, setCaseNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [packageUrl, setPackageUrl] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "generating" | "done">("form");
  const createReferral = useCreateClaimFlowReferral();
  const generatePackage = useGenerateClaimFlowPackage();

  const daysOverdue = dueDate
    ? Math.max(0, differenceInDays(new Date(), new Date(dueDate)))
    : 0;

  const filingDeadline = dueDate
    ? addYears(new Date(dueDate), 6)
    : null;

  const handleSubmit = async () => {
    track("invoices", "claimflow_started");
    try {
      // Step 1: Create the referral
      const referral = await createReferral.mutateAsync({
        invoice_id: invoiceId,
        client_id: clientId,
        case_notes: caseNotes.trim() || undefined,
      });

      // Step 2: Generate the legal package PDF
      setStep("generating");
      try {
        const result = await generatePackage.mutateAsync(referral.id);
        setPackageUrl(result.download_url);
        setStep("done");
        toast({
          title: "ClaimCurrent package ready",
          description: `Legal package for ${invoiceNumber} has been generated and is ready for download.`,
        });
      } catch (pkgErr: any) {
        // Referral was created but package generation failed
        setStep("done");
        toast({
          title: "Referral created",
          description: `${invoiceNumber} is on legal hold. Package generation failed: ${pkgErr.message}. You can retry later.`,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setStep("form");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setCaseNotes("");
      setConfirmed(false);
      setPackageUrl(null);
      setStep("form");
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" />
            Send to ClaimCurrent
          </DialogTitle>
          <DialogDescription>
            {step === "done"
              ? "Legal package has been generated and the invoice is on legal hold."
              : step === "generating"
              ? "Generating your legal package..."
              : "Package this invoice for small claims referral. The invoice will be placed on legal hold."}
          </DialogDescription>
        </DialogHeader>

        {step === "generating" ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
              <Package className="h-12 w-12 text-primary/30" />
              <Loader2 className="h-6 w-6 text-primary animate-spin absolute -bottom-1 -right-1" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">Compiling legal package…</p>
              <p className="text-xs text-muted-foreground">
                Gathering invoice data, follow-up history, payment promises, and contact information
              </p>
            </div>
          </div>
        ) : step === "done" ? (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold">Legal Package Ready</p>
                <p className="text-xs text-muted-foreground">
                  {invoiceNumber} is now on <strong>legal hold</strong>. All automated collections have been paused.
                </p>
              </div>
            </div>

            {packageUrl && (
              <Button
                className="w-full"
                onClick={() => window.open(packageUrl, "_blank")}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Legal Package PDF
              </Button>
            )}

            <div className="rounded-md border bg-muted/50 p-3 space-y-1.5 text-sm">
              <p className="font-medium">Package Contents:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Statement of account with full line items</li>
                <li>• Client & billing contact information</li>
                <li>• Complete follow-up & collection history</li>
                <li>• Payment promise records (kept & broken)</li>
                <li>• Full activity log</li>
                {caseNotes && <li>• Your case notes</li>}
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Invoice summary */}
            <div className="rounded-md border bg-muted/50 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{invoiceNumber}</span>
                <Badge variant="outline" className="text-destructive bg-destructive/10 border-destructive/30">
                  {daysOverdue} days overdue
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{clientName || "Unknown Client"}</p>
              <p className="text-lg font-bold font-mono">
                ${totalDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              {dueDate && (
                <p className="text-xs text-muted-foreground">
                  Originally due {format(new Date(dueDate), "MMMM d, yyyy")}
                </p>
              )}
            </div>

            <Separator />

            {/* Package contents */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Legal Package Will Include</Label>
              <div className="space-y-2">
                {packageItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2.5 text-sm">
                    <item.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Statute of limitations reminder */}
            <div className="flex items-start gap-2.5 rounded-md border border-primary/20 bg-primary/5 p-3">
              <Scale className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium">NY Statute of Limitations</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You have up to <strong>6 years</strong> from the breach date to file a small claims action for written contracts in New York.
                  {filingDeadline && (
                    <> Estimated deadline: <strong>{format(filingDeadline, "MMMM d, yyyy")}</strong>.</>
                  )}
                </p>
              </div>
            </div>

            {/* Case notes */}
            <div className="space-y-2">
              <Label>Case Notes (optional)</Label>
              <Textarea
                value={caseNotes}
                onChange={(e) => setCaseNotes(e.target.value)}
                placeholder="Any additional context for the attorney — prior verbal agreements, disputed amounts, relevant communications..."
                rows={3}
              />
            </div>

            {/* Confirmation */}
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3">
              <Checkbox
                id="confirm-claimflow"
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="confirm-claimflow" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                I understand this will place {invoiceNumber} on <strong>legal hold</strong>, pausing all automated collection actions. This referral will be sent to ClaimCurrent for small claims processing.
              </label>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "done" ? (
            <Button onClick={handleClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={step === "generating"}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!confirmed || createReferral.isPending || step === "generating"}
              >
                {(createReferral.isPending || step === "generating") && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <Gavel className="h-4 w-4 mr-2" />
                Send to ClaimCurrent
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
