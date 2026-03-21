import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSensors, useSensor, PointerSensor } from "@dnd-kit/core";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useProjectChecklist, useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem, type ChecklistItem } from "@/hooks/useProjectChecklist";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { wrapEmailForSending } from "@/components/rfps/buildPartnerEmailTemplate";
import { useChecklistFollowupDrafts, useApproveDraft, useDismissDraft } from "@/hooks/useChecklistFollowupDrafts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Pencil, FileText, Users, Clock, Mail,
  File, GitBranch, DollarSign, MapPin, Building2, User,
  Loader2, ExternalLink, ChevronRight, ChevronDown,
  MessageSquare, CheckCircle2, Send, XCircle, CheckCheck,
  Phone, Circle, Upload, Search, Plus, AlertTriangle, Trash2,
  ArrowUpRight, ArrowDownLeft, ClipboardList, FileImage,
  FileSpreadsheet, Download, Sparkles, Eye, ShieldCheck, PenLine,
  GripVertical, ArrowUp, ArrowDown, UserPlus, ArrowUpDown,
} from "lucide-react";
import { useProject, useUpdateProject, ProjectWithRelations } from "@/hooks/useProjects";
import { useProjectTimer } from "@/hooks/useProjectTimer";
import { useSendProposal } from "@/hooks/useProposals";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { useAssignableProfiles, useCompanyProfiles } from "@/hooks/useProfiles";
import { ProjectEmailsTab } from "@/components/emails/ProjectEmailsTab";
import { AddContactDialog } from "@/components/clients/AddContactDialog";
import { EditContactDialog } from "@/components/clients/EditContactDialog";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { LitigationExportDialog } from "@/components/projects/LitigationExportDialog";
import { DobNowFilingPrepSheet } from "@/components/projects/DobNowFilingPrepSheet";
import { EditPISDialog } from "@/components/projects/EditPISDialog";
import { ResearchWorkspace } from "@/components/projects/ResearchWorkspace";
import { ResearchTabContainer } from "@/components/projects/ResearchTabContainer";
import { useGenerateProjectChecklist } from "@/hooks/useGenerateChecklist";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatCurrency, serviceStatusStyles, dobRoleLabels, coStatusStyles,
  checklistCategoryLabels, docCategoryLabels,
} from "@/components/projects/projectMockData";
import type {
  MockService, MockContact, MockMilestone,
  MockEmail, MockDocument, MockTimeEntry, MockChecklistItem, MockPISStatus, MockProposalSignature,
} from "@/components/projects/projectMockData";
import {
  useProjectServices, useProjectContacts, useProjectTimeline, useProjectPISStatus, useProjectDocuments,
} from "@/hooks/useProjectDetail";
import { useTimelineEvents } from "@/hooks/useTimelineEvents";
import { QuickReferenceBar } from "@/components/projects/QuickReferenceBar";
import { useChangeOrders, useCreateChangeOrder, useDeleteChangeOrder } from "@/hooks/useChangeOrders";
import { ChangeOrderDialog } from "@/components/projects/ChangeOrderDialog";
import { ChangeOrderDetailSheet } from "@/components/projects/ChangeOrderDetailSheet";
import { ActionItemsTab } from "@/components/projects/ActionItemsTab";
import { SendToBillingDialog } from "@/components/invoices/SendToBillingDialog";
import { ComposeEmailDialog } from "@/components/emails/ComposeEmailDialog";
import type { ChangeOrder } from "@/hooks/useChangeOrders";
// Extracted tab components
import { ProposalExecutionBanner } from "@/components/projects/tabs/ProposalExecutionBanner";
import { EmailsFullLive } from "@/components/projects/tabs/EmailsFullLive";
import { ContactsFull } from "@/components/projects/tabs/ContactsFull";
import { TimelineFull } from "@/components/projects/tabs/TimelineFull";
import { DocumentsFull } from "@/components/projects/tabs/DocumentsFull";
import { ChangeOrdersFull } from "@/components/projects/tabs/ChangeOrdersFull";
import { JobCostingFull } from "@/components/projects/tabs/JobCostingFull";
import { ReadinessChecklist } from "@/components/projects/tabs/ReadinessChecklist";
import { ServicesFull } from "@/components/projects/tabs/ServicesFull";
import { TimeLogsFull } from "@/components/projects/tabs/TimeLogsFull";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", variant: "default" },
  on_hold: { label: "On Hold", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
  paid: { label: "Paid", variant: "default" },
};

