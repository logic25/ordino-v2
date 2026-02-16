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
} from "lucide-react";
import { useProjects, ProjectWithRelations } from "@/hooks/useProjects";
import { ProjectEmailsTab } from "@/components/emails/ProjectEmailsTab";
import { useToast } from "@/hooks/use-toast";
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

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = useProjects();

  const project = projects.find((p) => p.id === id);
  const idx = projects.indexOf(project as ProjectWithRelations);

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
  const mockIdx = Math.max(idx, 0);

  const services = SERVICE_SETS[mockIdx % SERVICE_SETS.length];
  const contacts = CONTACT_SETS[mockIdx % CONTACT_SETS.length];
  const milestones = MILESTONE_SETS[mockIdx % MILESTONE_SETS.length];
  const changeOrders = CO_SETS[mockIdx % CO_SETS.length];
  const emails = EMAIL_SETS[mockIdx % EMAIL_SETS.length];
  const documents = DOCUMENT_SETS[mockIdx % DOCUMENT_SETS.length];
  const timeEntries = TIME_SETS[mockIdx % TIME_SETS.length];
  const checklistItems = CHECKLIST_SETS[mockIdx % CHECKLIST_SETS.length];
  const pisStatus = PIS_SETS[mockIdx % PIS_SETS.length];
  const proposalSig = PROPOSAL_SIG_SETS[mockIdx % PROPOSAL_SIG_SETS.length];

  const approvedCOs = changeOrders.filter(co => co.status === "approved").reduce((s, co) => s + co.amount, 0);
  const contractTotal = services.reduce((s, svc) => s + svc.totalAmount, 0);
  const adjustedTotal = contractTotal + approvedCOs;
  const billed = services.reduce((s, svc) => s + svc.billedAmount, 0);
  const cost = services.reduce((s, svc) => s + svc.costAmount, 0);
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
                {project.clients?.name && (
                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {project.clients.name}</span>
                )}
                <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> PM: {formatName(project.assigned_pm)}</span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Edit Project
          </Button>
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
                <FileText className="h-3.5 w-3.5" /> Services ({services.length})
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
                <ServicesFull services={services} />
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
                <TimeLogsFull timeEntries={timeEntries} services={services} />
              </TabsContent>
              <TabsContent value="change-orders" className="mt-0">
                <ChangeOrdersFull changeOrders={changeOrders} />
              </TabsContent>
              <TabsContent value="job-costing" className="mt-0">
                <JobCostingFull services={services} timeEntries={timeEntries} />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
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

