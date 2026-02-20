import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSensors, useSensor, PointerSensor } from "@dnd-kit/core";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useProjectChecklist, useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem, type ChecklistItem } from "@/hooks/useProjectChecklist";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useChecklistFollowupDrafts, useApproveDraft, useDismissDraft } from "@/hooks/useChecklistFollowupDrafts";
import { Input } from "@/components/ui/input";
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
  GripVertical, ArrowUp, ArrowDown,
} from "lucide-react";
import { useProjects, useUpdateProject, ProjectWithRelations } from "@/hooks/useProjects";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { useAssignableProfiles, useCompanyProfiles } from "@/hooks/useProfiles";
import { ProjectEmailsTab } from "@/components/emails/ProjectEmailsTab";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { LitigationExportDialog } from "@/components/projects/LitigationExportDialog";
import { DobNowFilingPrepSheet } from "@/components/projects/DobNowFilingPrepSheet";
import { EditPISDialog } from "@/components/projects/EditPISDialog";
import { useToast } from "@/hooks/use-toast";
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
  MockService, MockContact, MockMilestone, MockChangeOrder,
  MockEmail, MockDocument, MockTimeEntry, MockChecklistItem, MockPISStatus, MockProposalSignature,
} from "@/components/projects/projectMockData";
import {
  useProjectServices, useProjectContacts, useProjectTimeline, useProjectPISStatus, useProjectDocuments,
} from "@/hooks/useProjectDetail";
import { QuickReferenceBar } from "@/components/projects/QuickReferenceBar";
import { useChangeOrders, useCreateChangeOrder } from "@/hooks/useChangeOrders";
import { ChangeOrderDialog } from "@/components/projects/ChangeOrderDialog";
import { ChangeOrderDetailSheet } from "@/components/projects/ChangeOrderDetailSheet";
import type { ChangeOrder } from "@/hooks/useChangeOrders";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", variant: "default" },
  on_hold: { label: "On Hold", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
  paid: { label: "Paid", variant: "default" },
};

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
  const { data: projects = [], isLoading } = useProjects();
  const { data: assignableProfiles = [] } = useAssignableProfiles();
  const updateProject = useUpdateProject();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [litigationDialogOpen, setLitigationDialogOpen] = useState(false);
  const [coDialogOpen, setCoDialogOpen] = useState(false);
  const [selectedCO, setSelectedCO] = useState<ChangeOrder | null>(null);
  const [coSheetOpen, setCoSheetOpen] = useState(false);

  const project = projects.find((p) => p.id === id);

  // Real data hooks
  const { data: realServices = [] } = useProjectServices(project?.id);
  const { data: realContacts = [] } = useProjectContacts(project?.id, project?.client_id, (project as any)?.proposal_id);
  const { data: realTimeline = [] } = useProjectTimeline(project?.id, (project as any)?.proposal_id);
  const { data: realPISStatus } = useProjectPISStatus(project?.id);
  const { data: realDocuments = [] } = useProjectDocuments(project?.id);

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

  const [liveServices, setLiveServices] = useState<MockService[]>([]);
  const [servicesInitialized, setServicesInitialized] = useState<string | null>(null);

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

  // Sync live services from real DB data (include data hash to catch field changes like needs_dob_filing)
  const realServicesKey = realServices.map(s => `${s.id}:${s.needsDobFiling ? 1 : 0}:${s.status}`).join(",");
  if (project && realServices.length > 0 && servicesInitialized !== `${project.id}:${realServicesKey}`) {
    setLiveServices(realServices);
    setServicesInitialized(`${project.id}:${realServicesKey}`);
  }

  // Real change orders
  const { data: realChangeOrders = [] } = useChangeOrders(project?.id);

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
  const timeEntries: MockTimeEntry[] = [];
  const pisStatus: MockPISStatus = realPISStatus || { sentDate: null, totalFields: 0, completedFields: 0, missingFields: [] };

  const createCO = useCreateChangeOrder();
  const approvedCOs = changeOrders.filter(co => co.status === "approved").reduce((s, co) => s + Number(co.amount), 0);
  const contractTotal = liveServices.reduce((s, svc) => s + svc.totalAmount, 0);
  const adjustedTotal = contractTotal + approvedCOs;
  const billed = liveServices.reduce((s, svc) => s + svc.billedAmount, 0);
  const cost = liveServices.reduce((s, svc) => s + svc.costAmount, 0);
  const margin = adjustedTotal > 0 ? Math.round((adjustedTotal - cost) / adjustedTotal * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" className="mt-1 shrink-0" onClick={() => navigate("/projects")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">
                  {project.name || project.proposals?.title || "Untitled Project"}
                </h1>
                <Badge variant={status.variant} className="shrink-0">{status.label}</Badge>
              </div>
              {/* Phase Stepper */}
              <div className="flex items-center gap-1 mt-2">
                {(["pre_filing", "filing", "approval", "closeout"] as const).map((phase, idx) => {
                  const labels: Record<string, string> = { pre_filing: "Pre-Filing", filing: "Filing", approval: "Approval", closeout: "Closeout" };
                  const currentPhase = (project as any).phase || "pre_filing";
                  const phaseOrder = ["pre_filing", "filing", "approval", "closeout"];
                  const currentIdx = phaseOrder.indexOf(currentPhase);
                  const isActive = phase === currentPhase;
                  const isPast = idx < currentIdx;
                  return (
                    <div key={phase} className="flex items-center gap-1">
                      {idx > 0 && <div className={`w-6 h-0.5 ${isPast ? "bg-primary" : "bg-border"}`} />}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const { error } = await supabase.from("projects").update({ phase } as any).eq("id", project.id);
                          if (!error) {
                            queryClient.invalidateQueries({ queryKey: ["projects"] });
                            toast({ title: "Phase updated", description: `Set to ${labels[phase]}` });
                          }
                        }}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                          isActive ? "bg-primary text-primary-foreground border-primary font-semibold" :
                          isPast ? "bg-primary/10 text-primary border-primary/30" :
                          "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                        }`}
                      >
                        {labels[phase]}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                {project.project_number && <span className="font-mono">{project.project_number}</span>}
               {project.properties?.address && (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {project.properties.address}</span>
                )}
                {((project as any).floor_number || (project as any).unit_number) && (
                  <span className="flex items-center gap-1 text-xs">
                    {(project as any).floor_number && <>Floor {(project as any).floor_number}</>}
                    {(project as any).floor_number && (project as any).unit_number && <> · </>}
                    {(project as any).unit_number && <>Unit {(project as any).unit_number}</>}
                  </span>
                )}
                {(project as any).tenant_name && (
                  <span className="flex items-center gap-1 text-xs">Tenant: {(project as any).tenant_name}</span>
                )}
                {project.clients?.name && (
                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {project.clients.name}</span>
                )}
                {((project as any).building_owner?.name || (project as any).building_owner_name) && (
                  <span className="flex items-center gap-1 text-xs">
                    Owner: {(project as any).building_owner?.name || (project as any).building_owner_name}
                  </span>
                )}
                {primaryContact && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {primaryContact.name}
                    {primaryContact.phone && <span className="text-xs">· {primaryContact.phone}</span>}
                  </span>
                )}
                {!primaryContact && contacts.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {contacts[0].name}
                    {contacts[0].phone && <span className="text-xs">· {contacts[0].phone}</span>}
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
          <div className="flex items-center gap-2 shrink-0">
            <LitigationButton onClick={() => setLitigationDialogOpen(true)} />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditDialogOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit Project
            </Button>
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "Contract", value: formatCurrency(contractTotal) },
            { label: "Change Orders", value: approvedCOs > 0 ? `+${formatCurrency(approvedCOs)}` : "—" },
            { label: "Total Value", value: formatCurrency(adjustedTotal) },
            { label: "Billed", value: formatCurrency(billed), color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Internal Cost", value: formatCurrency(cost) },
            { label: "Margin", value: `${margin}%`, color: margin > 50 ? "text-emerald-600 dark:text-emerald-400" : margin < 20 ? "text-red-600 dark:text-red-400" : "" },
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
        />

        {/* Main Tabbed Content */}
        <Card>
          <Tabs defaultValue="services" className="w-full">
            <TabsList className="w-full justify-start rounded-none rounded-t-lg border-b bg-muted/20 h-11 px-4 flex-wrap gap-1">
              <TabsTrigger value="services" className="gap-1.5 data-[state=active]:bg-background">
                <FileText className="h-3.5 w-3.5" /> Services ({liveServices.length})
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
              <TabsTrigger value="job-costing" className="gap-1.5 data-[state=active]:bg-background">
                <DollarSign className="h-3.5 w-3.5" /> Job Costing
              </TabsTrigger>
            </TabsList>

            <CardContent className="p-0">
              <TabsContent value="services" className="mt-0">
                <ServicesFull services={liveServices} project={project} contacts={contacts} allServices={liveServices} onServicesChange={setLiveServices} onAddCOs={async (cos) => {
                  for (const co of cos) {
                    try {
                      await createCO.mutateAsync({ ...co, project_id: project.id, company_id: project.company_id, status: "voided" });
                    } catch { /* non-critical */ }
                  }
                }} />
              </TabsContent>
              <TabsContent value="emails" className="mt-0">
                <EmailsFullLive projectId={project.id} mockEmails={emails} />
              </TabsContent>
              <TabsContent value="contacts" className="mt-0">
                <ContactsFull contacts={contacts} pisStatus={pisStatus} />
              </TabsContent>
              <TabsContent value="timeline" className="mt-0">
                <TimelineFull milestones={milestones} />
              </TabsContent>
              <TabsContent value="documents" className="mt-0">
                <DocumentsFull documents={documents} />
              </TabsContent>
              <TabsContent value="time-logs" className="mt-0">
                <TimeLogsFull timeEntries={timeEntries} services={liveServices} />
              </TabsContent>
              <TabsContent value="change-orders" className="mt-0">
                <ChangeOrdersFull
                  changeOrders={changeOrders}
                  projectId={project.id}
                  companyId={project.company_id}
                  serviceNames={liveServices.map(s => s.name)}
                  onOpenCreate={() => setCoDialogOpen(true)}
                  onSelectCO={(co) => { setSelectedCO(co); setCoSheetOpen(true); }}
                />
              </TabsContent>
              <TabsContent value="job-costing" className="mt-0">
                <JobCostingFull services={liveServices} timeEntries={timeEntries} />
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
        services={liveServices}
      />
    </AppLayout>
  );
}

// ======== PROPOSAL EXECUTION BANNER ========

function ProposalExecutionBanner({ project, changeOrders }: { project: ProjectWithRelations; changeOrders: MockChangeOrder[] }) {
  const unsignedCOs = changeOrders.filter(co => (!co.internalSigned || !co.clientSigned) && co.status !== "draft");
  const proposal = project.proposals;

  if (!proposal) return null;

  const proposalNumber = proposal.proposal_number || "—";
  const internalDate = proposal.internal_signed_at
    ? format(new Date(proposal.internal_signed_at), "MM/dd/yyyy")
    : null;
  const clientDate = (proposal as any).client_signed_at
    ? format(new Date((proposal as any).client_signed_at), "MM/dd/yyyy")
    : null;
  const fullyExecuted = !!internalDate && !!clientDate;

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
              Internal: {internalDate} · Client: {clientDate}
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-700 dark:text-amber-300 font-medium">Proposal #{proposalNumber} — Awaiting Client Signature</span>
            {internalDate && (
              <span className="text-xs text-muted-foreground">Internal signed: {internalDate}</span>
            )}
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 ml-auto">
              <Send className="h-3 w-3" /> Resend for Signature
            </Button>
          </>
        )}
      </div>

      {unsignedCOs.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-sm">
          <PenLine className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-700 dark:text-amber-300">
            {unsignedCOs.length} CO{unsignedCOs.length > 1 ? "s" : ""} awaiting signature: {unsignedCOs.map(co => co.number).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

// ======== READINESS CHECKLIST ========

function ReadinessChecklist({ items, pisStatus, projectId, projectName, propertyAddress, ownerName, contactEmail }: {
  items: ChecklistItem[]; pisStatus: MockPISStatus; projectId: string;
  projectName?: string; propertyAddress?: string; ownerName?: string; contactEmail?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showReceived, setShowReceived] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditPIS, setShowEditPIS] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newFrom, setNewFrom] = useState("");
  const [newCategory, setNewCategory] = useState("missing_document");
  const [aiDraft, setAiDraft] = useState<{ draft: string; prompt: { system: string; user: string }; model: string } | null>(null);
  const [showAiDraft, setShowAiDraft] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const { toast } = useToast();
  const addItem = useAddChecklistItem();
  const updateItem = useUpdateChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const { data: companyData } = useCompanySettings();
  const { data: pendingDrafts = [] } = useChecklistFollowupDrafts(projectId);
  const approveDraft = useApproveDraft();
  const dismissDraft = useDismissDraft();

  const getDaysWaiting = (requestedDate: string | null) => {
    if (!requestedDate) return 0;
    const diff = Date.now() - new Date(requestedDate).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  const outstanding = items.filter(i => i.status === "open");
  const completed = items.filter(i => i.status === "done" || i.status === "dismissed");
  const grouped = Object.entries(checklistCategoryLabels).map(([key, { label, icon }]) => ({
    key, label, icon,
    items: outstanding.filter(i => i.category === key),
  })).filter(g => g.items.length > 0);

  const pisComplete = pisStatus.completedFields === pisStatus.totalFields;

  const handleMarkDone = (id: string) => {
    updateItem.mutate({ id, projectId, status: "done" });
    toast({ title: "Received ✓", description: "Item moved to received list." });
  };

  const handleRemoveItem = (id: string) => {
    deleteItem.mutate({ id, projectId });
    toast({ title: "Removed", description: "Item removed from checklist." });
  };

  const handleAddItem = () => {
    if (!newLabel.trim()) return;
    addItem.mutate({
      project_id: projectId,
      label: newLabel,
      category: newCategory,
      from_whom: newFrom || undefined,
    });
    toast({ title: "Item added", description: newLabel });
    setNewLabel(""); setNewFrom(""); setShowAddForm(false);
  };

  const handleAiFollowUp = async () => {
    if (outstanding.length === 0) {
      toast({ title: "No outstanding items", description: "All checklist items are complete." });
      return;
    }
    setAiLoading(true);
    try {
      const itemsPayload = outstanding.map(item => ({
        label: item.label,
        from_whom: item.from_whom,
        category: item.category,
        daysWaiting: getDaysWaiting(item.requested_date),
      }));

      const completedPayload = completed
        .filter(i => i.status === "done")
        .map(item => ({
          label: item.label,
          category: item.category,
          completedAt: item.completed_at ? new Date(item.completed_at).toLocaleDateString("en-US") : "recently",
        }));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/draft-checklist-followup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            items: itemsPayload,
            completedItems: completedPayload,
            projectName,
            propertyAddress,
            ownerName,
            contactEmail,
            firmName: companyData?.name || undefined,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        toast({ title: "AI Error", description: err.error || `Status ${resp.status}`, variant: "destructive" });
        return;
      }

      const data = await resp.json();
      setAiDraft(data);
      setShowAiDraft(true);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to generate draft", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={(() => {
        const pisMissing = pisStatus.totalFields - pisStatus.completedFields;
        const totalIssues = outstanding.length + pisMissing;
        if (totalIssues === 0) return "border-l-4 border-l-green-500 bg-green-500/5";
        if (totalIssues > 10 || outstanding.length > 3) return "border-l-4 border-l-red-500 bg-red-500/5";
        return "border-l-4 border-l-amber-500 bg-amber-500/5";
      })()}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">
                  Project Readiness
                  {(() => {
                    const pisMissing = pisStatus.totalFields - pisStatus.completedFields;
                    const totalIssues = outstanding.length + pisMissing;
                    if (totalIssues === 0) return (
                      <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        All clear
                      </Badge>
                    );
                    return (
                      <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        {totalIssues} outstanding
                      </Badge>
                    );
                  })()}
                </CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm" onClick={(e) => {
                  if (!pisComplete) {
                    e.stopPropagation();
                    setIsOpen(true);
                  }
                }}>
                  <span className="text-muted-foreground">PIS:</span>
                  {pisComplete ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800 cursor-pointer hover:opacity-80">
                      {pisStatus.completedFields}/{pisStatus.totalFields} fields
                    </Badge>
                  )}
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
            {!isOpen && pisStatus.totalFields > 0 && (
              <div className="mt-3">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pisComplete ? "bg-green-500" : pisStatus.completedFields / pisStatus.totalFields >= 0.5 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${(pisStatus.completedFields / pisStatus.totalFields) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pisStatus.completedFields}/{pisStatus.totalFields} PIS fields complete
                  {outstanding.length > 0 && ` · ${outstanding.length} checklist items open`}
                </p>
              </div>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {pisStatus.sentDate ? (
              !pisComplete && (
                <div className="flex items-center gap-4 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">Project Information Sheet</span>
                      <span className="text-muted-foreground text-xs">Sent {pisStatus.sentDate}</span>
                    </div>
                    <Progress value={(pisStatus.completedFields / pisStatus.totalFields) * 100} className="h-2" />
                    <div className="text-xs text-muted-foreground mt-1">
                      Missing: {pisStatus.missingFields.join(", ")}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setShowEditPIS(true)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit PIS
                  </Button>
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
                    <Send className="h-3.5 w-3.5" /> Send Reminder
                  </Button>
                </div>
              )
            ) : (
              <div className="flex items-center gap-4 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/30">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">No Project Information Sheet sent yet</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Sending a PIS will auto-populate contacts, services, and project details from the client.
                  </div>
                </div>
                <Button size="sm" className="shrink-0 gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Send PIS
                </Button>
              </div>
            )}

            {/* Auto-generated follow-up drafts banner */}
            {pendingDrafts.length > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    {pendingDrafts.length} auto-generated follow-up{pendingDrafts.length > 1 ? "s" : ""} ready for review
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                  onClick={() => {
                    const draft = pendingDrafts[0];
                    setAiDraft({
                      draft: draft.draft_body,
                      prompt: { system: draft.prompt_system || "", user: draft.prompt_user || "" },
                      model: "auto-generated",
                    });
                    setShowAiDraft(true);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" /> Review
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1.5 text-muted-foreground"
                  onClick={() => {
                    approveDraft.mutate(pendingDrafts[0].id);
                    toast({ title: "Approved", description: "Follow-up draft approved." });
                  }}
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1.5 text-muted-foreground"
                  onClick={() => {
                    dismissDraft.mutate(pendingDrafts[0].id);
                    toast({ title: "Dismissed", description: "Follow-up draft dismissed." });
                  }}
                >
                  <XCircle className="h-3.5 w-3.5" /> Dismiss
                </Button>
              </div>
            )}

            {grouped.map(({ key, label, icon, items: groupItems }) => (
              <div key={key}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {icon} {label} ({groupItems.length})
                </h4>
                <div className="space-y-1.5">
                  {groupItems.map((item) => {
                    const daysWaiting = getDaysWaiting(item.requested_date);
                    return (
                      <div key={item.id} className="flex items-center gap-3 text-sm py-2 px-3 rounded-md bg-background border group/item">
                        <Checkbox className="h-4 w-4" onCheckedChange={() => handleMarkDone(item.id)} />
                        <span className="flex-1 min-w-0">{item.label}</span>
                        {item.from_whom && <span className="text-xs text-muted-foreground shrink-0">from {item.from_whom}</span>}
                        <Badge variant={daysWaiting > 7 ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                          {daysWaiting}d
                        </Badge>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.category === "missing_document" && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground" onClick={() => toast({ title: "Request Sent", description: `Requested "${item.label}" from ${item.from_whom}` })}>
                              <Mail className="h-3 w-3" /> Request
                            </Button>
                          )}
                          {item.category === "missing_info" && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground" onClick={() => toast({ title: "Email Draft", description: `Drafting email to request "${item.label}"` })}>
                              <Mail className="h-3 w-3" /> Email
                            </Button>
                          )}
                          {item.category === "pending_signature" && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground" onClick={() => toast({ title: "Reminder Sent", description: `Signature reminder sent for "${item.label}"` })}>
                              <Send className="h-3 w-3" /> Remind
                            </Button>
                          )}
                          {item.category === "pending_response" && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground" onClick={() => toast({ title: "Follow-up Sent", description: `Follow-up sent for "${item.label}"` })}>
                              <Phone className="h-3 w-3" /> Follow Up
                            </Button>
                          )}
                          {item.category === "ai_follow_up" && (
                            <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                              <Sparkles className="h-2.5 w-2.5" /> AI
                            </Badge>
                          )}
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(item.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {completed.length > 0 && (
              <Collapsible open={showReceived} onOpenChange={setShowReceived}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground h-7 px-2">
                    {showReceived ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    ✅ Received ({completed.length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1">
                  <div className="space-y-1">
                    {completed.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 text-sm py-1.5 px-3 rounded-md text-muted-foreground">
                        <Checkbox checked className="h-4 w-4" />
                        <span className="line-through">{item.label}</span>
                        {item.from_whom && <span className="text-xs ml-auto">from {item.from_whom}</span>}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {showAddForm ? (
              <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input placeholder="What's needed?" className="h-8 text-sm" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} autoFocus />
                  <Input placeholder="From whom?" className="h-8 text-sm" value={newFrom} onChange={(e) => setNewFrom(e.target.value)} />
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(checklistCategoryLabels).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={handleAddItem} disabled={addItem.isPending}>Add</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setNewLabel(""); setNewFrom(""); setShowAddForm(false); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddForm(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Extract from Emails
                </Button>
                {outstanding.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                    onClick={handleAiFollowUp}
                    disabled={aiLoading}
                  >
                    {aiLoading ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting...</>
                    ) : (
                      <><Sparkles className="h-3.5 w-3.5" /> AI Follow-Up Draft</>
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
    <EditPISDialog open={showEditPIS} onOpenChange={setShowEditPIS} pisStatus={pisStatus} projectId={projectId} />

    {/* AI Draft Dialog */}
    <Dialog open={showAiDraft} onOpenChange={setShowAiDraft}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Follow-Up Draft
          </DialogTitle>
        </DialogHeader>

        {aiDraft && (
          <div className="space-y-4">
            {/* Draft content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Generated Email Draft</span>
                <Badge variant="outline" className="text-[10px]">
                  {aiDraft.model} · {(aiDraft as any).itemCount} items
                </Badge>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{aiDraft.draft}</pre>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5" onClick={() => {
                  navigator.clipboard.writeText(aiDraft.draft);
                  toast({ title: "Copied", description: "Draft copied to clipboard." });
                }}>
                  <FileText className="h-3.5 w-3.5" /> Copy Draft
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  toast({ title: "Opening Composer", description: "Draft will be loaded into email composer." });
                  setShowAiDraft(false);
                }}>
                  <Mail className="h-3.5 w-3.5" /> Open in Composer
                </Button>
              </div>
            </div>

            <Separator />

            {/* Prompt transparency */}
            <Collapsible open={showPrompt} onOpenChange={setShowPrompt}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground w-full justify-start h-8">
                  {showPrompt ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <Eye className="h-3 w-3" />
                  View Prompt Used
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Prompt</span>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground leading-relaxed">{aiDraft.prompt.system}</pre>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User Prompt</span>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground leading-relaxed">{aiDraft.prompt.user}</pre>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
// ======== SERVICES ========

function ServiceExpandedDetail({ service }: { service: MockService }) {
  const [showAddReq, setShowAddReq] = useState(false);
  const [newReqLabel, setNewReqLabel] = useState("");
  const [newReqFrom, setNewReqFrom] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [localTasks, setLocalTasks] = useState(service.tasks);
  const [localReqs, setLocalReqs] = useState(service.requirements);
  const [localCosts, setLocalCosts] = useState<{ discipline: string; amount: number; editing?: string }[]>(
    (service.estimatedCosts || []).map(ec => ({ ...ec }))
  );
  const { toast } = useToast();

  const COMMON_TASKS = [
    "Go to DOB for plan exam",
    "Go to TOPO for survey",
    "Request records from FOIL",
    "Schedule DOB inspection",
    "Follow up with architect",
    "Follow up with engineer",
    "Pick up permit from DOB",
    "Submit application on DOB NOW",
  ];

  const addTask = () => {
    if (!newTaskText.trim()) return;
    const task = { id: `t-new-${Date.now()}`, text: newTaskText, done: false, assignedTo: newTaskAssignee || undefined, dueDate: newTaskDue || undefined };
    setLocalTasks(prev => [...prev, task]);
    toast({ title: "Task added", description: newTaskText });
    setNewTaskText(""); setNewTaskAssignee(""); setNewTaskDue(""); setShowAddTask(false);
  };

  const addReq = () => {
    if (!newReqLabel.trim()) return;
    const req = { id: `r-new-${Date.now()}`, label: newReqLabel, met: false, fromWhom: newReqFrom || undefined };
    setLocalReqs(prev => [...prev, req]);
    toast({ title: "Requirement added", description: newReqLabel });
    setNewReqLabel(""); setNewReqFrom(""); setShowAddReq(false);
  };

  return (
    <div className="px-8 py-5 space-y-5 bg-muted/10">
      {/* Row 1: Scope + Job Description + Application */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Scope of Work
          </h4>
          <p className="text-sm leading-relaxed whitespace-pre-line">{service.scopeOfWork || "No scope defined."}</p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Job Description (DOB)
          </h4>
          {service.jobDescription ? (
            <p className="text-sm leading-relaxed whitespace-pre-line">{service.jobDescription}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No job description — required for DOB filing.</p>
          )}
        </div>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Application
          </h4>
          {service.application ? (
            <div className="space-y-1 text-sm">
              <div>Job #: <span className="font-mono font-medium">{service.application.jobNumber}</span></div>
              <div>Type: <span className="font-medium">{service.application.type}</span></div>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1">
                <ExternalLink className="h-3 w-3" /> View on DOB NOW
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No application linked</p>
          )}
        </div>
      </div>

      {/* Row 2: Two-column — Estimated Costs by discipline (left) + Requirements (right) */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        {/* Estimated Costs — editable */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Estimated Job Cost
          </h4>
          {localCosts.length > 0 ? (
            <div className="space-y-1">
              {localCosts.map((ec, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 px-3 rounded-md border bg-background gap-2">
                  <span className="truncate flex-1">{ec.discipline}</span>
                  <Input
                    type="text"
                    className="h-7 w-[110px] text-right text-sm font-semibold tabular-nums"
                    value={ec.editing ?? `$${ec.amount.toLocaleString()}`}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setLocalCosts(prev => prev.map((c, j) => j === i ? { ...c, editing: raw } : c));
                    }}
                    onBlur={() => {
                      const parsed = parseInt(localCosts[i].editing?.replace(/[^0-9]/g, "") || "0", 10);
                      setLocalCosts(prev => prev.map((c, j) => j === i ? { discipline: c.discipline, amount: parsed } : c));
                      toast({ title: "Cost updated", description: `${ec.discipline}: $${parsed.toLocaleString()}` });
                    }}
                    onFocus={() => {
                      setLocalCosts(prev => prev.map((c, j) => j === i ? { ...c, editing: c.amount.toString() } : c));
                    }}
                  />
                </div>
              ))}
              <div className="flex items-center justify-between text-sm py-1 px-3 font-semibold border-t mt-1 pt-2">
                <span>Total</span>
                <span className="tabular-nums">${localCosts.reduce((s, ec) => s + ec.amount, 0).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No cost estimates — complete PIS to populate.</p>
          )}
        </div>

        {/* Requirements */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Requirements ({localReqs.filter(r => !r.met).length} pending)
          </h4>
          {localReqs.length > 0 && (
            <div className="space-y-1 mb-2">
              {localReqs.map((req) => (
                <div key={req.id} className={`flex items-center gap-2 text-sm py-1.5 px-3 rounded-md border ${req.met ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-800/30" : "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30"}`}>
                  <Checkbox checked={req.met} className="h-3.5 w-3.5" onCheckedChange={() => {
                    setLocalReqs(prev => prev.map(r => r.id === req.id ? { ...r, met: !r.met } : r));
                  }} />
                  <span className={`flex-1 ${req.met ? "text-muted-foreground line-through" : ""}`}>{req.label}</span>
                  <div className="flex flex-col items-end gap-0.5 shrink-0 ml-auto">
                    {req.fromWhom && <span className="text-[10px] text-muted-foreground">from {req.fromWhom}</span>}
                    {req.detail && <span className="text-[10px] text-muted-foreground italic">— {req.detail}</span>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setLocalReqs(prev => prev.filter(r => r.id !== req.id))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {showAddReq ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Input placeholder="New requirement..." className="h-8 text-sm flex-1 max-w-xs" value={newReqLabel} onChange={(e) => setNewReqLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addReq(); }} autoFocus />
              <Input placeholder="From whom?" className="h-8 text-sm w-[180px]" value={newReqFrom} onChange={(e) => setNewReqFrom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addReq(); }} />
              <Button size="sm" className="h-8 text-xs" onClick={addReq}>Add</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setNewReqLabel(""); setNewReqFrom(""); setShowAddReq(false); }}>Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setShowAddReq(true)}>
              <Plus className="h-3 w-3" /> Add Requirement
            </Button>
          )}
        </div>
      </div>

      {/* Tasks */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> Tasks ({localTasks.length})
        </h4>
        {localTasks.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {localTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 text-sm py-1.5 px-3 rounded-md bg-background border">
                <Checkbox checked={task.done} className="h-4 w-4" onCheckedChange={() => {
                  setLocalTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t));
                }} />
                <span className={task.done ? "line-through text-muted-foreground flex-1" : "flex-1"}>{task.text}</span>
                <div className="flex items-center gap-2 ml-auto shrink-0">
                  {task.assignedTo && <Badge variant="outline" className="text-xs">{task.assignedTo}</Badge>}
                  {task.dueDate && <span className="text-xs text-muted-foreground">Due {task.dueDate}</span>}
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setLocalTasks(prev => prev.filter(t => t.id !== task.id))}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {showAddTask ? (
          <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold w-full">Quick add:</span>
              {COMMON_TASKS.map((ct) => (
                <Button key={ct} variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => setNewTaskText(ct)}>
                  {ct}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input placeholder="Task description..." className="h-8 text-sm" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTask(); }} autoFocus />
              <Input placeholder="Assigned to..." className="h-8 text-sm" value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)} />
              <Input type="text" placeholder="Due date (MM/DD/YYYY)" className="h-8 text-sm" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={addTask}>Add Task</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setNewTaskText(""); setNewTaskAssignee(""); setNewTaskDue(""); setShowAddTask(false); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddTask(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Task
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email about this
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableServiceRowWrapper({ id, disabled, children }: { id: string; disabled: boolean; children: (attributes: Record<string, any>, listeners: Record<string, any> | undefined, ref: (node: HTMLElement | null) => void, style: React.CSSProperties) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return <>{children(attributes, disabled ? undefined : listeners, setNodeRef, style)}</>;
}

function ServicesFull({ services: initialServices, project, contacts, allServices, onServicesChange, onAddCOs }: { services: MockService[]; project: ProjectWithRelations; contacts: MockContact[]; allServices: MockService[]; onServicesChange?: (services: MockService[]) => void; onAddCOs?: (cos: MockChangeOrder[]) => void }) {
  const [orderedServices, setOrderedServicesLocal] = useState(initialServices);
  const initialKey = initialServices.map(s => `${s.id}:${s.needsDobFiling ? 1 : 0}:${s.status}`).join(",");
  const [lastKey, setLastKey] = useState(initialKey);
  if (initialKey !== lastKey) {
    setOrderedServicesLocal(initialServices);
    setLastKey(initialKey);
  }
  const setOrderedServices = (updater: MockService[] | ((prev: MockService[]) => MockService[])) => {
    setOrderedServicesLocal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      onServicesChange?.(next);
      return next;
    });
  };
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingBillDate, setEditingBillDate] = useState<string | null>(null);
  const [dobPrepService, setDobPrepService] = useState<MockService | null>(null);
  const { data: companyProfiles = [] } = useCompanyProfiles();
  const { toast } = useToast();

  const updateServiceField = (id: string, field: "assignedTo" | "estimatedBillDate", value: string) => {
    setOrderedServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    toast({ title: "Updated", description: `Service ${field === "assignedTo" ? "assignment" : "bill date"} updated.` });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const topLevel = orderedServices.filter(s => !s.parentServiceId);
    const oldIndex = topLevel.findIndex(s => s.id === active.id);
    const newIndex = topLevel.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(topLevel, oldIndex, newIndex);
    const childMap = new Map<string, MockService[]>();
    orderedServices.forEach(s => {
      if (s.parentServiceId) {
        const arr = childMap.get(s.parentServiceId) || [];
        arr.push(s);
        childMap.set(s.parentServiceId, arr);
      }
    });
    const result: MockService[] = [];
    reordered.forEach(p => {
      result.push(p);
      (childMap.get(p.id) || []).forEach(c => result.push(c));
    });
    setOrderedServices(result);
  };

  const topLevelIds = orderedServices.filter(s => !s.parentServiceId).map(s => s.id);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleSendToBilling = () => {
    const today = format(new Date(), "MM/dd/yyyy");
    setOrderedServices(prev => prev.map(s => {
      if (!selectedIds.has(s.id)) return s;
      return { ...s, status: "billed" as const, billedAmount: s.totalAmount, billedAt: today };
    }));
    toast({ title: "Sent to Billing", description: `${selectedIds.size} service(s) marked as billed.` });
    setSelectedIds(new Set());
  };

  const handleDropService = () => {
    const today = format(new Date(), "MM/dd/yyyy");
    const newCOs: MockChangeOrder[] = [];
    setOrderedServices(prev => prev.map(s => {
      if (!selectedIds.has(s.id) || s.status === "dropped") return s;
      const coNum = `CO-DROP-${s.id}`;
      newCOs.push({
        id: `co-drop-${s.id}`,
        number: coNum,
        description: `Dropped service: ${s.name}`,
        amount: -s.totalAmount,
        status: "approved",
        createdDate: today,
        approvedDate: today,
        linkedServices: [s.id],
        reason: `Service "${s.name}" was dropped from scope`,
        requestedBy: "Internal",
        internalSigned: true,
        internalSignedDate: today,
        internalSigner: "System",
        clientSigned: false,
      });
      return { ...s, status: "dropped" as const };
    }));
    if (newCOs.length > 0) {
      onAddCOs?.(newCOs);
    }
    toast({
      title: "Service(s) Dropped",
      description: `${selectedIds.size} service(s) dropped. Negative change order(s) created automatically.`,
    });
    setSelectedIds(new Set());
  };

  const services = orderedServices;

  const toggle = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const total = services.reduce((s, svc) => s + svc.totalAmount, 0);
  const billed = services.reduce((s, svc) => s + svc.billedAmount, 0);
  const cost = services.reduce((s, svc) => s + svc.costAmount, 0);

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-6 py-3 bg-muted/40 border-b flex-wrap">
          <span className="text-sm text-muted-foreground font-medium">{selectedIds.size} selected:</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSendToBilling}><Send className="h-3.5 w-3.5" /> Send to Billing</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast({ title: "Mark Approved", description: `${selectedIds.size} service(s) selected.` })}><CheckCheck className="h-3.5 w-3.5" /> Mark Approved</Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30" onClick={handleDropService}><XCircle className="h-3.5 w-3.5" /> Drop</Button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[44px] pl-6">
              <Checkbox checked={selectedIds.size === services.length && services.length > 0} onCheckedChange={() => selectedIds.size === services.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(services.map(s => s.id)))} className="h-4 w-4" />
            </TableHead>
            <TableHead className="w-[36px]" />
            <TableHead className="w-[28px]" />
            <TableHead>Service</TableHead>
            <TableHead className="whitespace-nowrap">Status</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Disciplines</TableHead>
            <TableHead>Est. Bill Date</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Margin</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(() => {
            const childMap = new Map<string, MockService[]>();
            services.forEach((svc) => {
              if (svc.parentServiceId) {
                const existing = childMap.get(svc.parentServiceId) || [];
                existing.push(svc);
                childMap.set(svc.parentServiceId, existing);
              }
            });

            const renderServiceRow = (svc: MockService, svcIndex: number, isChild: boolean) => {
              const sStatus = serviceStatusStyles[svc.status] || serviceStatusStyles.not_started;
              const isExpanded = expandedIds.has(svc.id);
              const svcMargin = svc.totalAmount > 0 ? Math.round((svc.totalAmount - svc.costAmount) / svc.totalAmount * 100) : 0;
              const pendingReqs = svc.requirements.filter(r => !r.met).length;
              const children = childMap.get(svc.id) || [];

              return (
                <SortableServiceRowWrapper key={svc.id} id={svc.id} disabled={isChild}>
                  {(dragAttributes, dragListeners, sortableRef, sortableStyle) => (
                    <>
                      <TableRow ref={sortableRef} style={sortableStyle} className={cn("cursor-pointer hover:bg-muted/20 group/row", isChild && "bg-muted/5")} onClick={() => toggle(svc.id)}>
                        <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.has(svc.id)} onCheckedChange={() => toggleSelect(svc.id)} className="h-4 w-4" />
                        </TableCell>
                        <TableCell className="pr-0">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="pr-0 w-[28px]" onClick={(e) => e.stopPropagation()}>
                          {!isChild && (
                            <div
                              className="flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/row:opacity-100 transition-opacity"
                              {...dragAttributes}
                              {...dragListeners}
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground/60" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isChild && (
                              <span className="text-muted-foreground/50 ml-2 mr-1 border-l-2 border-b-2 border-muted-foreground/20 w-3 h-3 inline-block rounded-bl-sm" style={{ marginBottom: -4 }} />
                            )}
                            <span className={cn("font-medium whitespace-nowrap", isChild && "text-sm")}>{svc.name}</span>
                            {svc.requirements.length > 0 && (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-[10px] px-1.5 py-0 whitespace-nowrap cursor-pointer hover:opacity-80",
                                  pendingReqs > 0
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isExpanded) toggle(svc.id);
                                }}
                              >
                                {svc.requirements.filter(r => r.met).length}/{svc.requirements.length} req
                              </Badge>
                            )}
                            {isChild && !svc.application && svc.parentServiceId && (() => {
                              const parent = services.find(s => s.id === svc.parentServiceId);
                              return parent?.application ? (
                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">#{parent.application.jobNumber}</Badge>
                              ) : null;
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sStatus.className}`}>{sStatus.label}</span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={svc.assignedTo || "__none__"}
                            onValueChange={(val) => updateServiceField(svc.id, "assignedTo", val === "__none__" ? "" : val)}
                          >
                            <SelectTrigger className="h-7 w-auto min-w-[100px] border-none bg-transparent shadow-none text-sm p-0 px-1 hover:bg-muted/40 focus:ring-0 gap-1 text-muted-foreground">
                              <SelectValue placeholder="Assign" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Unassigned</SelectItem>
                              {companyProfiles.map((p) => (
                                <SelectItem key={p.id} value={[p.first_name, p.last_name].filter(Boolean).join(" ") || p.user_id}>
                                  {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.user_id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {svc.subServices.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">{svc.subServices.map((d) => <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">{d}</Badge>)}</div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Popover open={editingBillDate === svc.id} onOpenChange={(open) => setEditingBillDate(open ? svc.id : null)}>
                            <PopoverTrigger asChild>
                              <button className="h-7 px-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded cursor-pointer whitespace-nowrap">
                                {svc.estimatedBillDate || "— Set date"}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={svc.estimatedBillDate ? new Date(svc.estimatedBillDate) : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    updateServiceField(svc.id, "estimatedBillDate", format(date, "MM/dd/yyyy"));
                                  }
                                  setEditingBillDate(null);
                                }}
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatCurrency(svc.totalAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{svc.costAmount > 0 ? formatCurrency(svc.costAmount) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {svc.costAmount > 0 ? <span className={svcMargin > 50 ? "text-emerald-600 dark:text-emerald-400" : svcMargin < 20 ? "text-red-600 dark:text-red-400" : ""}>{svcMargin}%</span> : "—"}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {svc.needsDobFiling ? (
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDobPrepService(svc)}><ExternalLink className="h-3.5 w-3.5" /> Start DOB NOW</Button>
                          ) : svc.application ? (
                            <Badge variant="outline" className="font-mono text-xs">#{svc.application.jobNumber}</Badge>
                          ) : isChild && svc.parentServiceId ? (() => {
                            const parent = services.find(s => s.id === svc.parentServiceId);
                            return parent?.application ? (
                              <Badge variant="outline" className="font-mono text-xs text-muted-foreground">#{parent.application.jobNumber}</Badge>
                            ) : null;
                          })() : null}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${svc.id}-detail`} className="hover:bg-transparent">
                          <TableCell colSpan={12} className="p-0"><ServiceExpandedDetail service={svc} /></TableCell>
                        </TableRow>
                      )}
                      {!isChild && children.map((child) => renderServiceRow(child, svcIndex, true))}
                    </>
                  )}
                </SortableServiceRowWrapper>
              );
            };

            return services
              .filter((svc) => !svc.parentServiceId)
              .map((svc, i) => renderServiceRow(svc, i, false));
          })()}
        </TableBody>
      </Table>
        </SortableContext>
      </DndContext>
      <div className="px-6 py-4 bg-muted/20 border-t flex items-center gap-8 text-sm flex-wrap">
        <span><span className="text-muted-foreground">Contract:</span> <span className="font-semibold">{formatCurrency(total)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Billed:</span> <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(billed)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Remaining:</span> <span className="font-semibold">{formatCurrency(total - billed)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Cost:</span> <span className="font-semibold">{formatCurrency(cost)}</span></span>
      </div>

      {dobPrepService && (
        <DobNowFilingPrepSheet
          open={!!dobPrepService}
          onOpenChange={(open) => !open && setDobPrepService(null)}
          service={dobPrepService}
          project={project}
          contacts={contacts}
          allServices={allServices}
        />
      )}
    </div>
  );
}

// ======== EMAILS (Real integration + fallback mock) ========

function EmailsFullLive({ projectId, mockEmails }: { projectId: string; mockEmails: MockEmail[] }) {
  const { toast } = useToast();
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Tagged emails for this project — real-time from Gmail
        </h3>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast({ title: "Compose", description: "Opening composer with project context pre-filled." })}>
          <Mail className="h-3.5 w-3.5" /> Compose
        </Button>
      </div>
      <ProjectEmailsTab projectId={projectId} />
      {/* Mock fallback for demo */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
            <ChevronRight className="h-3 w-3" /> Show mock emails ({mockEmails.length})
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 mt-2">
          {mockEmails.map((em) => (
            <div key={em.id} className="flex items-start gap-4 p-3 rounded-lg bg-background border">
              <div className="shrink-0 mt-0.5">
                {em.direction === "inbound" ? <ArrowDownLeft className="h-4 w-4 text-blue-500" /> : <ArrowUpRight className="h-4 w-4 text-emerald-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{em.subject}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{em.date}</span>
                </div>
                <div className="text-sm text-muted-foreground">{em.from}</div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{em.snippet}</p>
              </div>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ======== CONTACTS (collapsible table with PIS + DOB registration) ========

const sourceStyles: Record<string, { label: string; className: string }> = {
  proposal: { label: "Proposal", className: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  pis: { label: "PIS", className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800" },
  manual: { label: "Manual", className: "bg-muted text-muted-foreground" },
};

const dobRegStyles: Record<string, { label: string; className: string; icon: string }> = {
  registered: { label: "Registered", className: "text-emerald-600 dark:text-emerald-400", icon: "✓" },
  not_registered: { label: "Not Registered", className: "text-red-600 dark:text-red-400", icon: "✗" },
  unknown: { label: "Unknown", className: "text-muted-foreground", icon: "?" },
};

function ContactsFull({ contacts, pisStatus }: { contacts: MockContact[]; pisStatus: MockPISStatus }) {
  const { toast } = useToast();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  return (
    <div>
      {/* PIS status bar */}
      {pisStatus.completedFields < pisStatus.totalFields && (
        <div className="flex items-center gap-3 px-6 py-3 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-200/50 dark:border-amber-800/30 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span>PIS sent {pisStatus.sentDate} — {pisStatus.completedFields} of {pisStatus.totalFields} fields completed</span>
          <Button variant="outline" size="sm" className="ml-auto shrink-0 gap-1.5">
            <Send className="h-3.5 w-3.5" /> Follow Up
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[36px]" />
            <TableHead>Name</TableHead>
            <TableHead>DOB Role</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>DOB NOW</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((c) => {
            const src = sourceStyles[c.source] || sourceStyles.manual;
            const reg = dobRegStyles[c.dobRegistered] || dobRegStyles.unknown;
            const isExpanded = expandedIds.has(c.id);
            return (
              <>
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/20" onClick={() => toggle(c.id)}>
                  <TableCell className="pr-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{dobRoleLabels[c.dobRole]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.company}</TableCell>
                  <TableCell>
                    <a href={`tel:${c.phone}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={e => e.stopPropagation()}>
                      {c.phone}
                    </a>
                  </TableCell>
                  <TableCell>
                    <a href={`mailto:${c.email}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors" onClick={e => e.stopPropagation()}>
                      {c.email}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${src.className}`}>{src.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${reg.className}`}>{reg.icon} {reg.label}</span>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${c.id}-detail`} className="hover:bg-transparent">
                    <TableCell colSpan={8} className="p-0">
                      <div className="px-8 py-4 bg-muted/10 text-sm space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div><span className="text-muted-foreground">Role:</span> {c.role}</div>
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              <a href={`tel:${c.phone}`} className="hover:text-foreground transition-colors">{c.phone}</a>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                              <a href={`mailto:${c.email}`} className="hover:text-foreground transition-colors">{c.email}</a>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">DOB NOW Verified:</span>
                                <Button
                                  variant={c.dobRegistered === "registered" ? "default" : "outline"}
                                  size="sm"
                                  className="h-6 text-[10px] px-2"
                                  onClick={() => toast({ title: "Status toggled", description: `${c.name} DOB NOW status updated.` })}
                                >
                                  {c.dobRegistered === "registered" ? "✓ Verified" : "Mark Verified"}
                                </Button>
                              </div>
                              {c.dobRegistered === "not_registered" && (
                                <span className="text-xs text-destructive flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Filing may be blocked
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Review</h5>
                            {c.review ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <span key={i} className={`text-sm ${i < (c.review?.rating || 0) ? "text-amber-500" : "text-muted-foreground/30"}`}>★</span>
                                  ))}
                                  <span className="text-xs text-muted-foreground ml-1">{c.review.rating}/5</span>
                                </div>
                                {c.review.comment && <p className="text-xs text-muted-foreground italic">"{c.review.comment}"</p>}
                              </div>
                            ) : (
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => toast({ title: "Add Review", description: `Opening review form for ${c.company}` })}>
                                <Plus className="h-3 w-3" /> Add Review
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
// ======== TIMELINE ========

function TimelineFull({ milestones }: { milestones: MockMilestone[] }) {
  const sourceIcons: Record<string, typeof Circle> = { system: Circle, email: Mail, user: Pencil, dob: FileText };
  return (
    <div className="p-6 space-y-0">
      {milestones.map((m, i) => {
        const Icon = sourceIcons[m.source] || Circle;
        return (
          <div key={m.id} className="flex gap-4 relative">
            {i < milestones.length - 1 && <div className="absolute left-[13px] top-8 bottom-0 w-px bg-border" />}
            <div className="shrink-0 mt-1 z-10 bg-background rounded-full">
              <Icon className="h-[26px] w-[26px] p-1.5 rounded-full bg-muted text-muted-foreground" />
            </div>
            <div className="pb-5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">{m.date}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{m.source}</Badge>
              </div>
              <p className="text-sm mt-1">{m.event}</p>
              {m.details && <p className="text-xs text-muted-foreground mt-0.5">{m.details}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ======== DOCUMENTS (Universal Documents style) ========

function DocumentsFull({ documents }: { documents: MockDocument[] }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null);
  const { toast } = useToast();

  const loadDocBlob = async (doc: MockDocument): Promise<Blob | null> => {
    const storagePathKey = doc.storage_path;
    if (!storagePathKey) {
      toast({ title: "No file available", description: "This document is a reference record without an uploaded file.", variant: "destructive" });
      return null;
    }
    const bucket = doc.storageBucket || "documents";
    const { data, error } = await supabase.storage.from(bucket).download(storagePathKey);
    if (error || !data) {
      if (doc.category === "contract" && doc.name.toLowerCase().includes("proposal")) {
        toast({ title: "File not yet generated", description: "The signed PDF will be created on the next proposal signing. You can view the proposal from the header banner above." });
      } else {
        toast({ title: "File not found", description: "The file could not be retrieved from storage.", variant: "destructive" });
      }
      return null;
    }
    return data;
  };

  const handlePreview = async (doc: MockDocument) => {
    try {
      const blob = await loadDocBlob(doc);
      if (!blob) return;
      // Convert to data URI for preview in sandboxed iframe
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewDoc({ url: reader.result as string, name: doc.filename || doc.name });
      };
      reader.readAsDataURL(blob);
    } catch {
      toast({ title: "Error", description: "Failed to load document.", variant: "destructive" });
    }
  };

  const handleDownload = async (doc: MockDocument) => {
    try {
      const blob = await loadDocBlob(doc);
      if (!blob) return;
      const reader = new FileReader();
      reader.onload = () => {
        const a = document.createElement("a");
        a.href = reader.result as string;
        a.download = doc.filename || doc.name;
        a.click();
      };
      reader.readAsDataURL(blob);
    } catch {
      toast({ title: "Error", description: "Failed to download document.", variant: "destructive" });
    }
  };

  const filtered = documents.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || d.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search documents..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(docCategoryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={() => toast({ title: "Upload", description: "Upload dialog would open." })}>
          <Upload className="h-3.5 w-3.5" /> Upload
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <File className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No documents found</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[120px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{doc.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{docCategoryLabels[doc.category] || doc.category}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm tabular-nums">{doc.size}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{doc.uploadedBy}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{doc.uploadedDate}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Preview" onClick={() => handlePreview(doc)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Download" onClick={() => handleDownload(doc)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Document Preview Modal */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-base">{previewDoc?.name}</DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <div className="px-4 pb-4" style={{ height: "75vh" }}>
              <iframe
                src={previewDoc.url}
                className="w-full h-full rounded-md border"
                title={previewDoc.name}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ======== TIME LOGS (with service utilization summary) ========

function TimeLogsFull({ timeEntries, services }: { timeEntries: MockTimeEntry[]; services: MockService[] }) {
  const totalHours = timeEntries.reduce((s, t) => s + t.hours, 0);

  // Aggregate hours by service
  const hoursByService: Record<string, number> = {};
  timeEntries.forEach(te => {
    hoursByService[te.service] = (hoursByService[te.service] || 0) + te.hours;
  });

  // Map services to utilization
  const serviceUtilization = services
    .filter(svc => svc.allottedHours > 0)
    .map(svc => {
      const logged = hoursByService[svc.name] || 0;
      const pct = Math.min(Math.round((logged / svc.allottedHours) * 100), 100);
      return { name: svc.name, allotted: svc.allottedHours, logged, remaining: Math.max(svc.allottedHours - logged, 0), pct };
    });

  return (
    <div className="p-6 space-y-6">
      {/* Utilization Summary */}
      {serviceUtilization.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Time by Service</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {serviceUtilization.map(su => (
              <div key={su.name} className="p-3 rounded-lg border bg-background space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{su.name}</span>
                  <span className="text-muted-foreground tabular-nums">{su.logged.toFixed(1)} / {su.allotted} hrs</span>
                </div>
                <Progress value={su.pct} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{su.remaining.toFixed(1)} hrs remaining</span>
                  <span className={su.pct > 80 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>{su.pct}% used</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time entries table */}
      {timeEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No time logged.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Team Member</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeEntries.map((te) => (
                <TableRow key={te.id}>
                  <TableCell className="font-mono">{te.date}</TableCell>
                  <TableCell>{te.user}</TableCell>
                  <TableCell className="text-muted-foreground">{te.service}</TableCell>
                  <TableCell className="text-muted-foreground">{te.description}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{te.hours.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="text-sm text-muted-foreground text-right">
            Total: <span className="font-semibold text-foreground">{totalHours.toFixed(2)} hrs</span>
          </div>
        </>
      )}
    </div>
  );
}

// ======== CHANGE ORDERS (collapsible table + create button) ========

function ChangeOrdersFull({ changeOrders }: { changeOrders: MockChangeOrder[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const toggle = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const coTotal = changeOrders.filter(co => co.status === "approved").reduce((s, co) => s + co.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="text-sm text-muted-foreground">
          {changeOrders.length} change order{changeOrders.length !== 1 ? "s" : ""}
          {coTotal > 0 && <> · Approved: <span className="font-semibold text-foreground">{formatCurrency(coTotal)}</span></>}
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => toast({ title: "Create Change Order", description: "CO creation dialog would open." })}>
          <Plus className="h-4 w-4" /> Create Change Order
        </Button>
      </div>

      {changeOrders.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <GitBranch className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No change orders yet</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => toast({ title: "Create Change Order" })}>
            <Plus className="h-3.5 w-3.5" /> Create Change Order
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[36px]" />
              <TableHead>CO #</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Signed</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changeOrders.map((co) => {
              const style = coStatusStyles[co.status] || coStatusStyles.draft;
              const isExpanded = expandedIds.has(co.id);
              return (
                <>
                  <TableRow key={co.id} className="cursor-pointer hover:bg-muted/20" onClick={() => toggle(co.id)}>
                    <TableCell className="pr-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="font-mono font-medium">{co.number}</TableCell>
                    <TableCell>{co.description}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.className}`}>{style.label}</span>
                    </TableCell>
                    <TableCell>
                      {co.internalSigned && co.clientSigned ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <ShieldCheck className="h-3.5 w-3.5" /> Fully Executed
                        </span>
                      ) : co.status !== "draft" ? (
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className={co.internalSigned ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                            {co.internalSigned ? `✓ Internal ${co.internalSignedDate || ""}` : "⏳ Internal"}
                          </span>
                          <span className={co.clientSigned ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                            {co.clientSigned ? `✓ Client ${co.clientSignedDate || ""}` : "⏳ Client"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{co.requestedBy}</TableCell>
                    <TableCell className="text-muted-foreground">{co.createdDate}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(co.amount)}</TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${co.id}-detail`} className="hover:bg-transparent">
                      <TableCell colSpan={8} className="p-0">
                        <div className="px-8 py-4 bg-muted/10 space-y-2 text-sm">
                          <div><span className="text-muted-foreground">Reason:</span> {co.reason}</div>
                          {co.linkedServices.length > 0 && (
                            <div><span className="text-muted-foreground">Linked Services:</span> {co.linkedServices.join(", ")}</div>
                          )}
                          {co.approvedDate && (
                            <div><span className="text-muted-foreground">Approved:</span> {co.approvedDate}</div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Internal Signature:</span>{" "}
                            {co.internalSigned ? (
                              <span className="text-emerald-600 dark:text-emerald-400">{co.internalSigner} — {co.internalSignedDate}</span>
                            ) : "Not yet signed"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Client Signature:</span>{" "}
                            {co.clientSigned ? (
                              <span className="text-emerald-600 dark:text-emerald-400">{co.clientSigner} — {co.clientSignedDate}</span>
                            ) : co.status !== "draft" ? (
                              <span className="text-amber-600 dark:text-amber-400">Awaiting client signature</span>
                            ) : "Not yet sent"}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ======== JOB COSTING ========

function JobCostingFull({ services, timeEntries }: { services: MockService[]; timeEntries: MockTimeEntry[] }) {
  const contractTotal = services.reduce((s, svc) => s + svc.totalAmount, 0);
  const costTotal = services.reduce((s, svc) => s + svc.costAmount, 0);
  const totalHours = timeEntries.reduce((s, t) => s + t.hours, 0);
  const margin = contractTotal > 0 ? ((contractTotal - costTotal) / contractTotal * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Contract Price", value: formatCurrency(contractTotal) },
          { label: "Total Cost", value: formatCurrency(costTotal) },
          { label: "Gross Profit", value: formatCurrency(contractTotal - costTotal) },
          { label: "Margin", value: `${Math.round(margin)}%` },
          { label: "Total Hours", value: `${totalHours.toFixed(1)} hrs` },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              <div className="text-xl font-semibold mt-1">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Service</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="text-right">Margin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((svc) => {
            const sMargin = svc.totalAmount > 0 ? ((svc.totalAmount - svc.costAmount) / svc.totalAmount * 100) : 0;
            return (
              <TableRow key={svc.id}>
                <TableCell className="font-medium">{svc.name}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(svc.totalAmount)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{svc.costAmount > 0 ? formatCurrency(svc.costAmount) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{svc.costAmount > 0 ? formatCurrency(svc.totalAmount - svc.costAmount) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {svc.costAmount > 0 ? (
                    <span className={sMargin > 50 ? "text-emerald-600 dark:text-emerald-400" : sMargin < 20 ? "text-red-600 dark:text-red-400" : ""}>{Math.round(sMargin)}%</span>
                  ) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
