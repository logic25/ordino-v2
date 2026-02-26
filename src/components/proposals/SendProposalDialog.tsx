import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Copy, CheckCircle2, ExternalLink, Loader2, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import type { ProposalWithRelations } from "@/hooks/useProposals";
import { useProposalContacts } from "@/hooks/useProposalContacts";
import { sendBillingEmail } from "@/hooks/useBillingEmail";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { useToast } from "@/hooks/use-toast";

interface SendProposalDialogProps {
  proposal: ProposalWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSend: (id: string) => void;
  onPreviewPdf?: (proposal: ProposalWithRelations) => void;
  companyName?: string;
}

function buildProposalEmailHtml({
  clientName,
  proposalTitle,
  propertyAddress,
  totalAmount,
  depositAmount,
  clientLink,
  companyName,
  companyEmail,
  companyPhone,
  items,
}: {
  clientName: string;
  proposalTitle: string;
  propertyAddress: string;
  totalAmount: string;
  depositAmount: string;
  clientLink: string;
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  items: { name: string; total: string; isOptional: boolean }[];
}) {
  const serviceRows = items
    .filter(i => !i.isOptional)
    .map(i => `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${i.name}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-family:'JetBrains Mono',monospace;">${i.total}</td></tr>`)
    .join("");

  const optionalRows = items
    .filter(i => i.isOptional)
    .map(i => `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;font-style:italic;">${i.name} (optional)</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-family:'JetBrains Mono',monospace;color:#64748b;">${i.total}</td></tr>`)
    .join("");

  const footerParts = [
    companyEmail ? `<a href="mailto:${companyEmail}" style="color:#64748b;">${companyEmail}</a>` : null,
    companyPhone ? `<span style="color:#64748b;">${companyPhone}</span>` : null,
  ].filter(Boolean).join(" &nbsp;|&nbsp; ");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="background:#1e293b;padding:24px 32px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${companyName}</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Proposal for Your Review</p>
    </div>

    <!-- Body Card -->
    <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 16px;font-size:15px;color:#1e293b;line-height:1.6;">Dear ${clientName.split(" ")[0]},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
        Thank you for the opportunity to work with you. We've prepared a proposal for <strong>${proposalTitle}</strong> at <strong>${propertyAddress}</strong>.
      </p>

      <!-- Summary Box -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid #e2e8f0;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;">Service</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${serviceRows}
            ${optionalRows}
          </tbody>
        </table>
        <div style="border-top:2px solid #1e293b;margin-top:8px;padding-top:12px;display:flex;justify-content:space-between;">
          <table style="width:100%;">
            <tr>
              <td style="font-size:15px;font-weight:700;color:#1e293b;">Total</td>
              <td style="font-size:18px;font-weight:800;color:#1e293b;text-align:right;font-family:'JetBrains Mono',monospace;">${totalAmount}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#64748b;padding-top:4px;">Retainer Due</td>
              <td style="font-size:14px;font-weight:600;color:#64748b;text-align:right;font-family:'JetBrains Mono',monospace;padding-top:4px;">${depositAmount}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${clientLink}" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.3px;">
          Review &amp; Sign Proposal
        </a>
      </div>

      <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-align:center;line-height:1.5;">
        The link above also includes a Project Information Sheet — please fill it out at your convenience so we can begin work on your behalf.
      </p>

      <p style="margin:24px 0 0;font-size:15px;color:#334155;line-height:1.6;">
        Please don't hesitate to reach out if you have any questions.
      </p>
      <p style="margin:16px 0 0;font-size:15px;color:#1e293b;">
        Best regards,<br/><strong>${companyName}</strong>
      </p>
    </div>

    <!-- Footer -->
    ${footerParts ? `<div style="text-align:center;padding:16px;font-size:12px;">${footerParts}</div>` : ""}
  </div>
</body>
</html>`;
}

export function SendProposalDialog({ proposal, open, onOpenChange, onConfirmSend, onPreviewPdf, companyName: companyNameProp }: SendProposalDialogProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { data: contacts = [] } = useProposalContacts(proposal?.id);
  const { data: company } = useCompanySettings();
  const { track } = useTelemetry();
  const { data: gmailConnection } = useGmailConnection();
  const { toast } = useToast();

  const resolvedCompanyName = companyNameProp || (company as any)?.name || "Our Team";
  const companyEmail = (company as any)?.email || "";
  const companyPhone = (company as any)?.phone || "";

  const billTo = contacts.find(c => c.role === "bill_to");
  const clientEmail = billTo?.email || proposal?.client_email || "";
  const clientName = billTo?.name || proposal?.client_name || "Client";
  const firstName = clientName.split(" ")[0];

  const token = (proposal as any)?.public_token;
  const clientLink = token ? `${window.location.origin}/proposal/${token}` : null;

  // Calculate non-optional total
  const items = (proposal as any)?.items || [];
  const nonOptionalTotal = items
    .filter((i: any) => !i.is_optional)
    .reduce((sum: number, i: any) => sum + Number(i.total_price || i.quantity * i.unit_price || 0), 0);
  const totalAmount = nonOptionalTotal || Number(proposal?.total_amount || 0);
  const depositPct = Number((proposal as any)?.deposit_percentage || 0);
  const depositAmt = Number((proposal as any)?.deposit_required || 0) || (depositPct > 0 ? totalAmount * (depositPct / 100) : 0);

  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

  const [subject, setSubject] = useState("");
  const [emailPreview, setEmailPreview] = useState("");

  useEffect(() => {
    if (proposal && open) {
      setSubject(`Proposal ${proposal.proposal_number} — ${proposal.title}`);
      setSent(false);
      setEmailPreview(
        `Dear ${firstName},\n\nThank you for the opportunity to work with you. We've prepared a proposal for ${proposal.title} at ${proposal.properties?.address || "your project"}.\n\nTotal: ${fmt(totalAmount)}\nRetainer Due: ${fmt(depositAmt)}\n\nPlease review and sign using the link provided.\n\nBest regards,\n${resolvedCompanyName}`
      );
    }
  }, [proposal?.id, open]);

  if (!proposal) return null;

  const copyLink = () => {
    if (clientLink) {
      navigator.clipboard.writeText(clientLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleSend = async () => {
    if (!clientEmail || !clientLink) return;
    setIsSending(true);
    track("proposals", "send_started", { proposal_id: proposal.id });
    try {
      const htmlBody = buildProposalEmailHtml({
        clientName,
        proposalTitle: proposal.title || "Your Project",
        propertyAddress: proposal.properties?.address || "",
        totalAmount: fmt(totalAmount),
        depositAmount: fmt(depositAmt),
        clientLink,
        companyName: resolvedCompanyName,
        companyEmail,
        companyPhone,
        items: items.map((i: any) => ({
          name: i.name,
          total: fmt(Number(i.total_price || i.quantity * i.unit_price || 0)),
          isOptional: !!i.is_optional,
        })),
      });

      await sendBillingEmail({ to: clientEmail, subject, htmlBody });

      track("proposals", "send_completed", { proposal_id: proposal.id });
      onConfirmSend(proposal.id);
      setSent(true);
    } catch (error: any) {
      console.error("Failed to send proposal email:", error);
      toast({
        title: "Failed to send email",
        description: error.message || "Please check your Gmail connection.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Proposal to Client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Recipient info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">To:</span>
              <span className="font-medium">{clientName} {clientEmail && `<${clientEmail}>`}</span>
            </div>
            <div className="text-sm">
              <Label className="text-xs text-muted-foreground mb-1 block">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Total (excl. optional):</span>
              <span className="font-bold">{fmt(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Retainer Due:</span>
              <span className="font-medium">{fmt(depositAmt)}</span>
            </div>
          </div>

          {/* Email preview */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Email Preview (client will receive branded HTML)</Label>
            <div className="border rounded-lg p-4 bg-muted/30 text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
              {emailPreview}
            </div>
          </div>

          {/* Client link */}
          {clientLink && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Client Link</Label>
              <div className="flex items-center gap-2">
                <Input value={clientLink} readOnly className="text-xs font-mono" />
                <Button variant="outline" size="sm" onClick={copyLink} className="shrink-0">
                  {linkCopied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" asChild className="shrink-0">
                  <a href={clientLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          )}

          {!clientEmail && (
            <p className="text-xs text-destructive font-medium">
              ⚠ No client email address found. Please add one to the proposal contacts before sending.
            </p>
          )}

          {!gmailConnection && (
            <p className="text-xs text-destructive font-medium">
              ⚠ Gmail must be connected to send emails. Go to Emails to connect your account.
            </p>
          )}

          {sent && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Proposal sent successfully!
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          {onPreviewPdf && proposal && (
            <Button
              variant="outline"
              onClick={() => onPreviewPdf(proposal)}
              className="mr-auto"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              Preview PDF
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {sent ? "Close" : "Cancel"}
          </Button>
          {!sent && (
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleSend}
              disabled={!clientEmail || !clientLink || isSending || !gmailConnection}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5" />
                  Send via Email
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
