import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCircle2, Clock, MoreHorizontal, Phone, Send, X, AlertTriangle, Mail, Loader2 } from "lucide-react";
import { useProposalsNeedingFollowUp, useLogFollowUp, useDismissFollowUp, useSnoozeFollowUp } from "@/hooks/useProposalFollowUps";
import { format, differenceInDays, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ComposeEmailDialog } from "@/components/emails/ComposeEmailDialog";
import { DrillInModal } from "./DrillInModal";
import { useDrilldownList } from "@/hooks/useDrilldownList";
import { InfoTooltip } from "./InfoTooltip";

export function ProposalFollowUps() {
  const navigate = useNavigate();
  const { data: proposals = [], isLoading } = useProposalsNeedingFollowUp();
  const logFollowUp = useLogFollowUp();
  const dismissFollowUp = useDismissFollowUp();
  const snoozeFollowUp = useSnoozeFollowUp();
  const { toast } = useToast();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [drillOpen, setDrillOpen] = useState(false);
  const drill = useDrilldownList("proposal-followups", { enabled: drillOpen });

  const handleDraftFollowUp = async (proposal: any) => {
    setDraftingId(proposal.id);
    try {
      const { data, error } = await supabase.functions.invoke("draft-proposal-followup", {
        body: { proposal_id: proposal.id },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "AI Error", description: data.error, variant: "destructive" });
        return;
      }
      setComposeTo(data.client_email || proposal.client_email || "");
      setComposeSubject(data.subject || "");
      setComposeBody(data.html_body || "");
      setComposeOpen(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to draft follow-up", variant: "destructive" });
    } finally {
      setDraftingId(null);
    }
  };

  const handleLogCall = async (id: string) => {
    try {
      await logFollowUp.mutateAsync({ proposalId: id, action: "called", notes: "Called client to follow up" });
      toast({ title: "Follow-up logged", description: "Next follow-up scheduled." });
    } catch (err: any) {
      toast({ title: "Could not log follow-up", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissFollowUp.mutateAsync({ id });
      toast({ title: "Dismissed", description: "Follow-up dismissed for this proposal." });
    } catch (err: any) {
      toast({ title: "Could not dismiss", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  const handleSnooze = async (id: string, days: number) => {
    try {
      await snoozeFollowUp.mutateAsync({ id, days });
      toast({ title: "Snoozed", description: `Follow-up snoozed for ${days} days.` });
    } catch (err: any) {
      toast({ title: "Could not snooze", description: err?.message || "Please try again.", variant: "destructive" });
    }
  };

  const getUrgency = (dateStr: string) => {
    const days = differenceInDays(new Date(), parseISO(dateStr));
    if (days >= 14) return "destructive";
    if (days >= 7) return "secondary";
    return "outline";
  };


  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-accent-foreground" />
          Proposals to Follow Up
          <InfoTooltip>
            Sent proposals past their <strong>next follow-up date</strong>.
            Cadence is configured per proposal (default: every 3 days for the
            first 2 weeks, then weekly). Use the menu to draft an AI email,
            log a call, snooze, or dismiss.
          </InfoTooltip>
          {proposals.length > 0 && (
            <button onClick={() => setDrillOpen(true)} className="ml-auto">
              <Badge variant="destructive" className="text-xs cursor-pointer hover:opacity-80">
                {proposals.length}
              </Badge>
            </button>
          )}
        </CardTitle>
        <CardDescription>Sent proposals that need your attention</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </>
        ) : proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-primary/50 mb-2" />
            <p className="text-sm text-muted-foreground">All caught up! No follow-ups due.</p>
          </div>
        ) : (
          <>
            {proposals.slice(0, 5).map((proposal: any) => {
              const daysOverdue = differenceInDays(new Date(), parseISO(proposal.next_follow_up_date));
              return (
                <div
                  key={proposal.id}
                  className="flex items-start justify-between p-3 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all"
                >
                  <div
                    className="flex-1 cursor-pointer space-y-1"
                    onClick={() => navigate("/proposals")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate max-w-[180px]">
                        {proposal.title}
                      </span>
                      <Badge variant={getUrgency(proposal.next_follow_up_date)} className="text-[10px] shrink-0">
                        {daysOverdue === 0 ? "Today" : daysOverdue === 1 ? "1d overdue" : `${daysOverdue}d overdue`}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {proposal.client_name || "No client"} 
                      {proposal.total_amount ? ` • ${formatCurrency(Number(proposal.total_amount))}` : ""}
                      {proposal.properties?.address ? ` • ${proposal.properties.address}` : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Sent {proposal.sent_at ? format(new Date(proposal.sent_at), "MMM d") : "—"}
                      {(proposal as any).follow_up_count > 0 && ` • ${(proposal as any).follow_up_count} follow-up(s)`}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDraftFollowUp(proposal)}>
                        {draftingId === proposal.id ? (
                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                        ) : (
                          <Mail className="h-3.5 w-3.5 mr-2" />
                        )}
                        Draft Follow-up Email
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleLogCall(proposal.id)}>
                        <Phone className="h-3.5 w-3.5 mr-2" />
                        Log Call / Follow-up
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSnooze(proposal.id, 3)}>
                        <Clock className="h-3.5 w-3.5 mr-2" />
                        Snooze 3 days
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSnooze(proposal.id, 7)}>
                        <Clock className="h-3.5 w-3.5 mr-2" />
                        Snooze 1 week
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/proposals")}>
                        <Send className="h-3.5 w-3.5 mr-2" />
                        Open Proposal
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDismiss(proposal.id)} className="text-destructive">
                        <X className="h-3.5 w-3.5 mr-2" />
                        Dismiss
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
            {proposals.length > 5 && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/proposals")}>
                View all {proposals.length} proposals
              </Button>
            )}
          </>
        )}
      </CardContent>

      <ComposeEmailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultTo={composeTo}
        defaultSubject={composeSubject}
        defaultBody={composeBody}
      />

      <DrillInModal
        open={drillOpen}
        onOpenChange={setDrillOpen}
        title="Proposals to Follow Up"
        description="Sent proposals past their next follow-up date."
        loading={drill.isLoading}
        rows={drill.data || []}
      />
    </Card>
  );
}
