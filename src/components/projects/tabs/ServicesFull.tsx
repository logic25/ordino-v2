import { useState, useMemo, useEffect, Fragment } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSensors, useSensor, PointerSensor } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Pencil, FileText, User, Loader2, ExternalLink, ChevronRight, ChevronDown,
  Send, XCircle, CheckCheck, Plus, AlertTriangle, Trash2, DollarSign,
  GripVertical, Building2, CheckCircle2, Mail, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useProjectChecklist, useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem } from "@/hooks/useProjectChecklist";
import { DobNowFilingPrepSheet } from "@/components/projects/DobNowFilingPrepSheet";
import { SendToBillingDialog } from "@/components/invoices/SendToBillingDialog";
import { ComposeEmailDialog } from "@/components/emails/ComposeEmailDialog";
import { ExpenseDialog } from "@/components/projects/ExpenseDialog";
import { ApproveExpenseDialog } from "@/components/expenses/ApproveExpenseDialog";
import { useProjectExpenses, useReleaseExpenseToBilling, getReceiptSignedUrl } from "@/hooks/useProjectExpenses";
import { useSearchParams } from "react-router-dom";
import { cn, formatCurrency } from "@/lib/utils";
import { predictBillDates, applyBillDatePredictions } from "@/hooks/useBillDatePrediction";
import { serviceStatusStyles } from "@/components/projects/projectMockData";
import type { MockService, MockContact, MockTimeEntry } from "@/components/projects/projectMockData";
import type { ProjectWithRelations } from "@/hooks/useProjects";
import type { ChangeOrder } from "@/hooks/useChangeOrders";
import { format } from "date-fns";

const WORK_TYPE_ABBREVS: Record<string, string> = {
  "plumbing": "PL",
  "sprinkler": "SP",
  "general construction": "GC",
  "mechanical": "MECH",
  "electrical": "ELEC",
  "structural": "STR",
  "fire alarm": "FA",
  "fire suppression": "FS",
  "elevator": "ELEV",
  "boiler": "BLR",
  "standpipe": "STP",
  "construction equipment": "CE",
  "demolition": "DEM",
  "sign": "SIGN",
  "curb cut": "CC",
  "sidewalk": "SW",
  "scaffold": "SCAF",
  "fence": "FNC",
  "oil burner": "OB",
  "fuel gas": "FG",
  "fuel oil": "FO",
};

function abbreviateWorkType(wt: string): string {
  const lower = wt.toLowerCase().trim();
  if (WORK_TYPE_ABBREVS[lower]) return WORK_TYPE_ABBREVS[lower];
  // Check if already abbreviated (2-4 chars all caps)
  if (/^[A-Z]{2,5}$/.test(wt.trim())) return wt.trim();
  // Fallback: first letters of each word
  return wt.split(/\s+/).map(w => w[0]?.toUpperCase()).join("") || wt;
}

