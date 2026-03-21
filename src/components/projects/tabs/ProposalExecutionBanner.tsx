import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, Send, Loader2, XCircle, PenLine } from "lucide-react";
import { useSendProposal } from "@/hooks/useProposals";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { ProjectWithRelations } from "@/hooks/useProjects";
import type { ChangeOrder } from "@/hooks/useChangeOrders";

export function ProposalExecutionBanner({ project, changeOrders }: { project: ProjectWithRelations; changeOrders: ChangeOrder[] }) {
  const unsignedCOs = changeOrders.filter(co => (!co.internal_signed_at || !co.client_signed_at) && co.status !== "draft");
  const proposal = project.proposals;
  const resendProposal = useSendProposal();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!proposal) return null;

  const proposalNumber = proposal.proposal_number || "—";
  const internalDate = proposal.internal_signed_at
    ? format(new Date(proposal.internal_signed_at), "MM/dd/yyyy")
    : null;
  const clientDate = (proposal as any).client_signed_at
    ? format(new Date((proposal as any).client_signed_at), "MM/dd/yyyy")
    : null;
  const sentAt = (proposal as any).sent_at
    ? format(new Date((proposal as any).sent_at), "MM/dd/yyyy 'at' h:mm a")
    : null;
  const fullyExecuted = !!internalDate && (!!clientDate || proposal.status === "executed");

  const handleResend = async () => {
    setResending(true);
    try {
      await resendProposal.mutateAsync(proposal.id);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", project.id] });
      toast({ title: "Proposal resent", description: `Signature request resent for Proposal #${proposalNumber}. Sent date updated.` });
    } catch (e: any) {
      toast({ title: "Error resending", description: e.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    toast({ title: "Banner dismissed", description: "Signature reminder hidden for this session." });
  };

  if (dismissed && !fullyExecuted) {
    if (unsignedCOs.length === 0) return null;
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-sm">
          <PenLine className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-700 dark:text-amber-300">
            {unsignedCOs.length} CO{unsignedCOs.length > 1 ? "s" : ""} awaiting signature: {unsignedCOs.map(co => co.co_number).join(", ")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
        fullyExecuted 
          ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800" 
          : "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
      }`}>
        {fullyExecuted ? (
          <>
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-700 dark:text-emerald-300 font-medium">Proposal #{proposalNumber} — Fully Executed</span>
            <span className="text-xs text-muted-foreground">
              Internal: {internalDate}{clientDate ? ` · Client: ${clientDate}` : ` · ${({physical_copy:"Physical signed copy",client_agreement:"Client's own agreement",email_confirmation:"Email confirmation"})[proposal.approval_method || ""] || "Approved (alt. method)"}`}
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-700 dark:text-amber-300 font-medium">Proposal #{proposalNumber} — Awaiting Client Signature</span>
            {internalDate && (
              <span className="text-xs text-muted-foreground">Internal signed: {internalDate}</span>
            )}
            {sentAt && (
              <span className="text-xs text-muted-foreground">Last sent: {sentAt}</span>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                {resending ? "Sending..." : "Resend for Signature"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={handleDismiss}
                title="Dismiss — proposal was approved via alternative method"
              >
                <XCircle className="h-3 w-3" />
                Dismiss
              </Button>
            </div>
          </>
        )}
      </div>

      {unsignedCOs.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-sm">
          <PenLine className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-700 dark:text-amber-300">
            {unsignedCOs.length} CO{unsignedCOs.length > 1 ? "s" : ""} awaiting signature: {unsignedCOs.map(co => co.co_number).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
