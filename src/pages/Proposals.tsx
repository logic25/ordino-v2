import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Search, Loader2, Send, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProposalDialog } from "@/components/proposals/ProposalDialog";
import { ProposalTable } from "@/components/proposals/ProposalTable";
import { SignatureDialog } from "@/components/proposals/SignatureDialog";
import { ProposalApprovalDialog } from "@/components/proposals/ProposalApprovalDialog";
import { LeadCaptureDialog, type LeadCaptureData } from "@/components/proposals/LeadCaptureDialog";
import {
  useProposals,
  useCreateProposal,
  useUpdateProposal,
  useDeleteProposal,
  useSendProposal,
  useSignProposalInternal,
  ProposalWithRelations,
  ProposalFormInput,
} from "@/hooks/useProposals";
import { useSaveProposalContacts, type ProposalContactInput } from "@/hooks/useProposalContacts";
import {
  useMarkProposalApproved,
  useDismissFollowUp,
  useLogFollowUp,
  useSnoozeFollowUp,
} from "@/hooks/useProposalFollowUps";
import { useToast } from "@/hooks/use-toast";

export default function Proposals() {
  const [searchParams] = useSearchParams();
  const defaultPropertyId = searchParams.get("property") || undefined;
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<ProposalWithRelations | null>(null);
  const [signingProposal, setSigningProposal] = useState<ProposalWithRelations | null>(null);
  const [approvingProposal, setApprovingProposal] = useState<ProposalWithRelations | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: proposals = [], isLoading } = useProposals();
  const createProposal = useCreateProposal();
  const updateProposal = useUpdateProposal();
  const deleteProposal = useDeleteProposal();
  const sendProposal = useSendProposal();
  const signProposal = useSignProposalInternal();
  const saveContacts = useSaveProposalContacts();
  const markApproved = useMarkProposalApproved();
  const dismissFollowUp = useDismissFollowUp();
  const logFollowUp = useLogFollowUp();
  const snoozeFollowUp = useSnoozeFollowUp();

  // Open dialog if coming from properties with a property pre-selected
  useEffect(() => {
    if (defaultPropertyId && !editingProposal) {
      setDialogOpen(true);
    }
  }, [defaultPropertyId]);

  const filteredProposals = proposals.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.properties?.address?.toLowerCase().includes(query) ||
      p.proposal_number?.toLowerCase().includes(query) ||
      p.title?.toLowerCase().includes(query) ||
      p.client_name?.toLowerCase().includes(query)
    );
  });

  // Stats
  const draftCount = proposals.filter((p) => p.status === "draft").length;
  const sentCount = proposals.filter((p) => ["sent", "viewed", "signed_internal", "signed_client"].includes(p.status || "")).length;
  const acceptedCount = proposals.filter((p) => p.status === "accepted").length;
  const followUpDueCount = proposals.filter((p) => {
    const nextDate = (p as any).next_follow_up_date;
    const dismissed = (p as any).follow_up_dismissed_at;
    return nextDate && !dismissed && new Date(nextDate) <= new Date();
  }).length;
  
  const draftTotal = proposals
    .filter((p) => p.status === "draft")
    .reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
  const sentTotal = proposals
    .filter((p) => ["sent", "viewed", "signed_internal", "signed_client"].includes(p.status || ""))
    .reduce((sum, p) => sum + Number(p.total_amount || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleOpenCreate = () => {
    setEditingProposal(null);
    setDialogOpen(true);
  };

  const handleEdit = (proposal: ProposalWithRelations) => {
    setEditingProposal(proposal);
    setDialogOpen(true);
  };

  const handleView = (proposal: ProposalWithRelations) => {
    setEditingProposal(proposal);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: ProposalFormInput, contacts: ProposalContactInput[]) => {
    try {
      if (editingProposal) {
        await updateProposal.mutateAsync({ id: editingProposal.id, ...data });
        await saveContacts.mutateAsync({ proposalId: editingProposal.id, contacts });
        toast({ title: "Proposal updated", description: "The proposal has been updated successfully." });
      } else {
        const newProposal = await createProposal.mutateAsync(data);
        if (contacts.length > 0) {
          await saveContacts.mutateAsync({ proposalId: newProposal.id, contacts });
        }
        toast({ title: "Proposal created", description: "Your proposal has been created as a draft." });
      }
      setDialogOpen(false);
      setEditingProposal(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Something went wrong.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProposal.mutateAsync(id);
      toast({ title: "Proposal deleted", description: "The proposal has been removed." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete proposal.", variant: "destructive" });
    }
  };

  const handleSend = async (id: string) => {
    try {
      await sendProposal.mutateAsync(id);
      toast({ title: "Proposal sent", description: "The proposal has been marked as sent. Follow-up scheduled." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send proposal.", variant: "destructive" });
    }
  };

  const handleOpenSign = (proposal: ProposalWithRelations) => {
    setSigningProposal(proposal);
    setSignDialogOpen(true);
  };

  const handleSign = async (signatureData: string, assignedPmId: string) => {
    if (!signingProposal) return;
    try {
      await signProposal.mutateAsync({ id: signingProposal.id, signatureData, assignedPmId });
      toast({ title: "Proposal signed & converted!", description: "Project created successfully." });
      setSignDialogOpen(false);
      setSigningProposal(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to sign proposal.", variant: "destructive" });
    }
  };

  const handleOpenApproval = (proposal: ProposalWithRelations) => {
    setApprovingProposal(proposal);
    setApprovalDialogOpen(true);
  };

  const handleApprove = async (method: string, notes?: string) => {
    if (!approvingProposal) return;
    try {
      await markApproved.mutateAsync({ id: approvingProposal.id, approvalMethod: method, notes });
      toast({ title: "Proposal approved", description: `Marked as approved via ${method.replace(/_/g, " ")}.` });
      setApprovalDialogOpen(false);
      setApprovingProposal(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDismissFollowUp = async (id: string) => {
    try {
      await dismissFollowUp.mutateAsync({ id });
      toast({ title: "Follow-up dismissed" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleLogFollowUp = async (id: string) => {
    try {
      await logFollowUp.mutateAsync({ proposalId: id, action: "called", notes: "Called client" });
      toast({ title: "Follow-up logged", description: "Next follow-up scheduled." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSnoozeFollowUp = async (id: string, days: number) => {
    try {
      await snoozeFollowUp.mutateAsync({ id, days });
      toast({ title: "Snoozed", description: `Follow-up snoozed for ${days} days.` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleLeadSubmit = async (data: LeadCaptureData) => {
    try {
      const contactName = [data.first_name, data.last_name].filter(Boolean).join(" ");
      await createProposal.mutateAsync({
        property_id: null as any, // Lead — no property yet
        title: `Lead: ${contactName}${data.property_address ? ` - ${data.property_address}` : ""}`,
        client_name: contactName,
        client_email: data.contact_email || null,
        lead_source: data.source,
        notes: [
          data.contact_phone ? `Phone: ${data.contact_phone}` : "",
          data.service_needed ? `Service: ${data.service_needed}` : "",
          data.notes || "",
        ].filter(Boolean).join("\n"),
        assigned_pm_id: data.assigned_pm_id || null,
        sales_person_id: data.assigned_pm_id || null,
      } as any);
      toast({
        title: "Lead captured!",
        description: `Draft proposal created for ${contactName}.${data.assigned_pm_id ? " Assigned to PM." : ""}`,
      });
      setLeadDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Proposals</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage client proposals
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLeadDialogOpen(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Capture Lead
            </Button>
            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleOpenCreate}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Proposal
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Draft</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{draftCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(draftTotal)} pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{sentCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(sentTotal)} awaiting</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Accepted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{acceptedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>
          <Card className={followUpDueCount > 0 ? "border-destructive/50" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Follow-ups Due</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${followUpDueCount > 0 ? "text-destructive" : ""}`}>
                {followUpDueCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Need attention</p>
            </CardContent>
          </Card>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by property, title, or client..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              All Proposals
              {!isLoading && (
                <span className="text-muted-foreground font-normal text-sm">
                  ({filteredProposals.length})
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Create proposals for properties. When signed by both parties, they auto-convert to projects.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProposals.length === 0 && !searchQuery ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Send className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No proposals yet</h3>
                <p className="text-muted-foreground mt-1 mb-4">
                  Create your first proposal or capture a lead
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setLeadDialogOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Capture Lead
                  </Button>
                  <Button
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={handleOpenCreate}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Proposal
                  </Button>
                </div>
              </div>
            ) : (
              <ProposalTable
                proposals={filteredProposals}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSend={handleSend}
                onSign={handleOpenSign}
                onView={handleView}
                onMarkApproved={handleOpenApproval}
                onDismissFollowUp={handleDismissFollowUp}
                onLogFollowUp={handleLogFollowUp}
                onSnoozeFollowUp={handleSnoozeFollowUp}
                isDeleting={deleteProposal.isPending}
                isSending={sendProposal.isPending}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ProposalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        proposal={editingProposal}
        isLoading={createProposal.isPending || updateProposal.isPending}
        defaultPropertyId={!editingProposal ? defaultPropertyId : undefined}
      />

      <SignatureDialog
        open={signDialogOpen}
        onOpenChange={setSignDialogOpen}
        onSign={handleSign}
        proposal={signingProposal}
        isLoading={signProposal.isPending}
      />

      <ProposalApprovalDialog
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        onApprove={handleApprove}
        isLoading={markApproved.isPending}
        proposalTitle={approvingProposal?.title}
      />

      <LeadCaptureDialog
        open={leadDialogOpen}
        onOpenChange={setLeadDialogOpen}
        onSubmit={handleLeadSubmit}
        isLoading={createProposal.isPending}
      />
    </AppLayout>
  );
}