// High-complexity project types (multi-discipline, regulatory-heavy)
const COMPLEX_PROJECT_TYPES = ["new building", "major alteration", "enlargement", "full gut renovation", "demolition"];
const MODERATE_PROJECT_TYPES = ["alteration type 1", "alteration type 2", "alt-1", "alt-2", "facade repair", "sidewalk shed"];

function calculateComplexityTier(projectType: string | null | undefined, serviceCount: number): { label: string; color: string } {
  const type = (projectType || "").toLowerCase().trim();
  const isComplex = COMPLEX_PROJECT_TYPES.some(t => type.includes(t));
  const isModerate = MODERATE_PROJECT_TYPES.some(t => type.includes(t));

  if (isComplex || serviceCount >= 8) return { label: "Complex", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (isModerate || serviceCount >= 4) return { label: "Standard", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  return { label: "Simple", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
}

const formatName = (profile: { first_name: string | null; last_name: string | null } | null | undefined) => {
  if (!profile) return "—";
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—";
};

function LitigationButton({ onClick }: { onClick: () => void }) {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;
  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={onClick}>
      <ShieldCheck className="h-3.5 w-3.5" /> Litigation Package
    </Button>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id);
  const { data: assignableProfiles = [] } = useAssignableProfiles();
  const updateProject = useUpdateProject();
  const projectTimer = useProjectTimer();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [litigationDialogOpen, setLitigationDialogOpen] = useState(false);
  const [coDialogOpen, setCoDialogOpen] = useState(false);
  const [selectedCOId, setSelectedCOId] = useState<string | null>(null);
  const [coSheetOpen, setCoSheetOpen] = useState(false);
  const [coAutoSign, setCoAutoSign] = useState(false);

  // Real data hooks — use URL id directly so services don't wait for useProjects() to resolve
  const { data: realServices = [], isLoading: servicesLoading } = useProjectServices(id);
  const { data: realContacts = [] } = useProjectContacts(project?.id, project?.client_id, (project as any)?.proposal_id);
  const { data: realTimeline = [] } = useProjectTimeline(project?.id, (project as any)?.proposal_id);
  const { data: realPISStatus } = useProjectPISStatus(project?.id);
  const { data: realDocuments = [] } = useProjectDocuments(project?.id, (project as any)?.proposal_id);

  // DOB applications for QuickReferenceBar
  const { data: dobApplications = [] } = useQuery({
    queryKey: ["dob-apps-quick", project?.id],
    enabled: !!project?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("dob_applications")
        .select("id, job_number, application_type, status")
        .eq("project_id", project!.id)
        .order("created_at");
      return (data || []) as { id: string; job_number: string | null; application_type: string | null; status: string | null }[];
    },
  });

  // DB-backed checklist items (must be before early returns)
  const { data: dbChecklistItems = [] } = useProjectChecklist(id);

  // liveServices state removed — was causing infinite render loop. ServicesFull manages its own orderedServices internally.

  // Fetch primary contact from client's contacts
  const { data: primaryContact } = useQuery({
    queryKey: ["primary-contact", project?.client_id],
    enabled: !!project?.client_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("id, name, phone, email, is_primary")
        .eq("client_id", project!.client_id!)
        .eq("is_primary", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const handlePmChange = async (profileId: string) => {
    if (!project) return;
    const pmId = profileId === "__unassigned__" ? null : profileId;
    const { error } = await supabase.from("projects").update({ assigned_pm_id: pmId } as any).eq("id", project.id);
    if (error) {
      toast({ title: "Error", description: "Failed to update PM assignment.", variant: "destructive" });
    } else {
      toast({ title: "PM Updated", description: "Project manager reassigned." });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  };


  // Real change orders
  const { data: realChangeOrders = [] } = useChangeOrders(project?.id);
  const selectedCO = realChangeOrders.find(co => co.id === selectedCOId) || null;

  // Real time entries from activities table
  const { data: realTimeEntries = [] } = useQuery({
    queryKey: ["project-time-entries", project?.id],
    enabled: !!project?.id,
    queryFn: async () => {
      // Get application IDs for this project
      const { data: apps } = await supabase
        .from("dob_applications")
        .select("id")
        .eq("project_id", project!.id);
      const appIds = (apps || []).map(a => a.id);

      // Get service IDs for this project
      const { data: svcs } = await supabase
        .from("services")
        .select("id")
        .eq("project_id", project!.id);
      const svcIds = (svcs || []).map(s => s.id);

      // Build OR filter: application_id in appIds OR service_id in svcIds OR metadata->>project_id = projectId
      const filters: string[] = [];
      if (appIds.length > 0) filters.push(`application_id.in.(${appIds.join(",")})`);
      if (svcIds.length > 0) filters.push(`service_id.in.(${svcIds.join(",")})`);
      // Also catch entries linked via metadata (e.g. from action item completion)
      filters.push(`metadata->>project_id.eq.${project!.id}`);

      if (filters.length === 0) {
        return [] as MockTimeEntry[];
      }

      const { data, error } = await supabase
        .from("activities")
        .select("id, activity_date, description, duration_minutes, billable, user:profiles!activities_user_id_fkey(first_name, last_name, display_name, hourly_rate), service:services!activities_service_id_fkey(name)")
        .eq("company_id", project!.company_id)
        .or(filters.join(","))
        .order("activity_date", { ascending: false });

      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        date: a.activity_date ? format(new Date(a.activity_date), "MM/dd/yyyy") : "—",
        user: a.user?.display_name || [a.user?.first_name, a.user?.last_name].filter(Boolean).join(" ") || "Unknown",
        service: a.service?.name || "General",
        description: a.description || "",
        hours: (a.duration_minutes || 0) / 60,
        hourlyRate: a.user?.hourly_rate || 0,
        billable: a.billable ?? true,
      })) as MockTimeEntry[];
    },
  });

  // Must be before any early returns (Rules of Hooks)
  const createCO = useCreateChangeOrder();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <h2 className="text-xl font-semibold">Project not found</h2>
          <Button variant="outline" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
          </Button>
        </div>
      </AppLayout>
    );
  }

  const status = statusConfig[project.status] || statusConfig.open;

  const contacts = realContacts;
  const milestones = realTimeline;
  const changeOrders = realChangeOrders;
  const emails: MockEmail[] = [];
  const documents: MockDocument[] = realDocuments;
  const timeEntries: MockTimeEntry[] = realTimeEntries;
  const pisStatus: MockPISStatus = realPISStatus || { sentDate: null, totalFields: 0, completedFields: 0, missingFields: [] };

  // Always prefer realServices for financial calculations — liveServices is only for local reorder state
  const servicesForCalc = realServices;
  const approvedCOs = changeOrders.filter(co => co.status === "approved").reduce((s, co) => s + (Number(co.amount) || 0), 0);
  const contractTotal = servicesForCalc.reduce((s, svc) => s + (Number(svc.totalAmount) || 0), 0);
  const adjustedTotal = contractTotal + approvedCOs;
  const billed = servicesForCalc.reduce((s, svc) => s + (Number(svc.billedAmount) || 0), 0);
  // Derive cost from actual time entries (hours × hourly rate)
  const cost = timeEntries.reduce((s, te) => s + (Number(te.hours) || 0) * (Number(te.hourlyRate) || 0), 0);
  const margin = adjustedTotal > 0 ? Math.round((adjustedTotal - cost) / adjustedTotal * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" onClick={() => navigate("/projects")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-words">
                  {[project.project_number, project.properties?.address, project.name || project.proposals?.title].filter(Boolean).join(" — ") || "Untitled Project"}
                </h1>
                <div className="flex items-center gap-1.5 shrink-0 mt-1">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {(() => {
                    const tier = calculateComplexityTier(project.project_type, realServices.length);
                    return (
                      <Badge variant="outline" className={cn("border-none text-[10px] font-medium", tier.color)}>
                        {tier.label}
                      </Badge>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground flex-wrap">
                {(project as any).tenant_name && (
                  <span className="flex items-center gap-1 text-xs">Tenant: {(project as any).tenant_name}</span>
                )}
                {project.clients?.name && (
                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {project.clients.name}</span>
                )}
                {(() => {
                   // PIS owner (from hook) takes top priority, then DB-synced building_owner_name
                   const pisOwner = pisStatus?.pisOwnerName || (project as any).building_owner_name;
                   const clientOwner = (project as any).building_owner?.name;
                   const propertyOwner = project.properties?.owner_name;
                   const cleanPis = pisOwner && pisOwner !== "UNAVAILABLE OWNER" ? pisOwner : null;
                   const cleanProperty = propertyOwner && propertyOwner !== "UNAVAILABLE OWNER" ? propertyOwner : null;
                   const displayOwner = cleanPis || clientOwner || cleanProperty;
                   if (!displayOwner) return null;
                  // Check for mismatch between sources
                  const hasMismatch = pisOwner && (
                    (clientOwner && clientOwner !== pisOwner) ||
                    (propertyOwner && propertyOwner !== pisOwner && propertyOwner !== "UNAVAILABLE OWNER")
                  );
                  return (
                    <span className="flex items-center gap-1 text-xs">
                      Owner: {displayOwner}
                      {hasMismatch && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" title={`Property record: ${propertyOwner || "—"}, Client record: ${clientOwner || "—"}, PIS: ${pisOwner || "—"}`}>
                          ⚠ Owner mismatch
                        </span>
                      )}
                    </span>
                  );
                })()}
                {primaryContact && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {primaryContact.name}
                    {primaryContact.phone && <span className="text-xs hidden sm:inline">· {primaryContact.phone}</span>}
                  </span>
                )}
                {!primaryContact && contacts.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {contacts[0].name}
                    {contacts[0].phone && <span className="text-xs hidden sm:inline">· {contacts[0].phone}</span>}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> PM:&nbsp;
                  <Select
                    value={project.assigned_pm_id || "__unassigned__"}
                    onValueChange={handlePmChange}
                  >
                    <SelectTrigger className="h-6 w-auto min-w-[120px] border-none bg-transparent shadow-none text-sm p-0 px-1 hover:bg-muted/40 focus:ring-0 gap-1">
                      <SelectValue placeholder="Assign PM" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__">Unassigned</SelectItem>
                      {assignableProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-10 sm:ml-0 sm:justify-end">
            {projectTimer.isRunning && projectTimer.timer?.projectId === id ? (
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => projectTimer.stop()}>
                <Clock className="h-3.5 w-3.5" /> Stop Timer
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                const appId = dobApplications[0]?.id;
                projectTimer.start(id!, project.name || project.properties?.address || "Project", appId);
                toast({ title: "Timer started", description: `Tracking time for ${project.name || project.properties?.address || "this project"}` });
              }}>
                <Clock className="h-3.5 w-3.5" /> Start Timer
              </Button>
            )}
            <LitigationButton onClick={() => setLitigationDialogOpen(true)} />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditDialogOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Edit Project</span><span className="sm:hidden">Edit</span>
            </Button>
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Contract", value: servicesLoading ? "..." : formatCurrency(contractTotal) },
            { label: "Change Orders", value: approvedCOs > 0 ? `+${formatCurrency(approvedCOs)}` : "--" },
            { label: "Total Value", value: servicesLoading ? "..." : formatCurrency(adjustedTotal) },
            { label: "Billed", value: servicesLoading ? "..." : formatCurrency(billed), color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Remaining", value: servicesLoading ? "..." : formatCurrency(adjustedTotal - billed) },
            { label: "Internal Cost", value: formatCurrency(cost) },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{stat.label}</div>
                <div className={`text-xl font-bold mt-1 ${stat.color || ""}`}>{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Proposal Execution Status + Quick Reference + Readiness Checklist */}
        <ProposalExecutionBanner project={project} changeOrders={changeOrders} />
        {dobApplications.length > 0 && (
          <QuickReferenceBar
            applications={dobApplications}
            filingType={(project as any).filing_type}
            projectId={id!}
            projectName={project.name || project.proposals?.title || "Untitled"}
            ownerName={(project as any).building_owner_name}
            ownerEmail={primaryContact?.email}
          />
        )}
        <ReadinessChecklist
          items={dbChecklistItems}
          pisStatus={pisStatus}
          projectId={id!}
          projectName={project.name || project.proposals?.title || "Untitled"}
          propertyAddress={project.properties?.address || ""}
          ownerName={(project as any).building_owner_name || primaryContact?.name}
          contactEmail={primaryContact?.email}
          contacts={contacts}
        />

        {/* Main Tabbed Content */}
        <Card>
          <Tabs defaultValue="services" className="w-full">
            <div className="overflow-x-auto border-b bg-muted/20 rounded-t-lg scrollbar-hide">
            <TabsList className="w-max justify-start rounded-none bg-transparent h-11 px-2 sm:px-4 gap-0.5 sm:gap-1">
              <TabsTrigger value="services" className="gap-1.5 data-[state=active]:bg-background">
                <FileText className="h-3.5 w-3.5" /> Services ({realServices.length})
              </TabsTrigger>
              <TabsTrigger value="emails" className="gap-1.5 data-[state=active]:bg-background">
                <Mail className="h-3.5 w-3.5" /> Emails
              </TabsTrigger>
              <TabsTrigger value="contacts" className="gap-1.5 data-[state=active]:bg-background">
                <Users className="h-3.5 w-3.5" /> Contacts ({contacts.length})
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5 data-[state=active]:bg-background">
                <Clock className="h-3.5 w-3.5" /> Timeline ({milestones.length})
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-1.5 data-[state=active]:bg-background">
                <File className="h-3.5 w-3.5" /> Docs ({documents.length})
              </TabsTrigger>
              <TabsTrigger value="time-logs" className="gap-1.5 data-[state=active]:bg-background">
                <Clock className="h-3.5 w-3.5" /> Time ({timeEntries.length})
              </TabsTrigger>
              <TabsTrigger value="change-orders" className="gap-1.5 data-[state=active]:bg-background">
                <GitBranch className="h-3.5 w-3.5" /> COs ({changeOrders.length})
              </TabsTrigger>
              <TabsTrigger value="action-items" className="gap-1.5 data-[state=active]:bg-background">
                <ClipboardList className="h-3.5 w-3.5" /> Tasks
              </TabsTrigger>
              <TabsTrigger value="job-costing" className="gap-1.5 data-[state=active]:bg-background">
                <DollarSign className="h-3.5 w-3.5" /> Job Costing
              </TabsTrigger>
              <TabsTrigger value="research" className="gap-1.5 data-[state=active]:bg-background">
                <Search className="h-3.5 w-3.5" /> Research
              </TabsTrigger>
            </TabsList>
            </div>

            <CardContent className="p-0">
              <TabsContent value="services" className="mt-0">
                <ServicesFull services={realServices} project={project} contacts={contacts} allServices={realServices} timeEntries={timeEntries} onAddCOs={async (cos) => {
                  for (const co of cos) {
                    try {
                      await createCO.mutateAsync(co);
                    } catch { /* non-critical */ }
                  }
                }} />
              </TabsContent>
              <TabsContent value="emails" className="mt-0">
                <EmailsFullLive projectId={project.id} projectName={project.name} mockEmails={emails} />
              </TabsContent>
              <TabsContent value="contacts" className="mt-0">
                <ContactsFull contacts={contacts} pisStatus={pisStatus} projectId={project.id} clientId={project.client_id} />
              </TabsContent>
              <TabsContent value="timeline" className="mt-0">
                <TimelineFull milestones={milestones} projectId={project.id} />
              </TabsContent>
              <TabsContent value="documents" className="mt-0">
                <DocumentsFull documents={documents} projectId={project.id} companyId={project.company_id} proposal={project.proposals} />
              </TabsContent>
              <TabsContent value="time-logs" className="mt-0">
                <TimeLogsFull timeEntries={timeEntries} services={realServices} projectId={project.id} companyId={project.company_id} onCreateCO={() => setCoDialogOpen(true)} />
              </TabsContent>
              <TabsContent value="change-orders" className="mt-0">
                <ChangeOrdersFull
                  changeOrders={changeOrders}
                  projectId={project.id}
                  companyId={project.company_id}
                  serviceNames={realServices.map(s => s.name)}
                  onOpenCreate={() => setCoDialogOpen(true)}
                  onSelectCO={(co) => { setSelectedCOId(co.id); setCoSheetOpen(true); }}
                />
              </TabsContent>
              <TabsContent value="action-items" className="mt-0">
                <ActionItemsTab projectId={project.id} />
              </TabsContent>
              <TabsContent value="job-costing" className="mt-0">
                <JobCostingFull services={realServices} timeEntries={timeEntries} />
              </TabsContent>
              <TabsContent value="research" className="mt-0">
                <ResearchTabContainer
                  projectId={project.id}
                  projectAddress={project.properties?.address}
                  architectEmail={contacts.find(c => c.dobRole === "architect")?.email}
                  filingType={(project as any).filing_type}
                  scopeOfWork={project.notes}
                />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      <ProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSubmit={async (data) => {
          try {
            await updateProject.mutateAsync({ id: project.id, ...data });
            toast({ title: "Project updated", description: "Changes saved." });
            setEditDialogOpen(false);
          } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
          }
        }}
        project={project}
        isLoading={updateProject.isPending}
      />
      <LitigationExportDialog
        open={litigationDialogOpen}
        onOpenChange={setLitigationDialogOpen}
        project={project}
        milestones={milestones}
        emails={emails}
        documents={documents}
        timeEntries={timeEntries}
        changeOrders={changeOrders}
        contacts={contacts}
        services={realServices}
      />

      <ChangeOrderDialog
        open={coDialogOpen}
        onOpenChange={setCoDialogOpen}
        serviceNames={realServices.map(s => s.name)}
        onSubmit={async (data, asDraft) => {
          const newCO = await createCO.mutateAsync({
            ...data,
            project_id: project.id,
            company_id: project.company_id,
            status: asDraft ? "draft" : "pending_internal",
          });
          setCoDialogOpen(false);
          if (!asDraft && newCO) {
            // Open the detail sheet with auto-sign flow
            setSelectedCOId(newCO.id);
            setCoAutoSign(true);
            // Wait for query to refetch so selectedCO resolves
            await queryClient.refetchQueries({ queryKey: ["change-orders", project.id] });
            // Small delay to ensure React re-renders with new data
            await new Promise(resolve => setTimeout(resolve, 100));
            setCoSheetOpen(true);
          }
        }}
        isLoading={createCO.isPending}
      />

      <ChangeOrderDetailSheet
        open={coSheetOpen}
        onOpenChange={(v) => { setCoSheetOpen(v); if (!v) setCoAutoSign(false); }}
        co={selectedCO}
        serviceNames={realServices.map(s => s.name)}
        autoSign={coAutoSign}
        onAutoSignComplete={() => setCoAutoSign(false)}
      />
    </AppLayout>
  );
}


// ProposalExecutionBanner moved to src/components/projects/tabs/ProposalExecutionBanner.tsx

// Extracted: ReadinessChecklist, ServicesFull, TimeLogsFull
