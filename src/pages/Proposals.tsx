import { formatCurrency } from "@/lib/utils";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ComposeEmailDialog } from "@/components/emails/ComposeEmailDialog";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus, Search, Loader2, Send, UserPlus, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Bell } from "lucide-react";
import { startOfMonth, subMonths, endOfMonth, isWithinInterval } from "date-fns";
import { Input } from "@/components/ui/input";
import { lazy, Suspense } from "react";
const ProposalDialog = lazy(() => import("@/components/proposals/ProposalDialog").then(m => ({ default: m.ProposalDialog })));
import { ProposalTable } from "@/components/proposals/ProposalTable";
import { useNavigate } from "react-router-dom";
import { SignatureDialog, type SignatureRecipient } from "@/components/proposals/SignatureDialog";
import { ProposalApprovalDialog } from "@/components/proposals/ProposalApprovalDialog";
import { ProposalPreviewModal } from "@/components/proposals/ProposalPreviewModal";
import { PostConversionClockInModal } from "@/components/proposals/PostConversionClockInModal";
import { CaptureLeadModal } from "@/components/bd/CaptureLeadModal";
import { SendProposalDialog } from "@/components/proposals/SendProposalDialog";
import {
  useProposals,
  useProposalStats,
  useCreateProposal,
  useUpdateProposal,
  useDeleteProposal,
  useSendProposal,
  useSignProposalInternal,
  ProposalWithRelations,
  ProposalFormInput,
} from "@/hooks/useProposals";
import { useCreateDepositInvoice } from "@/hooks/useInvoices";
import { useSaveProposalContacts, type ProposalContactInput } from "@/hooks/useProposalContacts";
import {
  useMarkProposalApproved,
  useDismissFollowUp,
  useLogFollowUp,
  useSnoozeFollowUp,
} from "@/hooks/useProposalFollowUps";

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";



