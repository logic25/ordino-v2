import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Copy, CheckCircle2, ExternalLink, Loader2, FileText } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import type { ProposalWithRelations } from "@/hooks/useProposals";
import { useProposalContacts } from "@/hooks/useProposalContacts";
import { sendBillingEmail } from "@/hooks/useBillingEmail";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { getLogoDataUrl } from "@/utils/logoToDataUrl";
import { buildProposalEmailHtml, resolveProposalEmailTemplate, resolveEmailStyle } from "./buildProposalEmailHtml";

interface SendProposalDialogProps {
  proposal: ProposalWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSend: (id: string) => void;
  onPreviewPdf?: (proposal: ProposalWithRelations) => void;
  companyName?: string;
}

export function SendProposalDialog({ proposal, open, onOpenChange, onConfirmSend, onPreviewPdf, companyName: companyNameProp }: SendProposalDialogProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [previewLogoUrl, setPreviewLogoUrl] = useState("");
  const { data: contacts = [] } = useProposalContacts(proposal?.id);
  const { data: company } = useCompanySettings();
  const { track } = useTelemetry();
  const { data: gmailConnection } = useGmailConnection();
  const { toast } = useToast();

  const resolvedCompanyName = companyNameProp || (company as any)?.name || "Our Team";
  const companySettings = (company as any)?.settings || {};
  const companyEmail = (company as any)?.email || companySettings.company_email || "";
  const companyPhone = (company as any)?.phone || companySettings.company_phone || "";
  const companyLogoUrl = (company as any)?.logo_url || companySettings.company_logo_url || "";
  const companyAddress = (company as any)?.address || companySettings.company_address || "";
  const emailStyle = useMemo(
    () => resolveEmailStyle(company?.settings?.email_style),
    [company],
  );

  // Build recipient options from contacts + fallback
  const recipientOptions = useMemo(() => {
    const opts: { id: string; label: string; name: string; email: string }[] = [];
    const roleLabels: Record<string, string> = {
      bill_to: "Bill To",
      applicant: "Applicant",
      sign: "Signer",
      owner: "Owner",
      cc: "CC",
    };
    for (const c of contacts) {
      if (c.email) {
        opts.push({
          id: c.id,
          label: `${roleLabels[c.role] || c.role} — ${c.name}`,
          name: c.name || "",
          email: c.email,
        });
      }
    }
    if (opts.length === 0 && proposal?.client_email) {
      opts.push({
        id: "fallback",
        label: `Client — ${proposal.client_name || "Client"}`,
        name: proposal.client_name || "Client",
        email: proposal.client_email,
      });
    }
    return opts;
  }, [contacts, proposal?.client_email, proposal?.client_name]);

  const [selectedRecipientId, setSelectedRecipientId] = useState("");

  useEffect(() => {
    if (open && recipientOptions.length > 0) {
      const billTo = contacts.find(c => c.role === "bill_to" && c.email);
      if (billTo) {
        setSelectedRecipientId(billTo.id);
      } else {
        setSelectedRecipientId(recipientOptions[0].id);
      }
    }
  }, [open, recipientOptions, contacts]);

  const selectedRecipient = recipientOptions.find(r => r.id === selectedRecipientId) || recipientOptions[0];
  const clientEmail = selectedRecipient?.email || "";
  // Always use Bill To contact name for the greeting ("Dear ___"), regardless of who the email is sent to
  const billToContact = contacts.find(c => c.role === "bill_to");
  const clientName = billToContact?.name || proposal?.client_name || "Client";
  const token = (proposal as any)?.public_token;
  const clientLink = token ? `${window.location.origin}/proposal/${token}` : null;

  const items = (proposal as any)?.items || [];
  const nonOptionalTotal = items
    .filter((i: any) => !i.is_optional)
    .reduce((sum: number, i: any) => sum + Number(i.total_price || i.quantity * i.unit_price || 0), 0);
  const totalAmount = nonOptionalTotal || Number(proposal?.total_amount || 0);
  const depositPct = Number((proposal as any)?.deposit_percentage || 0);
  const depositAmt = Number((proposal as any)?.deposit_required || 0) || (depositPct > 0 ? totalAmount * (depositPct / 100) : 0);
  const fmt = (value: number) => formatCurrency(value, 2);

  const proposalTemplate = useMemo(
    () => resolveProposalEmailTemplate(
      {
        subject: company?.settings?.email_template_overrides?.proposal?.subject,
        greeting: company?.settings?.email_template_overrides?.proposal?.greeting,
        bodyText: company?.settings?.email_template_overrides?.proposal?.body_text,
        ctaText: company?.settings?.email_template_overrides?.proposal?.cta_text,
        signoff: company?.settings?.email_template_overrides?.proposal?.signoff,
      },
      {
        COMPANY_NAME: resolvedCompanyName,
        CLIENT_NAME: clientName,
        PROJECT_TITLE: proposal?.title || "Your Project",
        PROPERTY_ADDRESS: proposal?.properties?.address || "your project",
        PROPOSAL_NUMBER: proposal?.proposal_number ? `#${proposal.proposal_number}` : "",
        AMOUNT: formatCurrency(totalAmount, 2),
      },
    ),
    [
      clientName,
      company?.settings?.email_template_overrides,
      proposal?.proposal_number,
      proposal?.properties?.address,
      proposal?.title,
      resolvedCompanyName,
      totalAmount,
    ],
  );

  const [subject, setSubject] = useState("");

  useEffect(() => {
    let isActive = true;

    if (!open) return () => {
      isActive = false;
    };

    getLogoDataUrl(companyLogoUrl).then((resolvedLogoUrl) => {
      if (!isActive) return;
      setPreviewLogoUrl(resolvedLogoUrl || companyLogoUrl || "");
    });

    return () => {
      isActive = false;
    };
  }, [open, companyLogoUrl]);

  const previewHtml = useMemo(() => {
    if (!proposal) return "";

    const billToContact = contacts.find((c) => c.role === "bill_to");
    const preparedForName = billToContact?.name || proposal.client_name || "";

    return buildProposalEmailHtml({
      clientName,
      proposalTitle: proposal.title || "Your Project",
      proposalNumber: proposal.proposal_number || "",
      propertyAddress: proposal.properties?.address || "",
      preparedFor: preparedForName || undefined,
      totalAmount: fmt(totalAmount),
      depositAmount: fmt(depositAmt),
      clientLink: clientLink || "#",
      companyName: resolvedCompanyName,
      companyEmail,
      companyPhone,
      logoUrl: previewLogoUrl || companyLogoUrl,
      companyAddress,
      items: items.map((i: any) => ({
        name: i.name,
        total: fmt(Number(i.total_price || i.quantity * i.unit_price || 0)),
        isOptional: !!i.is_optional,
      })),
      greetingText: proposalTemplate.greeting,
      bodyText: proposalTemplate.bodyText,
      ctaText: proposalTemplate.ctaText,
      signoffText: proposalTemplate.signoff,
      style: emailStyle,
    });
  }, [
    clientLink,
    clientName,
    companyAddress,
    companyEmail,
    companyLogoUrl,
    companyPhone,
    contacts,
    depositAmt,
    emailStyle,
    items,
    previewLogoUrl,
    proposal,
    proposalTemplate,
    resolvedCompanyName,
    totalAmount,
  ]);

  useEffect(() => {
    if (proposal && open) {
      setSubject(proposalTemplate.subject);
      setSent(false);
    }
  }, [proposal?.id, open, proposalTemplate.subject]);

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
      const billToContact = contacts.find(c => c.role === "bill_to");
      const preparedForName = billToContact?.name || proposal.client_name || "";

      const htmlBody = buildProposalEmailHtml({
        clientName,
        proposalTitle: proposal.title || "Your Project",
        proposalNumber: proposal.proposal_number || "",
        propertyAddress: proposal.properties?.address || "",
        preparedFor: preparedForName || undefined,
        totalAmount: fmt(totalAmount),
        depositAmount: fmt(depositAmt),
        clientLink,
        companyName: resolvedCompanyName,
        companyEmail,
        companyPhone,
        logoUrl: companyLogoUrl,
        companyAddress,
        items: items.map((i: any) => ({
          name: i.name,
          total: fmt(Number(i.total_price || i.quantity * i.unit_price || 0)),
          isOptional: !!i.is_optional,
        })),
        greetingText: proposalTemplate.greeting,
        bodyText: proposalTemplate.bodyText,
        ctaText: proposalTemplate.ctaText,
        signoffText: proposalTemplate.signoff,
        style: emailStyle,
      });

      await sendBillingEmail({
        to: clientEmail,
        subject,
        htmlBody,
        proposalId: proposal.id,
        projectId: proposal.converted_project_id || undefined,
        tagCategory: "client",
      });

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
      <DialogContent className="w-[min(96vw,1100px)] max-w-[1100px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Proposal to Client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Recipient selector */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="text-sm">
              <Label className="text-xs text-muted-foreground mb-1 block">Send To</Label>
              {recipientOptions.length > 1 ? (
                <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipientOptions.map(opt => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label} &lt;{opt.email}&gt;
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="font-medium text-sm">{clientName} {clientEmail && `<${clientEmail}>`}</div>
              )}
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
            <Label className="text-xs text-muted-foreground mb-1.5 block">Email Preview (exact HTML being sent)</Label>
            <div className="rounded-lg border overflow-hidden">
              {previewHtml ? (
                <div className="bg-muted/20">
                  <iframe
                    srcDoc={previewHtml}
                    title="Proposal email preview"
                    className="w-full border-0"
                    style={{ height: 600 }}
                    sandbox=""
                  />
                </div>
              ) : (
                <div className="p-4 text-sm text-muted-foreground">Preview unavailable.</div>
              )}
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

          {!company?.name && !companyNameProp && (
            <p className="text-xs text-amber-600 font-medium">
              ⚠ Company name is not set — the email will show "Our Team" as the sender. Go to Settings → Company Profile to add your company name and logo.
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
