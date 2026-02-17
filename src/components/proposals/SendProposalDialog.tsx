import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Copy, CheckCircle2, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import type { ProposalWithRelations } from "@/hooks/useProposals";
import { useProposalContacts } from "@/hooks/useProposalContacts";

interface SendProposalDialogProps {
  proposal: ProposalWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSend: (id: string) => void;
  companyName?: string;
}

export function SendProposalDialog({ proposal, open, onOpenChange, onConfirmSend, companyName }: SendProposalDialogProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const { data: contacts = [] } = useProposalContacts(proposal?.id);

  const billTo = contacts.find(c => c.role === "bill_to");
  const clientEmail = billTo?.email || proposal?.client_email || "";
  const clientName = billTo?.name || proposal?.client_name || "Client";
  const firstName = clientName.split(" ")[0];

  const token = (proposal as any)?.public_token;
  const clientLink = token ? `${window.location.origin}/proposal/${token}` : null;
  const totalAmount = Number(proposal?.total_amount || 0);
  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

  const buildDefaultBody = () =>
    `Dear ${firstName},\n\nThank you for the opportunity to work with you. Please find our proposal for ${proposal?.title || "your project"} at ${proposal?.properties?.address || "the project address"}.\n\nThe total for the proposed services is ${fmt(totalAmount)}.\n\nYou can review and sign the proposal online using the link below:\n${clientLink || "[generating link...]"}\n\nThe link also includes a Project Information Sheet — please fill it out at your convenience so we can begin filing on your behalf.\n\nPlease don't hesitate to reach out if you have any questions.\n\nBest regards,\n${companyName || "The Team"}`;

  const [emailBody, setEmailBody] = useState("");
  const [subject, setSubject] = useState("");

  useEffect(() => {
    if (proposal && open) {
      setEmailBody(buildDefaultBody());
      setSubject(`Proposal ${proposal.proposal_number} — ${proposal.title}`);
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
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-bold">{fmt(totalAmount)}</span>
            </div>
          </div>

          {/* Editable email body */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Email Body (editable)</Label>
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={14}
              className="text-sm font-sans leading-relaxed resize-y"
            />
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

          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Clicking "Mark as Sent" will update the proposal status and schedule follow-up reminders. Actual email delivery will be available once your email integration is connected.
          </p>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => { onConfirmSend(proposal.id); onOpenChange(false); }}
          >
            <Send className="h-4 w-4 mr-1.5" />
            Mark as Sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}