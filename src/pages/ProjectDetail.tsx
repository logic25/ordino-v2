import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  SERVICE_SETS, CONTACT_SETS, MILESTONE_SETS, CO_SETS,
  EMAIL_SETS, DOCUMENT_SETS, TIME_SETS, CHECKLIST_SETS, PIS_SETS, PROPOSAL_SIG_SETS,
  formatCurrency, serviceStatusStyles, dobRoleLabels, coStatusStyles,
  checklistCategoryLabels, docCategoryLabels,
} from "@/components/projects/projectMockData";
import type {
  MockService, MockContact, MockMilestone, MockChangeOrder,
  MockEmail, MockDocument, MockTimeEntry, MockChecklistItem, MockPISStatus, MockProposalSignature,
} from "@/components/projects/projectMockData";

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
  const [liveServices, setLiveServices] = useState<MockService[]>([]);
  const [extraCOs, setExtraCOs] = useState<MockChangeOrder[]>([]);
  const [servicesInitialized, setServicesInitialized] = useState<string | null>(null);

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

  const project = projects.find((p) => p.id === id);
  const idx = projects.indexOf(project as ProjectWithRelations);

  // Match mock data by project name keywords, fallback to index
  const getMockIdx = () => {
    if (!project) return 0;
    const name = (project.name || "").toLowerCase();
    if (name.includes("689") || name.includes("5th ave")) return 4;
    if (name.includes("port richmond") || name.includes("331")) return 2;
    if (name.includes("lobby") || name.includes("345 park")) return 0;
    if (name.includes("1525") || name.includes("86th")) return 3;
    return Math.max(idx, 0) % SERVICE_SETS.length;
  };
  const mockIdx = getMockIdx();

  // Initialize live services when project changes
  if (project && servicesInitialized !== project.id) {
    setLiveServices(SERVICE_SETS[mockIdx % SERVICE_SETS.length]);
    setExtraCOs([]);
    setServicesInitialized(project.id);
  }

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

  const contacts = CONTACT_SETS[mockIdx % CONTACT_SETS.length];
  const milestones = MILESTONE_SETS[mockIdx % MILESTONE_SETS.length];
  const baseCOs = CO_SETS[mockIdx % CO_SETS.length];
  const changeOrders = [...baseCOs, ...extraCOs];
  const emails = EMAIL_SETS[mockIdx % EMAIL_SETS.length];
  const documents = DOCUMENT_SETS[mockIdx % DOCUMENT_SETS.length];
  const timeEntries = TIME_SETS[mockIdx % TIME_SETS.length];
  const checklistItems = CHECKLIST_SETS[mockIdx % CHECKLIST_SETS.length];
  const pisStatus = PIS_SETS[mockIdx % PIS_SETS.length];
  const proposalSig = PROPOSAL_SIG_SETS[mockIdx % PROPOSAL_SIG_SETS.length];

  const approvedCOs = changeOrders.filter(co => co.status === "approved").reduce((s, co) => s + co.amount, 0);
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
                {contacts.length > 0 && (
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

        {/* Proposal Execution Status + Readiness Checklist */}
        <ProposalExecutionBanner proposalSig={proposalSig} changeOrders={changeOrders} />
        <ReadinessChecklist items={checklistItems} pisStatus={pisStatus} />

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
                <ServicesFull services={liveServices} project={project} contacts={contacts} allServices={liveServices} onServicesChange={setLiveServices} onAddCOs={(cos) => setExtraCOs(prev => [...prev, ...cos])} />
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
                <ChangeOrdersFull changeOrders={changeOrders} />
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

function ProposalExecutionBanner({ proposalSig, changeOrders }: { proposalSig: MockProposalSignature; changeOrders: MockChangeOrder[] }) {
  const unsignedCOs = changeOrders.filter(co => (!co.internalSigned || !co.clientSigned) && co.status !== "draft");

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Proposal signature status */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
        proposalSig.fullyExecuted 
          ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800" 
          : "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
      }`}>
        {proposalSig.fullyExecuted ? (
          <>
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-700 dark:text-emerald-300 font-medium">Proposal #{proposalSig.proposalNumber} — Fully Executed</span>
            <span className="text-xs text-muted-foreground">
              Internal: {proposalSig.internalSignedDate} · Client: {proposalSig.clientSignedDate}
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-700 dark:text-amber-300 font-medium">Proposal #{proposalSig.proposalNumber} — Awaiting Client Signature</span>
            {proposalSig.internalSignedDate && (
              <span className="text-xs text-muted-foreground">Internal signed: {proposalSig.internalSignedDate}</span>
            )}
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 ml-auto">
              <Send className="h-3 w-3" /> Resend for Signature
            </Button>
          </>
        )}
      </div>

      {/* Unsigned CO warning */}
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

function ReadinessChecklist({ items: initialItems, pisStatus }: { items: MockChecklistItem[]; pisStatus: MockPISStatus }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showReceived, setShowReceived] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newFrom, setNewFrom] = useState("");
  const [newCategory, setNewCategory] = useState("missing_document");
  const [localItems, setLocalItems] = useState<MockChecklistItem[]>(initialItems);
  const { toast } = useToast();

  const outstanding = localItems.filter(i => !i.done);
  const completed = localItems.filter(i => i.done);
  const grouped = Object.entries(checklistCategoryLabels).map(([key, { label, icon }]) => ({
    key, label, icon,
    items: outstanding.filter(i => i.category === key),
  })).filter(g => g.items.length > 0);

  const pisComplete = pisStatus.completedFields === pisStatus.totalFields;

  const markDone = (id: string) => {
    setLocalItems(prev => prev.map(item => item.id === id ? { ...item, done: true } : item));
    toast({ title: "Received ✓", description: "Item moved to received list." });
  };

  const removeItem = (id: string) => {
    setLocalItems(prev => prev.filter(item => item.id !== id));
    toast({ title: "Removed", description: "Item removed from checklist." });
  };

  const addItem = () => {
    if (!newLabel.trim()) return;
    const newItem: MockChecklistItem = {
      id: `cl-new-${Date.now()}`,
      category: newCategory as MockChecklistItem["category"],
      label: newLabel,
      fromWhom: newFrom || "—",
      requestedDate: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
      daysWaiting: 0,
      done: false,
    };
    setLocalItems(prev => [...prev, newItem]);
    toast({ title: "Item added", description: newLabel });
    setNewLabel(""); setNewFrom(""); setShowAddForm(false);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={outstanding.length > 0 ? "border-amber-300/50 dark:border-amber-700/50" : "border-emerald-300/50 dark:border-emerald-700/50"}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">
                  Project Readiness
                  {outstanding.length > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {outstanding.length} outstanding
                    </Badge>
                  )}
                  {outstanding.length === 0 && (
                    <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      All clear
                    </Badge>
                  )}
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
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => {
                    // Open the PIS/RFI form in a new tab for editing
                    // In production this would use the actual RFI access token
                    window.open(`/rfi?demo=true`, "_blank");
                  }}>
                    <ExternalLink className="h-3.5 w-3.5" /> Edit PIS
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

            {grouped.map(({ key, label, icon, items: groupItems }) => (
              <div key={key}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {icon} {label} ({groupItems.length})
                </h4>
                <div className="space-y-1.5">
                  {groupItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 text-sm py-2 px-3 rounded-md bg-background border group/item">
                      <Checkbox className="h-4 w-4" onCheckedChange={() => markDone(item.id)} />
                      <span className="flex-1 min-w-0">{item.label}</span>
                      <span className="text-xs text-muted-foreground shrink-0">from {item.fromWhom}</span>
                      <Badge variant={item.daysWaiting > 7 ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                        {item.daysWaiting}d
                      </Badge>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.category === "missing_document" && (
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground" onClick={() => toast({ title: "Request Sent", description: `Requested "${item.label}" from ${item.fromWhom}` })}>
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
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
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
                        <span className="text-xs ml-auto">from {item.fromWhom}</span>
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
                  <Button size="sm" className="h-7 text-xs" onClick={addItem}>Add</Button>
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
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
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

function ServicesFull({ services: initialServices, project, contacts, allServices, onServicesChange, onAddCOs }: { services: MockService[]; project: ProjectWithRelations; contacts: MockContact[]; allServices: MockService[]; onServicesChange?: (services: MockService[]) => void; onAddCOs?: (cos: MockChangeOrder[]) => void }) {
  const [orderedServices, setOrderedServicesLocal] = useState(initialServices);
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

  const moveService = (index: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= orderedServices.length) return;
    const updated = [...orderedServices];
    [updated[index], updated[newIdx]] = [updated[newIdx], updated[index]];
    setOrderedServices(updated);
  };

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
      // Auto-create a negative change order
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
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[44px] pl-6">
              <Checkbox checked={selectedIds.size === services.length && services.length > 0} onCheckedChange={() => selectedIds.size === services.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(services.map(s => s.id)))} className="h-4 w-4" />
            </TableHead>
            <TableHead className="w-[36px]" />
            <TableHead className="w-[36px]" />
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
            // Build parent-child groups
            const childMap = new Map<string, MockService[]>();
            const parentIds = new Set<string>();
            services.forEach((svc) => {
              if (svc.parentServiceId) {
                parentIds.add(svc.parentServiceId);
                const existing = childMap.get(svc.parentServiceId) || [];
                existing.push(svc);
                childMap.set(svc.parentServiceId, existing);
              }
            });

            // Render rows: parents then their children, skip orphan children from top-level
            const renderServiceRow = (svc: MockService, svcIndex: number, isChild: boolean) => {
              const sStatus = serviceStatusStyles[svc.status] || serviceStatusStyles.not_started;
              const isExpanded = expandedIds.has(svc.id);
              const svcMargin = svc.totalAmount > 0 ? Math.round((svc.totalAmount - svc.costAmount) / svc.totalAmount * 100) : 0;
              const pendingReqs = svc.requirements.filter(r => !r.met).length;
              const children = childMap.get(svc.id) || [];

              return (
                <>
                  <TableRow key={svc.id} className={cn("cursor-pointer hover:bg-muted/20 group/row", isChild && "bg-muted/5")} onClick={() => toggle(svc.id)}>
                    <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(svc.id)} onCheckedChange={() => toggleSelect(svc.id)} className="h-4 w-4" />
                    </TableCell>
                    <TableCell className="pr-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="pr-0 w-[28px]" onClick={(e) => e.stopPropagation()}>
                      {!isChild && (
                        <div className="flex flex-col items-center opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button className="p-0.5 rounded hover:bg-muted disabled:opacity-20" disabled={svcIndex === 0} onClick={() => moveService(svcIndex, "up")}>
                            <ArrowUp className="h-2.5 w-2.5 text-muted-foreground" />
                          </button>
                          <GripVertical className="h-3 w-3 text-muted-foreground/40" />
                          <button className="p-0.5 rounded hover:bg-muted disabled:opacity-20" disabled={svcIndex === services.length - 1} onClick={() => moveService(svcIndex, "down")}>
                            <ArrowDown className="h-2.5 w-2.5 text-muted-foreground" />
                          </button>
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
                  {/* Render children inline after parent */}
                  {!isChild && children.map((child) => renderServiceRow(child, svcIndex, true))}
                </>
              );
            };

            // Only render top-level services (not children)
            return services
              .filter((svc) => !svc.parentServiceId)
              .map((svc, i) => renderServiceRow(svc, i, false));
          })()}
        </TableBody>
      </Table>
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
          onOpenChange={(open) => { if (!open) setDobPrepService(null); }}
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
  const { toast } = useToast();

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
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Preview" onClick={() => toast({ title: "Preview", description: `Opening preview for ${doc.name}` })}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
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