function AssignedToField({ service }: { service: MockService }) {
  const { data: profiles = [] } = useCompanyProfiles();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const handleChange = async (value: string) => {
    try {
      await supabase.from("services").update({ assigned_to: value || null } as any).eq("id", service.id);
      queryClient.invalidateQueries({ queryKey: ["project-services-full"] });
      toast({ title: "Assignment updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };
  return (
    <div className="flex items-center gap-2 text-sm">
      <User className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">Assigned to:</span>
      <Select value={service.assignedTo || ""} onValueChange={handleChange}>
        <SelectTrigger className="h-7 w-auto min-w-[140px] border-none bg-transparent shadow-none text-sm p-0 px-1 hover:bg-muted/40 focus:ring-0 gap-1">
          <SelectValue placeholder="Select team member" />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((p) => (
            <SelectItem key={p.id} value={p.display_name || `${p.first_name} ${p.last_name}`.trim()}>
              {p.display_name || `${p.first_name} ${p.last_name}`.trim() || "Unnamed"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ServiceApplicationField({ service }: { service: MockService }) {
  const [editing, setEditing] = useState(false);
  const [jobNumber, setJobNumber] = useState<string>(service.application?.jobNumber || "");
  const [type, setType] = useState<string>(service.application?.type || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const save = async () => {
    setSaving(true);
    try {
      const payload = jobNumber.trim() || type.trim()
        ? { jobNumber: jobNumber.trim(), type: type.trim() || "Other" }
        : null;
      const { error } = await supabase
        .from("services")
        .update({ application: payload } as any)
        .eq("id", service.id);
      if (error) throw error;
      toast({ title: payload ? "Application saved" : "Application cleared" });
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["project-detail"] });
      await queryClient.invalidateQueries({ queryKey: ["services"] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setJobNumber("");
    setType("");
    setSaving(true);
    try {
      const { error } = await supabase.from("services").update({ application: null } as any).eq("id", service.id);
      if (error) throw error;
      toast({ title: "Application cleared" });
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["project-detail"] });
    } catch (e: any) {
      toast({ title: "Clear failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Job #</label>
          <Input value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} placeholder="e.g. 123456789" className="h-7 text-sm font-mono" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</label>
          <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="ALT-1, ALT-2, NB, Pro-Cert…" className="h-7 text-sm" />
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-7 text-xs" onClick={save} disabled={saving}>Save</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditing(false); setJobNumber(service.application?.jobNumber || ""); setType(service.application?.type || ""); }} disabled={saving}>Cancel</Button>
          {service.application && <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={clear} disabled={saving}>Clear</Button>}
        </div>
      </div>
    );
  }

  if (service.application) {
    return (
      <div className="space-y-1 text-sm">
        <div>Job #: <span className="font-mono font-medium">{service.application.jobNumber}</span></div>
        <div>Type: <span className="font-medium">{service.application.type}</span></div>
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setEditing(true)}>Edit</Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground italic">No application linked</p>
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setEditing(true)}>
        <Building2 className="h-3 w-3" /> Add application
      </Button>
    </div>
  );
}

function ServiceExpandedDetail({ service, projectName, projectId }: { service: MockService; projectName?: string; projectId?: string }) {

  const [showAddReq, setShowAddReq] = useState(false);
  const [newReqLabel, setNewReqLabel] = useState("");
  const [newReqFrom, setNewReqFrom] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [localTasks, setLocalTasks] = useState(service.tasks || []);
  const [localCosts, setLocalCosts] = useState<{ discipline: string; amount: number; editing?: string }[]>(
    (service.estimatedCosts || []).map(ec => ({ ...ec }))
  );
  const [composeEmailOpen, setComposeEmailOpen] = useState(false);
  const { toast } = useToast();

  // DB-backed pre-filing conditions
  const { data: allChecklistItems = [] } = useProjectChecklist(projectId);
  const serviceReqs = allChecklistItems.filter(item => item.source_service_id === service.id);
  const addChecklistItem = useAddChecklistItem();
  const updateChecklistItem = useUpdateChecklistItem();
  const deleteChecklistItem = useDeleteChecklistItem();

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
    if (!newReqLabel.trim() || !projectId) return;
    addChecklistItem.mutate({
      project_id: projectId,
      label: newReqLabel,
      category: "missing_document",
      from_whom: newReqFrom || undefined,
      source_service_id: service.id,
      source_catalog_name: service.name,
    });
    toast({ title: "Condition added", description: newReqLabel });
    setNewReqLabel(""); setNewReqFrom(""); setShowAddReq(false);
  };

  return (
    <div className="px-8 py-4 space-y-4 bg-muted/10">
      {/* AssignedToField commented out per user request */}
      {/* <AssignedToField service={service} /> */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <ServiceApplicationField service={service} />
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
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
                    value={ec.editing ?? `$${(ec.amount ?? 0).toLocaleString()}`}
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
                <span className="tabular-nums">${localCosts.reduce((s, ec) => s + (ec.amount ?? 0), 0).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No cost estimates — complete PIS to populate.</p>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Pre-Filing Conditions ({serviceReqs.filter(r => r.status === "open").length} pending)
          </h4>
          {serviceReqs.length > 0 && (
            <div className="space-y-1 mb-2">
              {serviceReqs.map((req) => (
                <div key={req.id} className={`flex items-center gap-2 text-sm py-1.5 px-3 rounded-md border ${req.status === "done" ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-800/30" : "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30"}`}>
                  <Checkbox checked={req.status === "done"} className="h-3.5 w-3.5" onCheckedChange={() => {
                    updateChecklistItem.mutate({ id: req.id, projectId: projectId!, status: req.status === "done" ? "open" : "done" });
                  }} />
                  <span className={`flex-1 ${req.status === "done" ? "text-muted-foreground line-through" : ""}`}>{req.label}</span>
                  <div className="flex flex-col items-end gap-0.5 shrink-0 ml-auto">
                    {req.from_whom && <span className="text-[10px] text-muted-foreground">from {req.from_whom}</span>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteChecklistItem.mutate({ id: req.id, projectId: projectId! })}>
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
              <Plus className="h-3 w-3" /> Add Condition
            </Button>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> To-Dos ({localTasks.length})
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
              <Plus className="h-3.5 w-3.5" /> Add To-Do
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setComposeEmailOpen(true)}>
              <Mail className="h-3.5 w-3.5" /> Email about this
            </Button>
          </div>
        )}
      </div>

      <ComposeEmailDialog
        open={composeEmailOpen}
        onOpenChange={setComposeEmailOpen}
        defaultSubject={`Re: ${service.name}${projectName ? ` — ${projectName}` : ""}`}
        defaultBody={`<p>Hi,</p><p>Regarding the service <strong>${service.name}</strong>${projectName ? ` on project <strong>${projectName}</strong>` : ""}:</p><p></p>`}
        projectId={projectId}
      />
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

function ExpensesSection({ projectId, clientId }: { projectId: string; clientId: string | null }) {
  const { data: expenses = [], isLoading } = useProjectExpenses(projectId);
  const release = useReleaseExpenseToBilling();
  const { toast } = useToast();
  const [approveId, setApproveId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open the approve dialog from the email link:
  // /projects/:id?expense=<id>&action=approve
  useEffect(() => {
    const ex = searchParams.get("expense");
    const action = searchParams.get("action");
    if (ex && action === "approve") {
      setApproveId(ex);
      const next = new URLSearchParams(searchParams);
      next.delete("expense");
      next.delete("action");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (isLoading || expenses.length === 0) return null;
  const statusStyles: Record<string, string> = {
    pending_approval: "bg-amber-100 text-amber-800 hover:bg-amber-200",
    approved: "bg-blue-100 text-blue-800",
    denied: "bg-red-100 text-red-800",
    on_hold: "bg-yellow-100 text-yellow-800",
    pending_billing: "bg-purple-100 text-purple-800",
    billed: "bg-green-100 text-green-800",
    paid: "bg-emerald-100 text-emerald-800",
    non_billable: "bg-muted text-muted-foreground",
  };
  const openReceipt = async (path: string) => {
    try {
      const url = await getReceiptSignedUrl(path);
      window.open(url, "_blank");
    } catch (err: any) {
      toast({ title: "Could not load receipt", description: err.message, variant: "destructive" });
    }
  };
  const handleRelease = async (id: string) => {
    try {
      await release.mutateAsync({ expenseId: id });
      toast({ title: "Released to billing", description: "Sai will be notified." });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };
  return (
    <div className="px-6 py-3 border-b bg-muted/20">
      <div className="text-xs font-semibold text-muted-foreground mb-2">Expenses ({expenses.length})</div>
      <div className="space-y-1.5">
        {expenses.map((e: any) => {
          const canRelease = e.status === "approved" || e.status === "on_hold";
          const isPending = e.status === "pending_approval";
          return (
            <div key={e.id} className="flex items-center justify-between gap-2 text-sm bg-background rounded px-3 py-2 border">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{e.description}</span>
                {e.vendor && <span className="text-muted-foreground text-xs truncate">· {e.vendor}</span>}
                {e.receipt_url && (
                  <button onClick={() => openReceipt(e.receipt_url)} className="text-xs text-primary hover:underline shrink-0 inline-flex items-center gap-0.5">
                    <FileText className="h-3 w-3" /> receipt
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isPending ? (
                  <button
                    type="button"
                    onClick={() => setApproveId(e.id)}
                    title="Review & approve"
                    className={cn("text-xs px-2 py-0.5 rounded-md border inline-flex items-center gap-1 transition-colors", statusStyles[e.status])}
                  >
                    pending approval
                  </button>
                ) : (
                  <Badge variant="outline" className={cn("text-xs", statusStyles[e.status] || "")}>{e.status.replace(/_/g, " ")}</Badge>
                )}
                <span className="font-semibold tabular-nums">{formatCurrency(Number(e.billable_amount) || 0)}</span>
                {canRelease && e.status === "on_hold" && (
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => handleRelease(e.id)} disabled={release.isPending}>
                    Release to billing
                  </Button>
                )}

              </div>
            </div>
          );
        })}
      </div>
      <ApproveExpenseDialog expenseId={approveId} open={!!approveId} onOpenChange={(o) => { if (!o) setApproveId(null); }} />
    </div>
  );
}




export function ServicesFull({ services: initialServices, project, contacts, allServices, timeEntries = [], onAddCOs }: { services: MockService[]; project: ProjectWithRelations; contacts: MockContact[]; allServices: MockService[]; timeEntries?: MockTimeEntry[]; onAddCOs?: (cos: Array<{ title: string; description?: string; amount: number; status?: ChangeOrder["status"]; requested_by?: string; linked_service_names?: string[]; reason?: string; project_id: string; company_id: string }>) => void }) {
  const [orderedServices, setOrderedServices] = useState(initialServices);
  const initialKey = initialServices.map(s => `${s.id}:${s.needsDobFiling ? 1 : 0}:${s.status}:${s.totalAmount}:${s.billedAmount}:${s.costAmount}:${s.assignedTo}:${s.estimatedBillDate}`).join(",");
  const [lastKey, setLastKey] = useState(initialKey);
  if (initialKey !== lastKey) {
    setOrderedServices(initialServices);
    setLastKey(initialKey);
  }
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingBillDate, setEditingBillDate] = useState<string | null>(null);
  const [dobPrepService, setDobPrepService] = useState<MockService | null>(null);
  const [sendToBillingOpen, setSendToBillingOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const { data: companyProfiles = [] } = useCompanyProfiles();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: filingAuditLogs = [] } = useQuery({
    queryKey: ["filing-audit-logs", project.id],
    queryFn: async () => {
      const { data } = await (supabase.from("filing_audit_log" as any)
        .select("service_id, created_at, method")
        .eq("project_id", project.id)
        .eq("method", "manual_confirm")
        .order("created_at", { ascending: false }) as any);
      return (data || []) as { service_id: string; created_at: string; method: string }[];
    },
    enabled: !!project.id,
  });

  const filingStatusByService = useMemo(() => {
    const map: Record<string, string> = {};
    for (const log of filingAuditLogs) {
      if (!map[log.service_id]) map[log.service_id] = log.created_at;
    }
    return map;
  }, [filingAuditLogs]);

  const updateServiceField = async (id: string, field: "assignedTo" | "estimatedBillDate", value: string) => {
    setOrderedServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value, ...(field === "estimatedBillDate" ? { billDateSource: "manual" as const } : {}) } : s));
    const dbField = field === "assignedTo" ? "assigned_to" : "estimated_bill_date";
    try {
      const patch: any = { [dbField]: value || null };
      if (field === "estimatedBillDate") patch.bill_date_source = "manual";
      await supabase.from("services").update(patch).eq("id", id);
      toast({ title: "Updated", description: `Service ${field === "assignedTo" ? "assignment" : "bill date"} updated.` });
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    }
  };

  const updateServiceStatus = async (id: string, status: string) => {
    setOrderedServices(prev => prev.map(s => s.id === id ? { ...s, status: status as MockService["status"] } : s));
    try {
      await supabase.from("services").update({ status } as any).eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["project-services-full"] });
      toast({ title: "Status updated" });
    } catch (err: any) {
      toast({ title: "Error saving status", description: err.message, variant: "destructive" });
    }
  };

  const toggleDobFiling = async (serviceId: string) => {
    const svc = orderedServices.find(s => s.id === serviceId);
    if (!svc) return;
    const newVal = !svc.needsDobFiling;
    setOrderedServices(prev => prev.map(s => s.id === serviceId ? { ...s, needsDobFiling: newVal } : s));
    try {
      await supabase.from("services").update({ needs_dob_filing: newVal }).eq("id", serviceId);
      toast({ title: newVal ? "DOB filing enabled" : "DOB filing disabled" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
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
    setSendToBillingOpen(true);
  };

  const handleDropService = async () => {
    const droppedIds: string[] = [];
    const newCOInputs: Array<{ title: string; description?: string; amount: number; status?: ChangeOrder["status"]; requested_by?: string; linked_service_names?: string[]; reason?: string; project_id: string; company_id: string }> = [];
    setOrderedServices(prev => prev.map(s => {
      if (!selectedIds.has(s.id) || s.status === "dropped") return s;
      droppedIds.push(s.id);
      newCOInputs.push({
        title: `Dropped service: ${s.name}`,
        description: `Service "${s.name}" was removed from project scope`,
        amount: -s.totalAmount,
        status: "approved",
        requested_by: "Internal",
        linked_service_names: [s.name],
        reason: `Service "${s.name}" was dropped from scope`,
        project_id: project.id,
        company_id: project.company_id,
      });
      return { ...s, status: "dropped" as const };
    }));
    for (const id of droppedIds) {
      await supabase.from("services").update({ status: "dropped" } as any).eq("id", id);
    }
    if (newCOInputs.length > 0) {
      onAddCOs?.(newCOInputs);
    }
    toast({
      title: "Service(s) Dropped",
      description: `${selectedIds.size} service(s) dropped. Negative change order(s) created automatically.`,
    });
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["project-services-full"] });
  };

  const [predicting, setPredicting] = useState(false);
  const handlePredictBillDates = async () => {
    setPredicting(true);
    try {
      const predictions = await predictBillDates(
        project.id,
        project.company_id,
        orderedServices.map(s => ({ id: s.id, name: s.name, status: s.status, estimatedBillDate: s.estimatedBillDate }))
      );
      if (predictions.length === 0) {
        toast({ title: "No predictions needed", description: "All services already have bill dates or are billed/paid." });
        setPredicting(false);
        return;
      }
      await applyBillDatePredictions(predictions);
      queryClient.invalidateQueries({ queryKey: ["project-services-full"] });
      toast({ title: "Bill dates predicted", description: `Set estimated dates for ${predictions.length} service(s) based on historical data.` });
    } catch (err: any) {
      toast({ title: "Prediction failed", description: err.message, variant: "destructive" });
    }
    setPredicting(false);
  };

  const activeServices = orderedServices.filter(s => s.status !== "billed");
  const billedServices = orderedServices.filter(s => s.status === "billed");
  const services = activeServices;

  const toggle = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const total = orderedServices.reduce((s, svc) => s + (Number(svc.totalAmount) || 0), 0);
  const billed = orderedServices.reduce((s, svc) => s + (Number(svc.billedAmount) || 0), 0);
  const cost = orderedServices.reduce((s, svc) => s + (Number(svc.costAmount) || 0), 0);
  const [showBilled, setShowBilled] = useState(false);
  const { data: projectExpenses = [] } = useProjectExpenses(project.id);
  const releaseExpense = useReleaseExpenseToBilling();
  const [approveExpenseId, setApproveExpenseId] = useState<string | null>(null);
  const expenseStatusStyles: Record<string, string> = {
    pending_approval: "bg-amber-100 text-amber-800",
    approved: "bg-blue-100 text-blue-800",
    denied: "bg-red-100 text-red-800",
    on_hold: "bg-yellow-100 text-yellow-800",
    pending_billing: "bg-purple-100 text-purple-800",
    billed: "bg-green-100 text-green-800",
    paid: "bg-emerald-100 text-emerald-800",
    non_billable: "bg-muted text-muted-foreground",
  };
  const openExpenseReceipt = async (path: string) => {
    try { const url = await getReceiptSignedUrl(path); window.open(url, "_blank"); }
    catch (err: any) { toast({ title: "Could not load receipt", description: err.message, variant: "destructive" }); }
  };
  const totalBilledExpense = projectExpenses.reduce((s: number, e: any) => s + (Number(e.billable_amount) || 0), 0);

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 px-6 py-3 border-b">
        <span className="text-sm font-semibold text-muted-foreground">Services & Expenses</span>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setExpenseDialogOpen(true)}>
          <DollarSign className="h-3.5 w-3.5" /> Add Expense
        </Button>
      </div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-6 py-3 bg-muted/40 border-b flex-wrap">
          <span className="text-sm text-muted-foreground font-medium">{selectedIds.size} selected:</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSendToBilling}><Send className="h-3.5 w-3.5" /> Send to Billing</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast({ title: "Mark Approved", description: `${selectedIds.size} service(s) selected.` })}><CheckCheck className="h-3.5 w-3.5" /> Mark Approved</Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30" onClick={handleDropService}><XCircle className="h-3.5 w-3.5" /> Drop</Button>
        </div>
      )}
      <ExpenseDialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen} projectId={project.id} clientId={project.client_id || null} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
      <div className="overflow-x-auto">
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
            <TableHead>Work Types</TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                Est. Bill Date
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-primary"
                  title="AI predict bill dates from historical data"
                  onClick={handlePredictBillDates}
                  disabled={predicting}
                >
                  {predicting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                </Button>
              </div>
            </TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Billed</TableHead>
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
              const dynamicCost = timeEntries.filter(te => te.service === svc.name).reduce((s, te) => s + (Number(te.hours) || 0) * (Number(te.hourlyRate) || 0), 0);
              const displayCost = dynamicCost > 0 ? dynamicCost : (Number(svc.costAmount) || 0);
              const svcTotal = Number(svc.totalAmount) || 0;
              const svcMargin = svcTotal > 0 ? Math.round((svcTotal - displayCost) / svcTotal * 100) : 0;
              const pendingReqs = (svc.requirements || []).filter(r => !r.met).length;
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
                            {(svc.requirements || []).length > 0 && (
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
                                {(svc.requirements || []).filter(r => r.met).length}/{(svc.requirements || []).length} req
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={svc.status}
                            onValueChange={(val) => updateServiceStatus(svc.id, val)}
                          >
                            <SelectTrigger className="h-7 w-auto min-w-[110px] border-none bg-transparent shadow-none text-xs p-0 px-1 hover:bg-muted/40 focus:ring-0 gap-1">
                              <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sStatus.className}`}>{sStatus.label}</span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_started">Not Started</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="billed">Billed</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="dropped">Dropped</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {(svc.subServices || []).length > 0 ? (
                            <div className="flex gap-1 flex-wrap">{(svc.subServices || []).map((d) => <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">{abbreviateWorkType(d)}</Badge>)}</div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Popover open={editingBillDate === svc.id} onOpenChange={(open) => setEditingBillDate(open ? svc.id : null)}>
                            <PopoverTrigger asChild>
                              <button className="h-7 px-1 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded cursor-pointer whitespace-nowrap inline-flex items-center gap-1">
                                {svc.estimatedBillDate || "— Set date"}
                                {svc.billDateSource === "ai" && svc.estimatedBillDate && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Sparkles className="h-3 w-3 text-violet-500" />
                                      </TooltipTrigger>
                                      <TooltipContent className="text-xs max-w-[200px]">
                                        AI-suggested based on historical timelines for similar services. Click to override.
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
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
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(svc.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{displayCost > 0 ? formatCurrency(displayCost) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {svc.billedAmount > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(svc.billedAmount)}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {(() => {
                            if (displayCost === 0 && svcTotal === 0) return <span className="text-xs text-muted-foreground">—</span>;
                            return (
                              <span className={svcMargin >= 50 ? "text-emerald-600 dark:text-emerald-400 font-medium" : svcMargin < 20 ? "text-destructive font-medium" : "font-medium"}>
                                {svcMargin}%
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {svc.needsDobFiling ? (() => {
                            const filedAt = filingStatusByService[svc.id] || svc.filedDate;
                            if (filedAt) {
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                                    ✓ Filed {format(new Date(filedAt), "M/d")}
                                  </Badge>
                                  {svc.jobNumber && (
                                    <span className="text-[10px] text-muted-foreground">#{svc.jobNumber}</span>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setDobPrepService(svc)}>
                                <Building2 className="h-3 w-3" /> Submit
                              </Button>
                            );
                          })() : svc.status !== "dropped" ? (() => {
                            const filedAt = filingStatusByService[svc.id] || svc.filedDate;
                            if (filedAt) {
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                                    ✓ Filed {format(new Date(filedAt), "M/d")}
                                  </Badge>
                                  {svc.jobNumber && (
                                    <span className="text-[10px] text-muted-foreground">#{svc.jobNumber}</span>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={() => toggleDobFiling(svc.id)}>
                                Enable DOB
                              </Button>
                            );
                          })() : (
                            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={() => toggleDobFiling(svc.id)}>
                              Enable DOB
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${svc.id}-detail`} className="hover:bg-transparent">
                          <TableCell colSpan={12} className="p-0"><ServiceExpandedDetail service={svc} projectName={project.name || project.proposals?.title || ""} projectId={project.id} /></TableCell>
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
        {(billedServices.length > 0 || projectExpenses.length > 0) && (
          <>
            <TableBody>
              <TableRow className="hover:bg-transparent border-b-0">
                <TableCell colSpan={12} className="p-0">
                  <Collapsible open={showBilled} onOpenChange={setShowBilled}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground h-8 px-6 w-full justify-start rounded-none bg-amber-50/60 dark:bg-amber-950/20">
                        {showBilled ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Billed &amp; Expenses ({billedServices.length + projectExpenses.length})
                        {projectExpenses.length > 0 && (
                          <span className="ml-auto text-muted-foreground/70">
                            {billedServices.length} service · {projectExpenses.length} expense · {formatCurrency(totalBilledExpense)} exp
                          </span>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </Collapsible>
                </TableCell>
              </TableRow>
            </TableBody>
            {showBilled && (
              <TableBody>
                {billedServices.filter(s => !s.parentServiceId).map((svc) => {
                  const billedDynamicCost = timeEntries.filter(te => te.service === svc.name).reduce((s, te) => s + (Number(te.hours) || 0) * (Number(te.hourlyRate) || 0), 0);
                  const billedDisplayCost = billedDynamicCost > 0 ? billedDynamicCost : (Number(svc.costAmount) || 0);
                  const billedSvcTotal = Number(svc.totalAmount) || 0;
                  const billedMarginPct = billedSvcTotal > 0 ? Math.round((billedSvcTotal - billedDisplayCost) / billedSvcTotal * 100) : 0;
                  const isExpanded = expandedIds.has(svc.id);
                  return (
                  <Fragment key={svc.id}>
                  <TableRow className="opacity-80 cursor-pointer hover:bg-muted/20" onClick={() => toggle(svc.id)}>
                    <TableCell className="pl-6 w-[44px]" />
                    <TableCell className="pr-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="w-[28px]" />
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800">SERVICE</Badge>
                        <span className="font-medium">{svc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                        Billed{(svc.billedAt || svc.sentDate) ? ` · ${svc.billedAt || svc.sentDate}` : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell />
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(billedSvcTotal)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(billedDisplayCost)}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(svc.billedAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {billedDisplayCost === 0 && billedSvcTotal === 0 ? <span className="text-xs text-muted-foreground">—</span> : (
                        <span className={billedMarginPct >= 50 ? "text-emerald-600 dark:text-emerald-400 font-medium" : billedMarginPct < 20 ? "text-destructive font-medium" : "font-medium"}>{billedMarginPct}%</span>
                      )}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={12} className="p-0">
                        <ServiceExpandedDetail service={svc} projectName={project.name || project.proposals?.title || ""} projectId={project.id} />
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                  );
                })}
                {projectExpenses.map((e: any) => {
                  const amt = Number(e.billable_amount) || 0;
                  const isPending = e.status === "pending_approval";
                  const canRelease = e.status === "on_hold";
                  return (
                    <TableRow key={`exp-${e.id}`} className="hover:bg-muted/20">
                      <TableCell className="pl-6 w-[44px]" />
                      <TableCell className="pr-0" />
                      <TableCell className="w-[28px]" />
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800">EXPENSE</Badge>
                          <span className="font-medium">{e.description}</span>
                          {e.vendor && <span className="text-xs text-muted-foreground">· {e.vendor}</span>}
                          {e.receipt_url && (
                            <button onClick={(ev) => { ev.stopPropagation(); openExpenseReceipt(e.receipt_url); }} className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                              <FileText className="h-3 w-3" /> receipt
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isPending ? (
                          <button
                            type="button"
                            onClick={(ev) => { ev.stopPropagation(); setApproveExpenseId(e.id); }}
                            className={cn("text-[10px] px-2 py-0.5 rounded-md border", expenseStatusStyles[e.status])}
                          >
                            pending approval
                          </button>
                        ) : (
                          <Badge variant="outline" className={cn("text-[10px]", expenseStatusStyles[e.status] || "")}>{(e.status || "").replace(/_/g, " ")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">—</TableCell>
                      <TableCell />
                      <TableCell className="text-right tabular-nums font-medium">{formatCurrency(amt)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {e.status === "billed" || e.status === "paid"
                          ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(amt)}</span>
                          : "—"}
                      </TableCell>
                      <TableCell />
                      <TableCell>
                        {canRelease && (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={(ev) => { ev.stopPropagation(); releaseExpense.mutate({ expenseId: e.id }); }} disabled={releaseExpense.isPending}>
                            Release
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            )}
          </>
        )}
      </Table>
      </div>
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

      <SendToBillingDialog
        open={sendToBillingOpen}
        onOpenChange={(open) => {
          setSendToBillingOpen(open);
          if (!open) {
            setSelectedIds(new Set());
            queryClient.invalidateQueries({ queryKey: ["project-services-full"] });
          }
        }}
        preselectedProjectId={project.id}
        preselectedServiceIds={selectedIds}
      />
    </div>
  );
}