function ReadinessChecklist({ items, pisStatus }: { items: MockChecklistItem[]; pisStatus: MockPISStatus }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showReceived, setShowReceived] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newFrom, setNewFrom] = useState("");
  const [newCategory, setNewCategory] = useState("missing_document");
  const { toast } = useToast();

  const outstanding = items.filter(i => !i.done);
  const completed = items.filter(i => i.done);
  const grouped = Object.entries(checklistCategoryLabels).map(([key, { label, icon }]) => ({
    key, label, icon,
    items: outstanding.filter(i => i.category === key),
  })).filter(g => g.items.length > 0);

  const pisComplete = pisStatus.completedFields === pisStatus.totalFields;

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
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">PIS:</span>
                  {pisComplete ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">
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
            {!pisComplete && (
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
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Send Reminder
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
                    <div key={item.id} className="flex items-center gap-3 text-sm py-2 px-3 rounded-md bg-background border">
                      <Checkbox className="h-4 w-4" />
                      <span className="flex-1 min-w-0">{item.label}</span>
                      <span className="text-xs text-muted-foreground shrink-0">from {item.fromWhom}</span>
                      <Badge variant={item.daysWaiting > 7 ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                        {item.daysWaiting}d waiting
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => toast({ title: "Removed", description: `"${item.label}" removed from checklist.` })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Received items — collapsible sub-section */}
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

            {/* Add item form */}
            {showAddForm ? (
              <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    placeholder="What's needed?"
                    className="h-8 text-sm"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    autoFocus
                  />
                  <Input
                    placeholder="From whom?"
                    className="h-8 text-sm"
                    value={newFrom}
                    onChange={(e) => setNewFrom(e.target.value)}
                  />
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(checklistCategoryLabels).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={() => {
                    if (newLabel.trim()) {
                      toast({ title: "Item added", description: newLabel });
                      setNewLabel(""); setNewFrom(""); setShowAddForm(false);
                    }
                  }}>Add</Button>
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
  const [notes, setNotes] = useState(service.notes || "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [showAddReq, setShowAddReq] = useState(false);
  const [newReqLabel, setNewReqLabel] = useState("");
  const { toast } = useToast();

  return (
    <div className="px-8 py-5 space-y-5 bg-muted/10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Scope of Work
          </h4>
          <p className="text-sm leading-relaxed whitespace-pre-line">{service.scopeOfWork || "No scope defined."}</p>
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
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Notes
            {!editingNotes && (
              <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => setEditingNotes(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </h4>
          {editingNotes ? (
            <div className="space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px] text-sm"
                placeholder="Add notes about this service..."
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { setEditingNotes(false); toast({ title: "Notes saved" }); }}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setNotes(service.notes || ""); setEditingNotes(false); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : notes ? (
            <p className="text-sm leading-relaxed cursor-pointer hover:bg-muted/30 rounded p-1 -m-1 transition-colors" onClick={() => setEditingNotes(true)}>{notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic cursor-pointer hover:bg-muted/30 rounded p-1 -m-1 transition-colors" onClick={() => setEditingNotes(true)}>Click to add notes...</p>
          )}
        </div>
      </div>

      {/* Requirements */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> Requirements ({service.requirements.filter(r => !r.met).length} pending)
        </h4>
        {service.requirements.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mb-2">
            {service.requirements.map((req) => (
              <div key={req.id} className={`flex items-center gap-2 text-sm py-1.5 px-3 rounded-md border ${req.met ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-800/30" : "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30"}`}>
                <Checkbox checked={req.met} className="h-3.5 w-3.5" />
                <span className={`flex-1 ${req.met ? "text-muted-foreground line-through" : ""}`}>{req.label}</span>
                {req.detail && <span className="text-xs text-muted-foreground ml-auto">— {req.detail}</span>}
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => toast({ title: "Removed", description: `Requirement "${req.label}" removed.` })}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {showAddReq ? (
          <div className="flex items-center gap-2">
            <Input
              placeholder="New requirement..."
              className="h-8 text-sm flex-1 max-w-sm"
              value={newReqLabel}
              onChange={(e) => setNewReqLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newReqLabel.trim()) { toast({ title: "Requirement added", description: newReqLabel }); setNewReqLabel(""); setShowAddReq(false); } }}
              autoFocus
            />
            <Button size="sm" className="h-8 text-xs" onClick={() => { if (newReqLabel.trim()) { toast({ title: "Requirement added", description: newReqLabel }); setNewReqLabel(""); setShowAddReq(false); } }}>
              Add
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setNewReqLabel(""); setShowAddReq(false); }}>Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setShowAddReq(true)}>
            <Plus className="h-3 w-3" /> Add Requirement
          </Button>
        )}
      </div>

      {/* Tasks */}
      {service.tasks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Tasks ({service.tasks.length})
          </h4>
          <div className="space-y-1.5">
            {service.tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 text-sm py-1.5 px-3 rounded-md bg-background border">
                <Checkbox checked={task.done} className="h-4 w-4" />
                <span className={task.done ? "line-through text-muted-foreground" : "flex-1"}>{task.text}</span>
                <div className="flex items-center gap-2 ml-auto shrink-0">
                  {task.assignedTo && <Badge variant="outline" className="text-xs">{task.assignedTo}</Badge>}
                  {task.dueDate && <span className="text-xs text-muted-foreground">Due {task.dueDate}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-1.5">
          <Mail className="h-3.5 w-3.5" /> Email about this
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Task
        </Button>
      </div>
    </div>
  );
}

function ServicesFull({ services }: { services: MockService[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggle = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const handleBulk = (action: string) => toast({ title: action, description: `${selectedIds.size} service(s) selected.` });

  const total = services.reduce((s, svc) => s + svc.totalAmount, 0);
  const billed = services.reduce((s, svc) => s + svc.billedAmount, 0);
  const cost = services.reduce((s, svc) => s + svc.costAmount, 0);

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-6 py-3 bg-muted/40 border-b flex-wrap">
          <span className="text-sm text-muted-foreground font-medium">{selectedIds.size} selected:</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleBulk("Send to Billing")}><Send className="h-3.5 w-3.5" /> Send to Billing</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleBulk("Mark Approved")}><CheckCheck className="h-3.5 w-3.5" /> Mark Approved</Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30" onClick={() => handleBulk("Drop Service")}><XCircle className="h-3.5 w-3.5" /> Drop</Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[44px] pl-6">
              <Checkbox checked={selectedIds.size === services.length && services.length > 0} onCheckedChange={() => selectedIds.size === services.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(services.map(s => s.id)))} className="h-4 w-4" />
            </TableHead>
            <TableHead className="w-[36px]" />
            <TableHead>Service</TableHead>
            <TableHead>Status</TableHead>
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
          {services.map((svc) => {
            const sStatus = serviceStatusStyles[svc.status] || serviceStatusStyles.not_started;
            const isExpanded = expandedIds.has(svc.id);
            const svcMargin = svc.totalAmount > 0 ? Math.round((svc.totalAmount - svc.costAmount) / svc.totalAmount * 100) : 0;
            const pendingReqs = svc.requirements.filter(r => !r.met).length;
            return (
              <>
                <TableRow key={svc.id} className="cursor-pointer hover:bg-muted/20" onClick={() => toggle(svc.id)}>
                  <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(svc.id)} onCheckedChange={() => toggleSelect(svc.id)} className="h-4 w-4" />
                  </TableCell>
                  <TableCell className="pr-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{svc.name}</span>
                      {pendingReqs > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{pendingReqs} req</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sStatus.className}`}>{sStatus.label}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{svc.assignedTo}</TableCell>
                  <TableCell>
                    {svc.subServices.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">{svc.subServices.map((d) => <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">{d}</Badge>)}</div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{svc.estimatedBillDate || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(svc.totalAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{svc.costAmount > 0 ? formatCurrency(svc.costAmount) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {svc.costAmount > 0 ? <span className={svcMargin > 50 ? "text-emerald-600 dark:text-emerald-400" : svcMargin < 20 ? "text-red-600 dark:text-red-400" : ""}>{svcMargin}%</span> : "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {svc.needsDobFiling ? (
                      <Button variant="outline" size="sm" className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Start DOB NOW</Button>
                    ) : svc.application ? (
                      <Badge variant="outline" className="font-mono text-xs">#{svc.application.jobNumber}</Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${svc.id}-detail`} className="hover:bg-transparent">
                    <TableCell colSpan={11} className="p-0"><ServiceExpandedDetail service={svc} /></TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
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
                      <div className="px-8 py-4 bg-muted/10 text-sm space-y-1">
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
                              {c.dobRegistered === "registered" ? "✓ Verified" : c.dobRegistered === "not_registered" ? "Mark Verified" : "Mark Verified"}
                            </Button>
                          </div>
                          {c.dobRegistered === "not_registered" && (
                            <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Filing may be blocked
                            </span>
                          )}
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
