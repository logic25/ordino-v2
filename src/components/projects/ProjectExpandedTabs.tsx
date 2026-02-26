import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, Users, Clock, GitBranch, Mail, Phone,
  ChevronRight, ChevronDown, ExternalLink, MessageSquare,
  Pencil, Circle, ArrowUpRight, ArrowDownLeft,
  File, Upload, CheckCircle2, CircleDot, DollarSign,
  Send, XCircle, CheckCheck, StickyNote, Sparkles, ClipboardList,
} from "lucide-react";
import { ActionItemsTab } from "./ActionItemsTab";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useTimelineEvents } from "@/hooks/useTimelineEvents";
import { useToast } from "@/hooks/use-toast";
import type {
  MockService, MockContact, MockMilestone, MockChangeOrder,
  MockEmail, MockDocument, MockTimeEntry,
} from "./projectMockData";
import {
  serviceStatusStyles, dobRoleLabels, coStatusStyles, formatCurrency,
  engineerDisciplineLabels,
} from "./projectMockData";

// --- Props ---

interface ProjectExpandedTabsProps {
  services: MockService[];
  contacts: MockContact[];
  milestones: MockMilestone[];
  changeOrders: MockChangeOrder[];
  emails: MockEmail[];
  documents: MockDocument[];
  timeEntries: MockTimeEntry[];
  projectId?: string;
}

// --- Service Detail ---

