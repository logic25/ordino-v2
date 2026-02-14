import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Loader2, Mail, RefreshCw, FileText } from "lucide-react";
import { createQBODraft } from "@/lib/mockQBO";
import { type InvoiceWithRelations } from "@/hooks/useInvoices";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { toast } from "@/hooks/use-toast";

interface SendInvoiceModalProps {
  invoice: InvoiceWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}

type SendStep = "confirm" | "generating" | "sending" | "syncing" | "done";

export function SendInvoiceModal({ invoice, open, onOpenChange, onSent }: SendInvoiceModalProps) {
  const [step, setStep] = useState<SendStep>("confirm");
  const [ccEmail, setCcEmail] = useState("");
  const queryClient = useQueryClient();
  const { data: companyData } = useCompanySettings();

  if (!invoice) return null;

  const recipientEmail =
    invoice.billed_to_contact?.email ||
    invoice.clients?.email ||
    "";

  const handleSend = async () => {
    if (!recipientEmail) {
      toast({ title: "No email address", description: "Client or billing contact has no email on file.", variant: "destructive" });
      return;
    }

    try {
      // Step 1: Generate PDF
      setStep("generating");
      const { generateInvoicePDFBlob } = await import("@/components/invoices/InvoicePDFPreview");
      const pdfBlob = await generateInvoicePDFBlob(invoice, companyData?.settings);

      // Convert blob to base64
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const pdfBase64 = btoa(binary);

      // Step 2: Send email via Gmail
      setStep("sending");
      const companyName = "Green Light Expediting";
      const amount = `$${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
      const subject = companyData?.settings?.invoice_email_subject_template
        ? companyData.settings.invoice_email_subject_template
            .replace(/\{\{invoice_number\}\}/g, invoice.invoice_number)
            .replace(/\{\{amount\}\}/g, amount)
        : `Invoice ${invoice.invoice_number} — ${amount} from ${companyName}`;

      const bodyTemplate = companyData?.settings?.invoice_email_body_template || 
        `Dear ${invoice.clients?.name || "Client"},\n\nPlease find attached invoice ${invoice.invoice_number} for ${amount}.\n\nPayment terms: ${invoice.payment_terms || "Net 30"}\n${invoice.due_date ? `Due date: ${new Date(invoice.due_date).toLocaleDateString("en-US")}\n` : ""}\nThank you for your business.\n\nBest regards,\n${companyName}`;

      const { wrapBillingEmailHtml, sendBillingEmail } = await import("@/hooks/useBillingEmail");
      const htmlBody = wrapBillingEmailHtml({
        companyName,
        body: bodyTemplate,
        footer: [
          companyData?.settings?.company_email ? `Email: ${companyData.settings.company_email}` : null,
          companyData?.settings?.company_phone ? `Phone: ${companyData.settings.company_phone}` : null,
        ].filter(Boolean).join(" | "),
      });

      const { data: sendResult, error: sendError } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: recipientEmail,
          cc: ccEmail || undefined,
          subject,
          html_body: htmlBody,
          attachments: [{
            filename: `${invoice.invoice_number}.pdf`,
            content: pdfBase64,
            mime_type: "application/pdf",
          }],
        },
      });
      if (sendError) throw sendError;
      if (sendResult?.error) throw new Error(sendResult.error);

      // Step 3: Sync to QBO (mock)
      setStep("syncing");
      const qboDraft = await createQBODraft({
        invoiceNumber: invoice.invoice_number,
        clientName: invoice.clients?.name || "Unknown",
        lineItems: (Array.isArray(invoice.line_items) ? invoice.line_items : []).map((li: any) => ({
          description: li.description,
          amount: li.amount,
        })),
        totalDue: Number(invoice.total_due),
      });

      // Update invoice status and sent_at
      const now = new Date().toISOString();
      await supabase
        .from("invoices")
        .update({
          status: "sent",
          sent_at: now,
          gmail_message_id: sendResult?.message_id || null,
        } as any)
        .eq("id", invoice.id);

      // Log activity
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (profile) {
        await supabase.from("invoice_activity_log").insert({
          company_id: profile.company_id,
          invoice_id: invoice.id,
          action: "sent",
          details: `Invoice emailed to ${recipientEmail}${ccEmail ? ` (cc: ${ccEmail})` : ""}. QBO draft: ${qboDraft.qboInvoiceId}`,
          performed_by: profile.id,
        } as any);
      }

      setStep("done");
      await new Promise((r) => setTimeout(r, 1500));

      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-counts"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-activity-log"] });

      toast({ title: "Invoice sent successfully!" });
      onOpenChange(false);
      setStep("confirm");
      onSent?.();
    } catch (err: any) {
      toast({ title: "Error sending invoice", description: err.message, variant: "destructive" });
      setStep("confirm");
    }
  };

  const stepIcon = (targetStep: SendStep, currentStep: SendStep) => {
    const steps: SendStep[] = ["generating", "sending", "syncing", "done"];
    const targetIdx = steps.indexOf(targetStep);
    const currentIdx = steps.indexOf(currentStep);

    if (currentStep === "confirm") return null;
    if (currentIdx > targetIdx) return <CheckCircle className="h-4 w-4 text-success" />;
    if (currentIdx === targetIdx) return <Loader2 className="h-4 w-4 animate-spin text-accent" />;
    return <div className="h-4 w-4 rounded-full border-2 border-muted" />;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (step === "confirm" || step === "done") onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "done" ? "Invoice Sent!" : `Send Invoice ${invoice.invoice_number}?`}
          </DialogTitle>
          <DialogDescription>
            {step === "confirm" && "Review the details below before sending."}
            {step !== "confirm" && step !== "done" && "Processing your invoice..."}
            {step === "done" && "Your invoice has been sent successfully."}
          </DialogDescription>
        </DialogHeader>

        {step === "confirm" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">To</Label>
              <p className="text-sm font-medium">{recipientEmail}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">CC (optional)</Label>
              <Input
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                placeholder="cc@example.com"
                className="h-9"
              />
            </div>

            <Separator />

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-mono font-medium">
                  ${Number(invoice.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              {Number(invoice.retainer_applied) > 0 && (
                <div className="flex justify-between text-sm text-success">
                  <span>Retainer applied</span>
                  <span className="font-mono">
                    -${Number(invoice.retainer_applied).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            <Separator />

            <div className="text-xs text-muted-foreground space-y-1">
              <p>This will:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Generate invoice PDF</li>
                <li>Send via Gmail to recipient</li>
                <li>Create draft in QuickBooks Online</li>
                <li>Update invoice status to "Sent"</li>
              </ol>
            </div>
          </div>
        )}

        {step !== "confirm" && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3">
              {stepIcon("generating", step)}
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className={`text-sm ${step === "generating" ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  Generating PDF...
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {stepIcon("sending", step)}
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className={`text-sm ${step === "sending" ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  Sending email...
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {stepIcon("syncing", step)}
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span className={`text-sm ${step === "syncing" ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  Syncing to QuickBooks...
                </span>
              </div>
            </div>
            {step === "done" && (
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-success">All done!</span>
              </div>
            )}
          </div>
        )}

        {step === "confirm" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Mail className="h-4 w-4 mr-2" /> Send Invoice
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
