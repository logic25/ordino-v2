import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus, Search, Loader2, Send, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProposalDialog } from "@/components/proposals/ProposalDialog";
import { ProposalTable } from "@/components/proposals/ProposalTable";
import { LeadsTable } from "@/components/proposals/LeadsTable";
import { SignatureDialog } from "@/components/proposals/SignatureDialog";
import { ProposalApprovalDialog } from "@/components/proposals/ProposalApprovalDialog";
import { ProposalPreviewModal } from "@/components/proposals/ProposalPreviewModal";
import { LeadCaptureDialog, type LeadCaptureData } from "@/components/proposals/LeadCaptureDialog";
import { SendProposalDialog } from "@/components/proposals/SendProposalDialog";
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
import { useLeads, useCreateLead, useDeleteLead, useUpdateLead, type Lead } from "@/hooks/useLeads";
import { useToast } from "@/hooks/use-toast";

// Mock data for proposals when no real data exists
const MOCK_PROPOSALS: ProposalWithRelations[] = [
  {
    id: "mock-1",
    company_id: "",
    property_id: "mock-p1",
    proposal_number: "021526-1",
    title: "Full Permit Package – Alt-1 Renovation",
    status: "accepted",
    client_name: "John Smith",
    client_email: "john@abcbusiness.com",
    total_amount: 8500,
    subtotal: 8500,
    tax_amount: 0,
    tax_rate: 0,
    deposit_required: 4250,
    deposit_percentage: 50,
    created_at: "2026-01-15T10:00:00Z",
    sent_at: "2026-01-16T09:00:00Z",
    internal_signed_at: "2026-01-16T09:30:00Z",
    client_signed_at: "2026-01-18T14:00:00Z",
    next_follow_up_date: null,
    follow_up_dismissed_at: null,
    follow_up_count: 0,
    properties: { id: "mock-p1", address: "123 Main St, Brooklyn, NY 11201", borough: "Brooklyn" } as any,
    creator: { id: "mock-u1", first_name: "Admin", last_name: "User" } as any,
    internal_signer: { id: "mock-u1", first_name: "Admin", last_name: "User" } as any,
    items: [
      { id: "mi-1", name: "Alt-1 Filing", quantity: 1, unit_price: 3500, total_price: 3500, sort_order: 0 } as any,
      { id: "mi-2", name: "DOB Plan Examination", quantity: 1, unit_price: 2500, total_price: 2500, sort_order: 1 } as any,
      { id: "mi-3", name: "Permit Expediting", quantity: 1, unit_price: 2500, total_price: 2500, sort_order: 2 } as any,
    ],
  } as any,
  {
    id: "mock-2",
    company_id: "",
    property_id: "mock-p2",
    proposal_number: "020126-1",
    title: "Violation Resolution – ECB Summons",
    status: "sent",
    client_name: "Jane Doe",
    client_email: "jane@example.com",
    total_amount: 3200,
    subtotal: 3200,
    tax_amount: 0,
    tax_rate: 0,
    deposit_required: 1600,
    created_at: "2026-02-01T11:00:00Z",
    sent_at: "2026-02-02T08:00:00Z",
    next_follow_up_date: "2026-02-09T08:00:00Z",
    follow_up_dismissed_at: null,
    follow_up_count: 1,
    properties: { id: "mock-p2", address: "456 Park Ave, Manhattan, NY 10022", borough: "Manhattan" } as any,
    creator: { id: "mock-u1", first_name: "Admin", last_name: "User" } as any,
  } as any,
  {
    id: "mock-3",
    company_id: "",
    property_id: "mock-p3",
    proposal_number: "021026-1",
    title: "DOB Violation Dismissal",
    status: "draft",
    client_name: "Bob Johnson",
    client_email: "bob@johnson.com",
    total_amount: 4500,
    subtotal: 4500,
    tax_amount: 0,
    tax_rate: 0,
    created_at: "2026-02-10T15:00:00Z",
    next_follow_up_date: null,
    follow_up_dismissed_at: null,
    follow_up_count: 0,
    properties: { id: "mock-p3", address: "789 Broadway, Manhattan, NY 10003", borough: "Manhattan" } as any,
    creator: { id: "mock-u1", first_name: "Admin", last_name: "User" } as any,
  } as any,
  {
    id: "mock-4",
    company_id: "",
    property_id: "mock-p4",
    proposal_number: "011526-2",
    title: "New Building Permit Filing",
    status: "signed_internal",
    client_name: "XYZ Development LLC",
    client_email: "permits@xyzdev.com",
    total_amount: 22000,
    subtotal: 22000,
    tax_amount: 0,
    tax_rate: 0,
    deposit_required: 11000,
    created_at: "2026-01-10T09:00:00Z",
    sent_at: "2026-01-11T10:00:00Z",
    internal_signed_at: "2026-01-11T10:30:00Z",
    next_follow_up_date: "2026-02-11T10:00:00Z",
    follow_up_dismissed_at: null,
    follow_up_count: 2,
    properties: { id: "mock-p4", address: "100 Flatbush Ave, Brooklyn, NY 11217", borough: "Brooklyn" } as any,
    creator: { id: "mock-u1", first_name: "Admin", last_name: "User" } as any,
    internal_signer: { id: "mock-u1", first_name: "Admin", last_name: "User" } as any,
  } as any,
];