export default function Proposals() {
  const [searchParams] = useSearchParams();
  const defaultPropertyId = searchParams.get("property") || undefined;
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<ProposalWithRelations | null>(null);
  const [previewProposal, setPreviewProposal] = useState<ProposalWithRelations | null>(null);
  const [signingProposal, setSigningProposal] = useState<ProposalWithRelations | null>(null);
  const [approvingProposal, setApprovingProposal] = useState<ProposalWithRelations | null>(null);
  const [sendingProposal, setSendingProposal] = useState<ProposalWithRelations | null>(null);
  const [clockInProject, setClockInProject] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Status filter — string is single OR comma-list ("draft,sent"); UI chips compare single values.
  const [statusFilter, setStatusFilter] = useState<string | null>(searchParams.get("status"));
  const [activeTab, setActiveTab] = useState("proposals");

  // Sync from ?status= deep-link
  useEffect(() => {
    const s = searchParams.get("status");
    if (s !== statusFilter) setStatusFilter(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [isDraftingFollowUp, setIsDraftingFollowUp] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 25;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createDepositInvoice = useCreateDepositInvoice();

  const handleCreateDepositInvoice = async (proposal: ProposalWithRelations) => {
    try {
      await createDepositInvoice.mutateAsync({
        proposal: {
          id: proposal.id,
          client_id: (proposal as any).client_id || null,
          proposal_number: proposal.proposal_number || null,
          converted_project_id: (proposal as any).converted_project_id || null,
          deposit_required: (proposal as any).deposit_required || 0,
        },
      });
      toast({
        title: "Deposit invoice created",
        description: "Find it in Billing → Ready to Invoice to review and send.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Debounce search for server-side query
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(0); // reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when status filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [statusFilter]);

  const { data: proposalData, isLoading } = useProposals({ 
    page: currentPage, 
    pageSize, 
    search: debouncedSearch,
    statusFilter: statusFilter === "follow_up" ? null : statusFilter,
  });
  const proposals = proposalData?.proposals ?? [];
  const totalCount = proposalData?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const { data: statsData } = useProposalStats();
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

  const navigate = useNavigate();
  const displayProposals = proposals;

  // Open dialog if coming from properties with a property pre-selected (once only)
  const didAutoOpen = useRef(false);
  useEffect(() => {
    if (defaultPropertyId && !editingProposal && !didAutoOpen.current) {
      didAutoOpen.current = true;
      setDialogOpen(true);
    }
  }, [defaultPropertyId]);

  // For follow_up filter, apply client-side on the already-fetched page
  const filteredProposals = statusFilter === "follow_up" 
    ? displayProposals.filter(p => {
        const nextDate = (p as any).next_follow_up_date;
        const dismissed = (p as any).follow_up_dismissed_at;
        return nextDate && !dismissed && new Date(nextDate) <= new Date();
      })
    : displayProposals;

  // Leads tab now redirects to /bd/leads (the BD module owns leads).
  useEffect(() => {
    if (activeTab === "leads") navigate("/bd/leads");
  }, [activeTab, navigate]);


  // Month-over-month analytics from lightweight stats query
  const allStats = statsData || [];
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const thisMonthProposals = allStats.filter(p => {
    const d = new Date(p.created_at || "");
    return isWithinInterval(d, { start: thisMonthStart, end: now });
  });
  const lastMonthProposals = allStats.filter(p => {
    const d = new Date(p.created_at || "");
    return isWithinInterval(d, { start: lastMonthStart, end: lastMonthEnd });
  });

  const thisMonthCount = thisMonthProposals.length;
  const lastMonthCount = lastMonthProposals.length;
  const thisMonthValue = thisMonthProposals.reduce((s, p) => s + Number(p.total_amount || 0), 0);

  const thisMonthSent = thisMonthProposals.filter(p => ["sent", "viewed"].includes(p.status || "")).length;
  const lastMonthSent = lastMonthProposals.filter(p => ["sent", "viewed"].includes(p.status || "")).length;
  const awaitingValue = allStats
    .filter(p => ["sent", "viewed"].includes(p.status || ""))
    .reduce((s, p) => s + Number(p.total_amount || 0), 0);

  const thisMonthExecuted = thisMonthProposals.filter(p => p.status === "executed");
  const lastMonthExecuted = lastMonthProposals.filter(p => p.status === "executed");
  const thisMonthLost = thisMonthProposals.filter(p => (p.status as string) === "lost").length;
  const thisMonthDecided = thisMonthExecuted.length + thisMonthLost;
  const lastMonthLostCount = lastMonthProposals.filter(p => (p.status as string) === "lost").length;
  const lastMonthDecided = lastMonthExecuted.length + lastMonthLostCount;
  const conversionRate = thisMonthDecided > 0 ? (thisMonthExecuted.length / thisMonthDecided) * 100 : 0;
  const lastConversionRate = lastMonthDecided > 0 ? (lastMonthExecuted.length / lastMonthDecided) * 100 : 0;

  const revenueWon = thisMonthExecuted.reduce((s, p) => s + Number(p.total_amount || 0), 0);
  const lastRevenueWon = lastMonthExecuted.reduce((s, p) => s + Number(p.total_amount || 0), 0);

  const followUpDueCount = allStats.filter((p) => {
    const nextDate = (p as any).next_follow_up_date;
    const dismissed = (p as any).follow_up_dismissed_at;
    return nextDate && !dismissed && new Date(nextDate) <= new Date();
  }).length;


  const getDelta = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const TrendBadge = ({ current, previous, suffix = "" }: { current: number; previous: number; suffix?: string }) => {
    const delta = getDelta(current, previous);
    if (delta === 0 && current === 0 && previous === 0) return null;
    const isUp = delta >= 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
        {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(delta)}%{suffix}
      </span>
    );
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

  const handleSubmit = async (data: ProposalFormInput, contacts: ProposalContactInput[], action?: string) => {
    try {
      let proposalId: string;
      // Sync bill_to contact to proposal client_name/client_id
      const billToContact = contacts.find(c => c.role === "bill_to");
      if (billToContact) {
        data.client_name = billToContact.name || data.client_name;
        data.client_id = billToContact.client_id || data.client_id;
        data.client_email = billToContact.email || data.client_email;
      }

      if (editingProposal) {
        await updateProposal.mutateAsync({ id: editingProposal.id, ...data });
        await saveContacts.mutateAsync({ proposalId: editingProposal.id, contacts });
        proposalId = editingProposal.id;
        toast({ title: "Proposal updated", description: "The proposal has been updated successfully." });
      } else {
        const newProposal = await createProposal.mutateAsync(data);
        proposalId = newProposal.id;
        if (contacts.length > 0) {
          await saveContacts.mutateAsync({ proposalId: newProposal.id, contacts });
        }
        toast({ title: "Proposal created", description: "Your proposal has been created as a draft." });
      }
      setDialogOpen(false);
      setEditingProposal(null);

      // Handle post-save actions
      if (action === "save_send") {
        // Fetch full proposal data and open the sign dialog (which triggers the full sign & send flow)
        const { data: freshProposal } = await supabase
          .from("proposals")
          .select(`
            *,
            properties (id, address, borough),
            internal_signer:profiles!proposals_internal_signed_by_fkey (id, first_name, last_name),
            assigned_pm:profiles!proposals_assigned_pm_id_fkey (id, first_name, last_name),
            items:proposal_items(*)
          `)
          .eq("id", proposalId)
          .single();
        if (freshProposal) {
          setSigningProposal(freshProposal as any);
          setSignDialogOpen(true);
        }
      }
      if (action === "save_preview") {
        // Fetch fresh proposal data for preview
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: freshProposal } = await supabase
          .from("proposals")
          .select(`
            *,
            properties (id, address, borough),
            internal_signer:profiles!proposals_internal_signed_by_fkey (id, first_name, last_name),
            assigned_pm:profiles!proposals_assigned_pm_id_fkey (id, first_name, last_name),
            items:proposal_items(*)
          `)
          .eq("id", proposalId)
          .single();
        if (freshProposal) {
          setPreviewProposal(freshProposal as any);
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Something went wrong.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    // Check if proposal is executed — cannot delete
    const proposal = filteredProposals.find((p) => p.id === id);
    if (proposal?.status === "executed") {
      toast({
        title: "Cannot delete executed proposal",
        description: "This proposal has been fully signed and converted to a project. It cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
    try {
      await deleteProposal.mutateAsync(id);
      toast({ title: "Proposal deleted", description: "The proposal has been removed." });
    } catch (error: any) {
      const msg = error.message || "";
      if (msg.includes("foreign key") || msg.includes("projects")) {
        toast({
          title: "Cannot delete this proposal",
          description: "This proposal is linked to a project and cannot be deleted.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: msg || "Failed to delete proposal.", variant: "destructive" });
      }
    }
  };

  const handleOpenSend = async (id: string) => {
    // Fetch proposal with items for the send dialog
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: fullProposal } = await supabase
      .from("proposals")
      .select(`
        *,
        properties (id, address, borough),
        items:proposal_items(*)
      `)
      .eq("id", id)
      .single();
    if (fullProposal) setSendingProposal(fullProposal as any);
  };

  const handleConfirmSend = async (id: string) => {
    try {
      // SendProposalDialog already sent the email — just update sent_at timestamp
      // supabase already imported at top of file
      await supabase
        .from("proposals")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      toast({ title: "Proposal sent", description: "The proposal has been marked as sent. Follow-up scheduled." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update proposal.", variant: "destructive" });
    }
  };

  const handleOpenSign = (proposal: ProposalWithRelations) => {
    setSigningProposal(proposal);
    setSignDialogOpen(true);
  };

  const handleSign = async (signatureData: string, assignedPmId: string, recipient?: SignatureRecipient, ccEmails?: string[]) => {
    if (!signingProposal) return;
    const proposalId = signingProposal.id;
    try {
      const result = await signProposal.mutateAsync({ id: proposalId, signatureData, assignedPmId });
      setSignDialogOpen(false);
      setSigningProposal(null);

      // Fetch full proposal and open preview (for signed HTML capture)
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: fullProposal, error } = await supabase
        .from("proposals")
        .select(`*, properties (id, address, borough), items:proposal_items(*)`)
        .eq("id", proposalId)
        .single();

      if (fullProposal && !error) {
        setPreviewProposal(fullProposal as any);

        // Generate and upload signed proposal as PDF — deferred until preview modal renders
        const projectId = (result as any)?.project?.id;
        if (projectId) {
          setTimeout(async () => {
            try {
              const el = document.getElementById("proposal-preview-content");
              if (el) {
                const html2canvas = (await import("html2canvas")).default;
                const { jsPDF } = await import("jspdf");
                
                const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
                const imgData = canvas.toDataURL("image/jpeg", 0.95);
                
                const pdfWidth = 210; // A4 mm
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                const pdf = new jsPDF({ unit: "mm", format: [pdfWidth, pdfHeight] });
                pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
                
                const pdfBlob = pdf.output("blob");
                const storagePath = `proposals/${proposalId}/signed_proposal.pdf`;
                await supabase.storage.from("documents").upload(storagePath, pdfBlob, { upsert: true, contentType: "application/pdf" });
                await (supabase.from("universal_documents") as any)
                  .update({ storage_path: storagePath, mime_type: "application/pdf", filename: `Proposal_${fullProposal.proposal_number}_Executed.pdf` })
                  .eq("project_id", projectId)
                  .eq("category", "contract")
                  .like("title", "%Signed Proposal%");
              }
            } catch (uploadErr) {
              console.error("Background signed proposal PDF upload failed:", uploadErr);
            }
          }, 1500);
        }

        // Auto-send the proposal email to the selected recipient
        try {
          await sendProposal.mutateAsync(
            recipient
              ? { id: proposalId, recipientEmail: recipient.email, recipientName: recipient.name, ccEmails }
              : proposalId
          );
          toast({ title: "Proposal signed & sent!", description: "The proposal has been emailed to the client." });
        } catch (sendErr: any) {
          console.error("Auto-send after sign failed:", sendErr);
          toast({ title: "Proposal signed", description: "Signed successfully but email send failed. You can resend from the proposal menu.", variant: "destructive" });
        }

        // Offer to clock in on the new project's services
        const newProjectId = (result as any)?.project?.id;
        if (newProjectId) {
          setClockInProject({ id: newProjectId, name: fullProposal.title || "New project" });
        }
      } else {
        toast({ title: "Proposal signed!", description: "Open the proposal to send to client." });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to sign proposal.", variant: "destructive" });
    }
  };

  const handleOpenApproval = (proposal: ProposalWithRelations) => {
    setApprovingProposal(proposal);
    setApprovalDialogOpen(true);
  };

  const handleApprove = async (method: string, notes?: string, _signedDocUrl?: string, assignedPmId?: string) => {
    if (!approvingProposal) return;
    try {
      const result = await markApproved.mutateAsync({ id: approvingProposal.id, approvalMethod: method, notes, assignedPmId });
      const projectId = result?.projectId;
      toast({
        title: "Proposal approved & project created",
        description: `Marked as approved via ${method.replace(/_/g, " ")}.${projectId ? " Project created." : ""}`,
      });
      setApprovalDialogOpen(false);
      setApprovingProposal(null);
      if (projectId) {
        setClockInProject({ id: projectId, name: approvingProposal.title || "New project" });
      }
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

  const handleMarkLost = async (id: string) => {
    try {
      await supabase.from("proposals").update({ status: "lost" } as any).eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      toast({ title: "Proposal marked as lost" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDraftFollowUp = async (proposal: ProposalWithRelations) => {
    setIsDraftingFollowUp(true);
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
      setIsDraftingFollowUp(false);
    }
  };

  // Lead capture is handled by the shared <CaptureLeadModal/> (BD module);
  // lead → proposal conversion lives in BD lead detail (atomic RPC).



  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in" data-tour="proposals-page">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" data-tour="proposals-header">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Proposals</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage client proposals and leads
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

        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5" data-tour="proposals-stats">
          <Card
            className={`cursor-pointer transition-colors hover:border-primary/50 ${statusFilter === null && !["draft","sent","executed","lost","follow_up"].includes(statusFilter || "") ? "border-primary ring-1 ring-primary/20" : ""}`}
            onClick={() => { setStatusFilter(statusFilter === null ? null : null); setActiveTab("proposals"); }}
          >
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Proposals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold">{thisMonthCount}</span>
                <TrendBadge current={thisMonthCount} previous={lastMonthCount} />
              </div>
              <p className="text-xs text-muted-foreground">{formatCurrency(thisMonthValue)} this month</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors hover:border-primary/50 ${statusFilter === "sent" ? "border-primary ring-1 ring-primary/20" : ""}`}
            onClick={() => { setStatusFilter(statusFilter === "sent" ? null : "sent"); setActiveTab("proposals"); }}
          >
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sent / Awaiting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold">{thisMonthSent}</span>
                <TrendBadge current={thisMonthSent} previous={lastMonthSent} />
              </div>
              <p className="text-xs text-muted-foreground">{formatCurrency(awaitingValue)} awaiting</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors hover:border-primary/50 ${statusFilter === "executed" ? "border-primary ring-1 ring-primary/20" : ""}`}
            onClick={() => { setStatusFilter(statusFilter === "executed" ? null : "executed"); setActiveTab("proposals"); }}
          >
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conversion Rate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold">{conversionRate.toFixed(0)}%</span>
                <TrendBadge current={conversionRate} previous={lastConversionRate} />
              </div>
              <p className="text-xs text-muted-foreground">{thisMonthExecuted.length} won · {thisMonthLost} lost</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors hover:border-primary/50 ${statusFilter === "lost" ? "border-primary ring-1 ring-primary/20" : ""}`}
            onClick={() => { setStatusFilter(statusFilter === "lost" ? null : "lost"); setActiveTab("proposals"); }}
          >
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Revenue Won</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold">{formatCurrency(revenueWon)}</span>
                <TrendBadge current={revenueWon} previous={lastRevenueWon} />
              </div>
              <p className="text-xs text-muted-foreground">{thisMonthExecuted.length} executed this month</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-colors hover:border-primary/50 ${followUpDueCount > 0 ? "border-destructive/50" : ""} ${statusFilter === "follow_up" ? "border-primary ring-1 ring-primary/20" : ""}`}
            onClick={() => { setStatusFilter(statusFilter === "follow_up" ? null : "follow_up"); setActiveTab("proposals"); }}
          >
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Bell className="h-3 w-3" />
                Follow-ups Due
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-bold text-destructive">{followUpDueCount}</div>
              <p className="text-xs text-muted-foreground">Need attention</p>
            </CardContent>
          </Card>
        </div>

        {statusFilter && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Filtering: {statusFilter === "follow_up" ? "Follow-ups Due" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
            </Badge>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setStatusFilter(null)}>
              Show All
            </Button>
          </div>
        )}

        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by property, title, or client..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setStatusFilter(null); }}>
          <TabsList>
            <TabsTrigger value="proposals" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Proposals
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {totalCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              Leads
            </TabsTrigger>

          </TabsList>

          <TabsContent value="proposals">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  All Proposals
                  {!isLoading && (
                    <span className="text-muted-foreground font-normal text-sm">
                      ({totalCount})
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
                ) : filteredProposals.length === 0 && !searchQuery && !statusFilter ? (
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
                  <>
                    <ProposalTable
                      proposals={filteredProposals}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onSend={handleOpenSend}
                      onSign={handleOpenSign}
                      onView={handleView}
                      onPreview={(p) => setPreviewProposal(p)}
                      onMarkApproved={handleOpenApproval}
                      onMarkLost={handleMarkLost}
                      onCreateDepositInvoice={handleCreateDepositInvoice}
                      onDismissFollowUp={handleDismissFollowUp}
                      onLogFollowUp={handleLogFollowUp}
                      onSnoozeFollowUp={handleSnoozeFollowUp}
                      onDraftFollowUp={handleDraftFollowUp}
                      isDeleting={deleteProposal.isPending}
                      isSending={sendProposal.isPending || isDraftingFollowUp}
                    />
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 0}
                            onClick={() => setCurrentPage(p => p - 1)}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {currentPage + 1} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage >= totalPages - 1}
                            onClick={() => setCurrentPage(p => p + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <UserPlus className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Leads now live in the BD module. Redirecting…
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate("/bd/leads")}>
                  Go to Leads
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      <Suspense fallback={null}>
        <ProposalDialog
          open={dialogOpen}
          onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingProposal(null); }}
          onSubmit={handleSubmit}
          proposal={editingProposal}
          isLoading={createProposal.isPending || updateProposal.isPending}
          defaultPropertyId={!editingProposal ? defaultPropertyId : undefined}
        />
      </Suspense>

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
        defaultPmId={(approvingProposal as any)?.assigned_pm_id || ""}
      />

      <CaptureLeadModal
        open={leadDialogOpen}
        onOpenChange={setLeadDialogOpen}
        onCreated={() => setActiveTab("leads")}
      />

      <ProposalPreviewModal
        proposal={previewProposal}
        open={!!previewProposal}
        onOpenChange={(open) => { if (!open) setPreviewProposal(null); }}
        onSend={handleOpenSend}
        onSign={handleOpenSign}
      />

      <SendProposalDialog
        proposal={sendingProposal}
        open={!!sendingProposal}
        onOpenChange={(open) => { if (!open) setSendingProposal(null); }}
        onConfirmSend={handleConfirmSend}
        onPreviewPdf={(p) => {
          setSendingProposal(null); // close send dialog first
          setTimeout(() => setPreviewProposal(p), 150); // then open preview
        }}
      />

      <ComposeEmailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultTo={composeTo}
        defaultSubject={composeSubject}
        defaultBody={composeBody}
      />

      <PostConversionClockInModal
        open={!!clockInProject}
        onOpenChange={(open) => { if (!open) setClockInProject(null); }}
        projectId={clockInProject?.id ?? null}
        projectName={clockInProject?.name ?? ""}
      />
    </AppLayout>
  );
}
