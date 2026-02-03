import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Search, Loader2, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProposalDialog } from "@/components/proposals/ProposalDialog";
import { ProposalTable } from "@/components/proposals/ProposalTable";
import { SignatureDialog } from "@/components/proposals/SignatureDialog";
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
import { useToast } from "@/hooks/use-toast";

export default function Proposals() {
  const [searchParams] = useSearchParams();
  const defaultPropertyId = searchParams.get("property") || undefined;
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<ProposalWithRelations | null>(null);
  const [signingProposal, setSigningProposal] = useState<ProposalWithRelations | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: proposals = [], isLoading } = useProposals();
  const createProposal = useCreateProposal();
  const updateProposal = useUpdateProposal();
  const deleteProposal = useDeleteProposal();
  const sendProposal = useSendProposal();
  const signProposal = useSignProposalInternal();

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
    // For now, just edit - could add a read-only view later
    setEditingProposal(proposal);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: ProposalFormInput) => {
    try {
      if (editingProposal) {
        await updateProposal.mutateAsync({ id: editingProposal.id, ...data });
        toast({
          title: "Proposal updated",
          description: "The proposal has been updated successfully.",
        });
      } else {
        await createProposal.mutateAsync(data);
        toast({
          title: "Proposal created",
          description: "Your proposal has been created as a draft.",
        });
      }
      setDialogOpen(false);
      setEditingProposal(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProposal.mutateAsync(id);
      toast({
        title: "Proposal deleted",
        description: "The proposal has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete proposal.",
        variant: "destructive",
      });
    }
  };

  const handleSend = async (id: string) => {
    try {
      await sendProposal.mutateAsync(id);
      toast({
        title: "Proposal sent",
        description: "The proposal has been marked as sent.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send proposal.",
        variant: "destructive",
      });
    }
  };

  const handleOpenSign = (proposal: ProposalWithRelations) => {
    setSigningProposal(proposal);
    setSignDialogOpen(true);
  };

  const handleSign = async (signatureData: string, assignedPmId: string) => {
    if (!signingProposal) return;

    try {
      const result = await signProposal.mutateAsync({
        id: signingProposal.id,
        signatureData,
        assignedPmId,
      });
      toast({
        title: "Proposal signed & converted!",
        description: `Project created successfully. The proposal has been converted to a project.`,
      });
      setSignDialogOpen(false);
      setSigningProposal(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign proposal.",
        variant: "destructive",
      });
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
          <Button
            size="sm"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={handleOpenCreate}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Proposal
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Draft</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{draftCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(draftTotal)} pending
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{sentCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(sentTotal)} awaiting
              </p>
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
                  Create your first proposal using the spreadsheet builder
                </p>
                <Button
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={handleOpenCreate}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Proposal
                </Button>
              </div>
            ) : (
              <ProposalTable
                proposals={filteredProposals}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSend={handleSend}
                onSign={handleOpenSign}
                onView={handleView}
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
    </AppLayout>
  );
}
