import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Copy, CheckCircle2, ExternalLink, Eye } from "lucide-react";
import { useState } from "react";
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

  if (!proposal) return null;

  const billTo = contacts.find(c => c.role === "bill_to");
  const clientEmail = billTo?.email || proposal.client_email || "";
  const clientName = billTo?.name || proposal.client_name || "Client";
  const firstName = clientName.split(" ")[0];

  const token = (proposal as any).public_token;
  const clientLink = token ? `${window.location.origin}/proposal/${token}` : null;

  const totalAmount = Number(proposal.total_amount || 0);
  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

  const copyLink = () => {
    if (clientLink) {
      navigator.clipboard.writeText(clientLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const subject = `Proposal ${proposal.proposal_number} — ${proposal.title}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Proposal to Client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">To:</span>
              <span className="font-medium">{clientName} {clientEmail && `<${clientEmail}>`}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subject:</span>
              <span className="font-medium truncate ml-4">{subject}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-bold">{fmt(totalAmount)}</span>
            </div>
          </div>

          {/* Email preview */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Email Preview</Label>
            <div className="border rounded-lg p-5 bg-white text-sm space-y-3" style={{ lineHeight: 1.6 }}>
              <p>Dear {firstName},</p>
              <p>
                Thank you for the opportunity to work with you. Please find our proposal for <strong>{proposal.title}</strong> at{" "}
                <strong>{proposal.properties?.address || "the project address"}</strong>.
              </p>
              <p>
                The total for the proposed services is <strong>{fmt(totalAmount)}</strong>.
              </p>
              <p>
                You can review and sign the proposal online using the link below:
              </p>
              <div className="bg-[#f8f9fa] border rounded-md p-3 text-center">
                <a href={clientLink || "#"} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium text-sm break-all">
                  {clientLink || "Generating link..."}
                </a>
              </div>
              <p>Please don't hesitate to reach out if you have any questions.</p>
              <p>
                Best regards,<br />
                <strong>{companyName || "The Team"}</strong>
              </p>
            </div>
          </div>

          {/* Client link */}
          {clientLink && (
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
          )}

          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Clicking "Mark as Sent" will update the proposal status and schedule follow-up reminders. The email shown above is a preview — actual email delivery will be available once connected.
          </p>
        </div>

        <DialogFooter className="gap-2">
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