// Mock leads data
const MOCK_LEADS: Lead[] = [
  {
    id: "mock-lead-1",
    company_id: "",
    full_name: "Sarah Miller",
    contact_phone: "123-456-7899",
    contact_email: "sarah@example.com",
    property_address: "555 Atlantic Ave, Brooklyn, NY 11217",
    subject: "Summons",
    client_type: "homeowner",
    source: "phone_call",
    notes: "Called about ECB summons received last week. Needs help with hearing.",
    assigned_to: null,
    status: "new",
    proposal_id: null,
    created_by: null,
    created_at: "2026-02-15T10:00:00Z",
    updated_at: "2026-02-15T10:00:00Z",
    assignee: null,
  },
  {
    id: "mock-lead-2",
    company_id: "",
    full_name: "Tom Richards",
    contact_phone: "987-654-3210",
    contact_email: "tom@richardsdev.com",
    property_address: "200 Court St, Brooklyn, NY 11201",
    subject: "New Building Permit",
    client_type: "developer",
    source: "website_form",
    notes: "Submitted via website form. Looking for full permit package for new 4-story residential.",
    assigned_to: null,
    status: "new",
    proposal_id: null,
    created_by: null,
    created_at: "2026-02-14T14:30:00Z",
    updated_at: "2026-02-14T14:30:00Z",
    assignee: null,
  },
  {
    id: "mock-lead-3",
    company_id: "",
    full_name: "Linda Park",
    contact_phone: "555-123-4567",
    contact_email: "linda@parkmanagement.com",
    property_address: null,
    subject: "Violation",
    client_type: "property_manager",
    source: "email",
    notes: "Emailed about violation on one of their managed properties. Waiting for address details.",
    assigned_to: null,
    status: "contacted",
    proposal_id: null,
    created_by: null,
    created_at: "2026-02-13T09:00:00Z",
    updated_at: "2026-02-14T11:00:00Z",
    assignee: null,
  },
];

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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("proposals");
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

  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const createLead = useCreateLead();
  const deleteLead = useDeleteLead();
  const updateLead = useUpdateLead();

  const displayProposals = proposals.length > 0 ? proposals : MOCK_PROPOSALS;
  const displayLeads = leads.length > 0 ? leads : MOCK_LEADS;
  const showingMockProposals = proposals.length === 0 && !isLoading;
  const showingMockLeads = leads.length === 0 && !leadsLoading;

  // Open dialog if coming from properties with a property pre-selected
  useEffect(() => {
    if (defaultPropertyId && !editingProposal) {
      setDialogOpen(true);
    }
  }, [defaultPropertyId]);

  const filteredProposals = displayProposals.filter((p) => {
    if (statusFilter) {
      if (statusFilter === "draft" && p.status !== "draft") return false;
      if (statusFilter === "sent" && !["sent", "viewed", "signed_internal", "signed_client"].includes(p.status || "")) return false;
      if (statusFilter === "accepted" && p.status !== "accepted") return false;
      if (statusFilter === "follow_up") {
        const nextDate = (p as any).next_follow_up_date;
        const dismissed = (p as any).follow_up_dismissed_at;
        if (!nextDate || dismissed || new Date(nextDate) > new Date()) return false;
      }
    }
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    return (
      p.properties?.address?.toLowerCase().includes(query) ||
      p.proposal_number?.toLowerCase().includes(query) ||
      p.title?.toLowerCase().includes(query) ||
      p.client_name?.toLowerCase().includes(query)
    );
  });

  const filteredLeads = displayLeads.filter((l) => {
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    return (
      l.full_name?.toLowerCase().includes(query) ||
      l.contact_email?.toLowerCase().includes(query) ||
      l.property_address?.toLowerCase().includes(query) ||
      l.subject?.toLowerCase().includes(query)
    );
  });

  // Stats
  const draftCount = displayProposals.filter((p) => p.status === "draft").length;
  const sentCount = displayProposals.filter((p) => ["sent", "viewed", "signed_internal", "signed_client"].includes(p.status || "")).length;
  const acceptedCount = displayProposals.filter((p) => p.status === "accepted").length;
  const followUpDueCount = displayProposals.filter((p) => {
    const nextDate = (p as any).next_follow_up_date;
    const dismissed = (p as any).follow_up_dismissed_at;
    return nextDate && !dismissed && new Date(nextDate) <= new Date();
  }).length;
  
  const draftTotal = displayProposals
    .filter((p) => p.status === "draft")
    .reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
  const sentTotal = displayProposals
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

  const handleSubmit = async (data: ProposalFormInput, contacts: ProposalContactInput[], action?: string) => {
    try {
      let proposalId: string;
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
        await handleConfirmSend(proposalId);
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
    try {
      await deleteProposal.mutateAsync(id);
      toast({ title: "Proposal deleted", description: "The proposal has been removed." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete proposal.", variant: "destructive" });
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
      // Always persist the lead
      const leadData: any = {
        full_name: data.full_name,
        contact_phone: data.contact_phone,
        contact_email: data.contact_email,
        property_address: data.property_address,
        subject: data.subject,
        client_type: data.client_type,
        source: data.source,
        notes: data.notes,
        assigned_to: data.assigned_pm_id || undefined,
      };

      if (data.create_proposal) {
        // Create proposal and link it to the lead
        const newProposal = await createProposal.mutateAsync({
          property_id: null as any,
          title: `Lead: ${data.full_name}${data.property_address ? ` – ${data.property_address}` : ""}`,
          client_name: data.full_name,
          client_email: data.contact_email || null,
          lead_source: data.source,
          notes: [
            data.contact_phone ? `Phone: ${data.contact_phone}` : "",
            data.subject ? `Subject: ${data.subject}` : "",
            data.client_type ? `Type: ${data.client_type}` : "",
            data.notes || "",
          ].filter(Boolean).join("\n"),
          assigned_pm_id: data.assigned_pm_id || null,
          sales_person_id: data.assigned_pm_id || null,
        } as any);

        leadData.proposal_id = newProposal.id;
        leadData.status = "converted";
        await createLead.mutateAsync(leadData);

        toast({
          title: "Lead captured!",
          description: `Draft proposal created for ${data.full_name}.`,
        });
      } else {
        await createLead.mutateAsync(leadData);
        toast({
          title: "Lead saved!",
          description: `${data.full_name} logged as a new lead.`,
        });
        setActiveTab("leads");
      }
      setLeadDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteLead = async (id: string) => {
    try {
      await deleteLead.mutateAsync(id);
      toast({ title: "Lead deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleConvertLeadToProposal = async (lead: Lead) => {
    try {
      const newProposal = await createProposal.mutateAsync({
        property_id: null as any,
        title: `Lead: ${lead.full_name}${lead.property_address ? ` – ${lead.property_address}` : ""}`,
        client_name: lead.full_name,
        client_email: lead.contact_email || null,
        lead_source: lead.source,
        notes: [
          lead.contact_phone ? `Phone: ${lead.contact_phone}` : "",
          lead.subject ? `Subject: ${lead.subject}` : "",
          lead.client_type ? `Type: ${lead.client_type}` : "",
          lead.notes || "",
        ].filter(Boolean).join("\n"),
      } as any);

      await updateLead.mutateAsync({ id: lead.id, status: "converted", proposal_id: newProposal.id });
      toast({ title: "Proposal created!", description: `Draft proposal created from lead ${lead.full_name}.` });
      setActiveTab("proposals");
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

        <div className="grid gap-4 md:grid-cols-4">
          <Card
            className={`cursor-pointer transition-colors hover:border-primary/50 ${statusFilter === "draft" ? "border-primary ring-1 ring-primary/20" : ""}`}
            onClick={() => { setStatusFilter(statusFilter === "draft" ? null : "draft"); setActiveTab("proposals"); }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Draft</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{draftCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(draftTotal)} pending</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-colors hover:border-primary/50 ${statusFilter === "sent" ? "border-primary ring-1 ring-primary/20" : ""}`}
            onClick={() => { setStatusFilter(statusFilter === "sent" ? null : "sent"); setActiveTab("proposals"); }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{sentCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(sentTotal)} awaiting</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-colors hover:border-primary/50 ${statusFilter === "accepted" ? "border-primary ring-1 ring-primary/20" : ""}`}
            onClick={() => { setStatusFilter(statusFilter === "accepted" ? null : "accepted"); setActiveTab("proposals"); }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Accepted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{acceptedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-colors hover:border-primary/50 ${followUpDueCount > 0 ? "border-destructive/50" : ""} ${statusFilter === "follow_up" ? "border-primary ring-1 ring-primary/20" : ""}`}
            onClick={() => { setStatusFilter(statusFilter === "follow_up" ? null : "follow_up"); setActiveTab("proposals"); }}
          >
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

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setStatusFilter(null); }}>
          <TabsList>
            <TabsTrigger value="proposals" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Proposals
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {displayProposals.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              Leads
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {displayLeads.length}
              </Badge>
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
                      ({filteredProposals.length})
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Create proposals for properties. When signed by both parties, they auto-convert to projects.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showingMockProposals && (
                  <div className="mb-4 px-3 py-2 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground">
                    📋 Showing sample data. Create your first proposal or capture a lead to get started.
                  </div>
                )}
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
                  <ProposalTable
                    proposals={filteredProposals}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSend={handleOpenSend}
                    onSign={handleOpenSign}
                    onView={handleView}
                    onPreview={(p) => setPreviewProposal(p)}
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
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Leads
                  {!leadsLoading && (
                    <span className="text-muted-foreground font-normal text-sm">
                      ({filteredLeads.length})
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Track incoming leads from calls, emails, and website forms. Convert to proposals when ready.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showingMockLeads && (
                  <div className="mb-4 px-3 py-2 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground">
                    📋 Showing sample data. Capture your first lead to get started.
                  </div>
                )}
                {leadsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <LeadsTable
                    leads={filteredLeads}
                    onDelete={handleDeleteLead}
                    onConvertToProposal={handleConvertLeadToProposal}
                    onUpdateLead={async (id, updates) => {
                      try {
                        await updateLead.mutateAsync({ id, ...updates });
                        toast({ title: "Lead updated" });
                      } catch (error: any) {
                        toast({ title: "Error", description: error.message, variant: "destructive" });
                      }
                    }}
                    isDeleting={deleteLead.isPending}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
        isLoading={createLead.isPending || createProposal.isPending}
      />

      <ProposalPreviewModal
        proposal={previewProposal}
        open={!!previewProposal}
        onOpenChange={(open) => { if (!open) setPreviewProposal(null); }}
        onSend={handleOpenSend}
      />

      <SendProposalDialog
        proposal={sendingProposal}
        open={!!sendingProposal}
        onOpenChange={(open) => { if (!open) setSendingProposal(null); }}
        onConfirmSend={handleConfirmSend}
      />
    </AppLayout>
  );
}