function ServiceDetail({ service }: { service: MockService }) {
  return (
    <div className="px-6 py-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Scope of Work (Internal)</h4>
          <p className="text-sm whitespace-pre-line">{service.scopeOfWork || "No scope defined."}</p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Job Description (DOB)</h4>
          {service.jobDescription ? (
            <p className="text-sm whitespace-pre-line">{service.jobDescription}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No job description — required for DOB filing.</p>
          )}
        </div>
      </div>

      {/* Estimated Costs by discipline */}
      {service.estimatedCosts && service.estimatedCosts.length > 0 && (
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Est. Cost:</span>
          {service.estimatedCosts.map((ec, i) => (
            <span key={i} className="text-sm">{ec.discipline}: <span className="font-semibold" data-clarity-mask="true">${ec.amount.toLocaleString()}</span></span>
          ))}
        </div>
      )}

      {/* Tasks / To-dos */}
      {service.tasks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Tasks
          </h4>
          <div className="space-y-1.5">
            {service.tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={task.done} className="h-3.5 w-3.5" />
                <span className={task.done ? "line-through text-muted-foreground" : ""}>{task.text}</span>
                {task.assignedTo && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">{task.assignedTo}</Badge>
                )}
                {task.dueDate && (
                  <span className="text-[10px] text-muted-foreground">{task.dueDate}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground font-medium">Application:</span>
        {service.application ? (
          <Badge variant="outline" className="font-mono text-xs">#{service.application.jobNumber} {service.application.type}</Badge>
        ) : (
          <span className="text-muted-foreground italic">Not filed yet</span>
        )}
        <Button variant="link" size="sm" className="h-auto p-0 text-xs">Change</Button>
      </div>
    </div>
  );
}

// --- Services Tab ---

function ServicesTab({ services }: { services: MockService[] }) {
  const [expandedServiceIds, setExpandedServiceIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleService = (id: string) => {
    setExpandedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === services.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(services.map((s) => s.id)));
    }
  };

  const handleBulkAction = (action: string) => {
    toast({ title: action, description: `${selectedIds.size} service(s) selected. This action will be wired to the backend.` });
  };

  const handleStartDobNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({ title: "Coming soon", description: "DOB NOW integration is under development." });
  };

  const total = services.reduce((s, svc) => s + svc.totalAmount, 0);
  const billed = services.reduce((s, svc) => s + svc.billedAmount, 0);
  const cost = services.reduce((s, svc) => s + svc.costAmount, 0);
  const remaining = total - billed;

  return (
    <div>
      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 border-b flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">{selectedIds.size} selected:</span>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleBulkAction("Send to Billing")}>
            <Send className="h-3 w-3" /> Send to Billing
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleBulkAction("Mark as Approved")}>
            <CheckCheck className="h-3 w-3" /> Mark Approved
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive border-destructive/30" onClick={() => handleBulkAction("Drop Service")}>
            <XCircle className="h-3 w-3" /> Drop
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[40px]">
              <Checkbox
                checked={selectedIds.size === services.length && services.length > 0}
                onCheckedChange={toggleSelectAll}
                className="h-3.5 w-3.5"
              />
            </TableHead>
            <TableHead className="w-[30px]" />
            <TableHead className="text-xs uppercase tracking-wider">Service</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Assigned</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Disciplines</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Est. Bill Date</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-right">Price</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-right">Cost</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((svc) => {
            const sStatus = serviceStatusStyles[svc.status] || serviceStatusStyles.not_started;
            const isExpanded = expandedServiceIds.has(svc.id);
            const margin = svc.totalAmount > 0 ? ((svc.totalAmount - svc.costAmount) / svc.totalAmount * 100) : 0;

            return (
              <>
                <TableRow
                  key={svc.id}
                  className="cursor-pointer hover:bg-muted/20"
                  onClick={() => toggleService(svc.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(svc.id)}
                      onCheckedChange={() => toggleSelect(svc.id)}
                      className="h-3.5 w-3.5"
                    />
                  </TableCell>
                  <TableCell className="pr-0">
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{svc.name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sStatus.className}`}>{sStatus.label}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{svc.assignedTo}</TableCell>
                  <TableCell>
                    {svc.subServices.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {svc.subServices.map((d) => (
                          <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">{d}</Badge>
                        ))}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{svc.estimatedBillDate || "—"}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-medium" data-clarity-mask="true">{formatCurrency(svc.totalAmount)}</TableCell>
                   <TableCell className="text-sm text-right tabular-nums text-muted-foreground" data-clarity-mask="true">
                    {svc.costAmount > 0 ? formatCurrency(svc.costAmount) : "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {svc.needsDobFiling ? (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleStartDobNow}>
                        <ExternalLink className="h-3 w-3" />Start DOB NOW
                      </Button>
                    ) : svc.application ? (
                      <Badge variant="outline" className="font-mono text-[10px]">#{svc.application.jobNumber} {svc.application.type}</Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${svc.id}-detail`} className="hover:bg-transparent">
                    <TableCell />
                    <TableCell colSpan={9} className="p-0">
                      <ServiceDetail service={svc} />
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>

      {/* Job Cost Summary */}
      <div className="px-4 py-3 bg-muted/20 border-t flex items-center gap-6 text-sm flex-wrap">
        <span><span className="text-muted-foreground">Contract:</span> <span className="font-semibold" data-clarity-mask="true">{formatCurrency(total)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Billed:</span> <span className="font-semibold text-emerald-600 dark:text-emerald-400" data-clarity-mask="true">{formatCurrency(billed)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Remaining:</span> <span className="font-semibold" data-clarity-mask="true">{formatCurrency(remaining)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Cost:</span> <span className="font-semibold" data-clarity-mask="true">{formatCurrency(cost)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Margin:</span> <span className="font-semibold">{total > 0 ? `${Math.round((total - cost) / total * 100)}%` : "—"}</span></span>
      </div>
    </div>
  );
}

// --- Contacts Tab ---

function ContactsTab({ contacts }: { contacts: MockContact[] }) {
  const { toast } = useToast();

  const handleEdit = (contact: MockContact) => {
    toast({ title: "Edit Contact", description: `Editing ${contact.name} — form coming soon.` });
  };

  const handleDelete = (contact: MockContact) => {
    toast({ title: "Delete Contact", description: `${contact.name} would be removed from this project.`, variant: "destructive" });
  };

  return (
    <div className="p-4 space-y-2">
      {contacts.map((c) => (
        <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-background border group">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{c.name}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{dobRoleLabels[c.dobRole]}</Badge>
              {c.dobRole === "engineer" && c.discipline && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  {engineerDisciplineLabels[c.discipline]}
                </Badge>
              )}
              {c.dobRegistered === "not_registered" && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">Not DOB Registered</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{c.role} · {c.company}</div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
            <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Phone className="h-3 w-3" /> {c.phone}
            </a>
            <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Mail className="h-3 w-3" /> {c.email}
            </a>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(c)}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDelete(c)}>
                <XCircle className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Timeline Tab ---

function TimelineTab({ projectId }: { projectId?: string }) {
  const { data: events = [], isLoading } = useTimelineEvents(projectId);
  const eventIcons: Record<string, typeof Circle> = {
    action_item_created: ClipboardList,
    action_item_completed: CheckCircle2,
    co_created: GitBranch,
    co_signed_internally: CircleDot,
    co_sent_to_client: Send,
    co_client_signed: CheckCheck,
    co_approved: CheckCircle2,
    co_voided: XCircle,
    co_rejected: XCircle,
  };

  if (isLoading) return <p className="text-sm text-muted-foreground italic p-4">Loading timeline...</p>;
  if (events.length === 0) return <p className="text-sm text-muted-foreground italic p-4">No timeline events yet.</p>;

  return (
    <div className="p-4 space-y-0">
      {events.map((ev, i) => {
        const Icon = eventIcons[ev.event_type] || Circle;
        const actorName = ev.actor?.display_name || ev.actor?.first_name || "System";
        const date = new Date(ev.created_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
        const time = new Date(ev.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        return (
          <div key={ev.id} className="flex gap-3 relative">
            {i < events.length - 1 && <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border" />}
            <div className="shrink-0 mt-1 z-10 bg-background rounded-full">
              <Icon className="h-[22px] w-[22px] p-1 rounded-full bg-muted text-muted-foreground" />
            </div>
            <div className="pb-4 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">{date} {time}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{ev.event_type.replace(/_/g, " ")}</Badge>
              </div>
              <p className="text-sm mt-0.5">{ev.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Change Orders Tab ---

function ChangeOrdersTab({ changeOrders }: { changeOrders: MockChangeOrder[] }) {
  if (changeOrders.length === 0) return <p className="text-sm text-muted-foreground italic p-4">No change orders yet.</p>;
  const coTotal = changeOrders.filter(co => co.status === "approved").reduce((s, co) => s + co.amount, 0);
  return (
    <div className="p-4 space-y-2">
      {changeOrders.map((co) => {
        const style = coStatusStyles[co.status] || coStatusStyles.draft;
        return (
          <div key={co.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-background border">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium">{co.number}</span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0 text-[10px] font-semibold ${style.className}`}>{style.label}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{co.description}</p>
            </div>
            <div className="text-right shrink-0 pl-4" data-clarity-mask="true">
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(co.amount)}</span>
              <div className="text-[10px] text-muted-foreground">{co.createdDate}</div>
            </div>
          </div>
        );
      })}
      {coTotal > 0 && (
        <div className="text-xs text-muted-foreground pt-1">
          Approved change orders: <span className="font-semibold text-foreground">{formatCurrency(coTotal)}</span>
        </div>
      )}
    </div>
  );
}

// --- Emails Tab ---

function EmailsTab({ emails }: { emails: MockEmail[] }) {
  if (emails.length === 0) return <p className="text-sm text-muted-foreground italic p-4">No tagged emails.</p>;
  return (
    <div className="p-4 space-y-2">
      {emails.map((em) => (
        <div key={em.id} className="flex items-start gap-3 py-2 px-3 rounded-md bg-background border">
          <div className="shrink-0 mt-1">
            {em.direction === "inbound" ? (
              <ArrowDownLeft className="h-4 w-4 text-blue-500" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 justify-between">
              <span className="text-sm font-medium truncate">{em.subject}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{em.date}</span>
            </div>
            <div className="text-xs text-muted-foreground">{em.from}</div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{em.snippet}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Documents Tab ---

function DocumentsTab({ documents }: { documents: MockDocument[] }) {
  if (documents.length === 0) return <p className="text-sm text-muted-foreground italic p-4">No documents uploaded.</p>;
  return (
    <div className="p-4 space-y-2">
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-background border">
          <div className="flex items-center gap-2 min-w-0">
            <File className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <span className="text-sm font-medium truncate block">{doc.name}</span>
              <span className="text-[10px] text-muted-foreground">{doc.uploadedBy} · {doc.uploadedDate}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{doc.type}</Badge>
            <span>{doc.size}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Time Logs Tab ---

function TimeLogsTab({ timeEntries }: { timeEntries: MockTimeEntry[] }) {
  if (timeEntries.length === 0) return <p className="text-sm text-muted-foreground italic p-4">No time logged.</p>;
  const totalHours = timeEntries.reduce((s, t) => s + t.hours, 0);
  return (
    <div className="p-4">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs uppercase tracking-wider">Date</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Team Member</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Service</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Description</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-right">Hours</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {timeEntries.map((te) => (
            <TableRow key={te.id} className="hover:bg-muted/20">
              <TableCell className="text-sm font-mono">{te.date}</TableCell>
              <TableCell className="text-sm">{te.user}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{te.service}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{te.description}</TableCell>
              <TableCell className="text-sm text-right tabular-nums font-medium">{te.hours.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="pt-2 text-xs text-muted-foreground text-right">
        Total: <span className="font-semibold text-foreground">{totalHours.toFixed(2)} hrs</span>
      </div>
    </div>
  );
}

// --- Job Costing Tab ---

function JobCostingTab({ services, timeEntries }: { services: MockService[]; timeEntries: MockTimeEntry[] }) {
  const contractTotal = services.reduce((s, svc) => s + svc.totalAmount, 0);
  const costTotal = services.reduce((s, svc) => s + svc.costAmount, 0);
  const totalHours = timeEntries.reduce((s, t) => s + t.hours, 0);
  const margin = contractTotal > 0 ? ((contractTotal - costTotal) / contractTotal * 100) : 0;

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Contract Price", value: formatCurrency(contractTotal) },
          { label: "Total Cost", value: formatCurrency(costTotal) },
          { label: "Gross Profit", value: formatCurrency(contractTotal - costTotal) },
          { label: "Margin", value: `${Math.round(margin)}%` },
          { label: "Total Hours", value: `${totalHours.toFixed(1)} hrs` },
        ].map((stat) => (
          <div key={stat.label} className="bg-background border rounded-md p-3">
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className="text-lg font-semibold mt-0.5">{stat.value}</div>
          </div>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs uppercase tracking-wider">Service</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-right">Price</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-right">Cost</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-right">Margin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((svc) => {
            const sMargin = svc.totalAmount > 0 ? ((svc.totalAmount - svc.costAmount) / svc.totalAmount * 100) : 0;
            return (
              <TableRow key={svc.id} className="hover:bg-muted/20">
                <TableCell className="text-sm font-medium">{svc.name}</TableCell>
                <TableCell className="text-sm text-right tabular-nums">{formatCurrency(svc.totalAmount)}</TableCell>
                <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{svc.costAmount > 0 ? formatCurrency(svc.costAmount) : "—"}</TableCell>
                <TableCell className="text-sm text-right tabular-nums">
                  {svc.costAmount > 0 ? (
                    <span className={sMargin > 50 ? "text-emerald-600 dark:text-emerald-400" : sMargin < 20 ? "text-red-600 dark:text-red-400" : ""}>
                      {Math.round(sMargin)}%
                    </span>
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

// --- Notes Tab ---

function NotesTab({ services }: { services: MockService[] }) {
  const [manualNote, setManualNote] = useState("");
  const [notes, setNotes] = useState<Array<{ id: string; text: string; source: "ai" | "manual"; date: string }>>([
    {
      id: "ai-1",
      text: "Project is awaiting final sealed drawings from architect (promised by 02/20). Client has requested expedited timeline and overrode recommendation to wait. ACP5 asbestos inspection scheduled for 02/18 via EcoTest Labs. Pre-filing meeting with DOB examiner requested. Plan review coordination is complete — zoning and code compliance confirmed. Change Order CO-001 approved for $600 (expedited filing). CO-002 pending for lead paint survey ($450).",
      source: "ai",
      date: "02/16/2026",
    },
    {
      id: "manual-1",
      text: "Margaret is pushing hard on timeline — need to manage expectations about DOB review times. Discussed with Don about potential plan exam vs pro-cert route.",
      source: "manual",
      date: "02/14/2026",
    },
  ]);
  const { toast } = useToast();

  const addNote = () => {
    if (!manualNote.trim()) return;
    setNotes((prev) => [
      { id: `manual-${Date.now()}`, text: manualNote.trim(), source: "manual", date: new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) },
      ...prev,
    ]);
    setManualNote("");
    toast({ title: "Note added" });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Add note */}
      <div className="space-y-2">
        <Textarea
          placeholder="Add a project note..."
          value={manualNote}
          onChange={(e) => setManualNote(e.target.value)}
          className="min-h-[80px] text-sm"
        />
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={addNote} disabled={!manualNote.trim()}>
            <StickyNote className="h-3.5 w-3.5" /> Add Note
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => toast({ title: "AI Summary", description: "AI will analyze requirements, tasks, and activity to generate a project summary." })}
          >
            <Sparkles className="h-3.5 w-3.5" /> Generate AI Summary
          </Button>
        </div>
      </div>

      <Separator />

      {/* Notes list */}
      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id} className="p-3 rounded-lg border bg-background">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant={note.source === "ai" ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0 gap-1">
                {note.source === "ai" ? <><Sparkles className="h-2.5 w-2.5" /> AI Summary</> : <><StickyNote className="h-2.5 w-2.5" /> Manual</>}
              </Badge>
              <span className="text-[10px] text-muted-foreground font-mono">{note.date}</span>
            </div>
            <p className="text-sm whitespace-pre-line">{note.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main Exported Component ---

export function ProjectExpandedTabs({
  services, contacts, milestones, changeOrders, emails, documents, timeEntries, projectId,
}: ProjectExpandedTabsProps) {
  const approvedCOs = changeOrders.filter(co => co.status === "approved").reduce((s, co) => s + co.amount, 0);
  const contractTotal = services.reduce((s, svc) => s + svc.totalAmount, 0);
  const adjustedTotal = contractTotal + approvedCOs;
  const billed = services.reduce((s, svc) => s + svc.billedAmount, 0);
  const cost = services.reduce((s, svc) => s + svc.costAmount, 0);

  return (
    <div className="border-l-2 border-primary/30 ml-2">
      {/* Project cost summary bar */}
      <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-5 text-xs flex-wrap">
        <span><span className="text-muted-foreground">Total Project Value:</span> <span className="font-bold text-sm">{formatCurrency(adjustedTotal)}</span></span>
        {approvedCOs > 0 && (
          <span className="text-muted-foreground">(Contract: {formatCurrency(contractTotal)} + COs: {formatCurrency(approvedCOs)})</span>
        )}
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Billed:</span> <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(billed)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Remaining:</span> <span className="font-semibold">{formatCurrency(adjustedTotal - billed)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Cost:</span> <span className="font-semibold">{formatCurrency(cost)}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Margin:</span> <span className="font-semibold">{adjustedTotal > 0 ? `${Math.round((adjustedTotal - cost) / adjustedTotal * 100)}%` : "—"}</span></span>
      </div>

      <Tabs defaultValue="services" className="w-full">
        <div className="overflow-x-auto border-b bg-muted/20">
        <TabsList className="w-max justify-start rounded-none bg-transparent h-9 px-4 gap-0">
          <TabsTrigger value="services" className="text-xs gap-1 data-[state=active]:bg-background">
            <FileText className="h-3 w-3" /> Services ({services.length})
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs gap-1 data-[state=active]:bg-background">
            <StickyNote className="h-3 w-3" /> Notes
          </TabsTrigger>
          <TabsTrigger value="emails" className="text-xs gap-1 data-[state=active]:bg-background">
            <Mail className="h-3 w-3" /> Emails ({emails.length})
          </TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs gap-1 data-[state=active]:bg-background">
            <Users className="h-3 w-3" /> Contacts ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs gap-1 data-[state=active]:bg-background">
            <Clock className="h-3 w-3" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs gap-1 data-[state=active]:bg-background">
            <File className="h-3 w-3" /> Docs ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="time-logs" className="text-xs gap-1 data-[state=active]:bg-background">
            <Clock className="h-3 w-3" /> Time ({timeEntries.length})
          </TabsTrigger>
          <TabsTrigger value="change-orders" className="text-xs gap-1 data-[state=active]:bg-background">
            <GitBranch className="h-3 w-3" /> COs ({changeOrders.length})
          </TabsTrigger>
          {projectId && (
            <TabsTrigger value="action-items" className="text-xs gap-1 data-[state=active]:bg-background">
              <ClipboardList className="h-3 w-3" /> Tasks
            </TabsTrigger>
          )}
          <TabsTrigger value="job-costing" className="text-xs gap-1 data-[state=active]:bg-background">
            <DollarSign className="h-3 w-3" /> Job Costing
          </TabsTrigger>
          {projectId && (
            <TabsTrigger value="chat" className="text-xs gap-1 data-[state=active]:bg-background">
              <MessageSquare className="h-3 w-3" /> Chat
            </TabsTrigger>
          )}
        </TabsList>
        </div>

        <TabsContent value="services" className="mt-0"><ServicesTab services={services} /></TabsContent>
        <TabsContent value="notes" className="mt-0"><NotesTab services={services} /></TabsContent>
        <TabsContent value="emails" className="mt-0"><EmailsTab emails={emails} /></TabsContent>
        <TabsContent value="contacts" className="mt-0"><ContactsTab contacts={contacts} /></TabsContent>
        <TabsContent value="timeline" className="mt-0"><TimelineTab projectId={projectId} /></TabsContent>
        <TabsContent value="documents" className="mt-0"><DocumentsTab documents={documents} /></TabsContent>
        <TabsContent value="time-logs" className="mt-0"><TimeLogsTab timeEntries={timeEntries} /></TabsContent>
        <TabsContent value="change-orders" className="mt-0"><ChangeOrdersTab changeOrders={changeOrders} /></TabsContent>
        {projectId && (
          <TabsContent value="action-items" className="mt-0"><ActionItemsTab projectId={projectId} /></TabsContent>
        )}
        <TabsContent value="job-costing" className="mt-0"><JobCostingTab services={services} timeEntries={timeEntries} /></TabsContent>
        {projectId && (
          <TabsContent value="chat" className="mt-0">
            <div className="h-[400px]">
              <ChatPanel compact className="h-full" />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
