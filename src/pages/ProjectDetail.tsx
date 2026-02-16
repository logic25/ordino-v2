import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Pencil, FileText, Users, Clock, Mail,
  File, GitBranch, DollarSign, MapPin, Building2, User,
  Loader2, ExternalLink,
} from "lucide-react";
import { useProjects, ProjectWithRelations } from "@/hooks/useProjects";
import { ProjectExpandedTabs } from "@/components/projects/ProjectExpandedTabs";
import {
  SERVICE_SETS, CONTACT_SETS, MILESTONE_SETS, CO_SETS,
  EMAIL_SETS, DOCUMENT_SETS, TIME_SETS, formatCurrency,
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

  // Calculated values
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
                {project.project_number && (
                  <span className="font-mono">{project.project_number}</span>
                )}
                {project.properties?.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {project.properties.address}
                  </span>
                )}
                {project.clients?.name && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" /> {project.clients.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> PM: {formatName(project.assigned_pm)}
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Edit Project
          </Button>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Contract</div>
              <div className="text-xl font-bold mt-1">{formatCurrency(contractTotal)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Change Orders</div>
              <div className="text-xl font-bold mt-1">{approvedCOs > 0 ? `+${formatCurrency(approvedCOs)}` : "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total Value</div>
              <div className="text-xl font-bold mt-1">{formatCurrency(adjustedTotal)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Billed</div>
              <div className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatCurrency(billed)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Internal Cost</div>
              <div className="text-xl font-bold mt-1">{formatCurrency(cost)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Margin</div>
              <div className={`text-xl font-bold mt-1 ${margin > 50 ? "text-emerald-600 dark:text-emerald-400" : margin < 20 ? "text-red-600 dark:text-red-400" : ""}`}>
                {margin}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabbed Content — Property Guard style: full width, spacious */}
        <Card>
          <Tabs defaultValue="services" className="w-full">
            <TabsList className="w-full justify-start rounded-none rounded-t-lg border-b bg-muted/20 h-11 px-4 flex-wrap gap-1">
              <TabsTrigger value="services" className="gap-1.5 data-[state=active]:bg-background">
                <FileText className="h-3.5 w-3.5" /> Services ({services.length})
              </TabsTrigger>
              <TabsTrigger value="emails" className="gap-1.5 data-[state=active]:bg-background">
                <Mail className="h-3.5 w-3.5" /> Emails ({emails.length})
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
                <EmailsFull emails={emails} />
              </TabsContent>
              <TabsContent value="contacts" className="mt-0">
                <ContactsFull contacts={contacts} />
              </TabsContent>
              <TabsContent value="timeline" className="mt-0">
                <TimelineFull milestones={milestones} />
              </TabsContent>
              <TabsContent value="documents" className="mt-0">
                <DocumentsFull documents={documents} />
              </TabsContent>
              <TabsContent value="time-logs" className="mt-0">
                <TimeLogsFull timeEntries={timeEntries} />
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

// Re-use existing tab components from ProjectExpandedTabs but import as a barrel
// For now we duplicate the rendering inline with more spacious Property Guard-inspired layout

import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronRight, ChevronDown, MessageSquare, CheckCircle2,
  ArrowUpRight, ArrowDownLeft, Upload, Send, XCircle, CheckCheck,
  Phone, CircleDot, Circle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type {
  MockService, MockContact, MockMilestone, MockChangeOrder,
  MockEmail, MockDocument, MockTimeEntry,
} from "@/components/projects/projectMockData";
import {
  serviceStatusStyles, dobRoleLabels, coStatusStyles,
} from "@/components/projects/projectMockData";

// ---- Services (Property Guard style — expandable rows with nested detail) ----

function ServiceExpandedDetail({ service }: { service: MockService }) {
  return (
    <div className="px-8 py-5 space-y-5 bg-muted/10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Dates & Permit style */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Scope of Work
          </h4>
          <p className="text-sm leading-relaxed whitespace-pre-line">{service.scopeOfWork || "No scope defined."}</p>
        </div>

        {/* Application info — like Property Guard's Applicant section */}
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

        {/* Notes */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Notes
          </h4>
          {service.notes ? <p className="text-sm leading-relaxed">{service.notes}</p> : <p className="text-sm text-muted-foreground italic">No notes.</p>}
        </div>
      </div>

      {/* Tasks */}
      {service.tasks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Tasks ({service.tasks.length})
          </h4>
          <div className="space-y-2">
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
    </div>
  );
}

function ServicesFull({ services }: { services: MockService[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggle = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelect = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleBulk = (action: string) => {
    toast({ title: action, description: `${selectedIds.size} service(s) selected.` });
  };

  const total = services.reduce((s, svc) => s + svc.totalAmount, 0);
  const billed = services.reduce((s, svc) => s + svc.billedAmount, 0);
  const cost = services.reduce((s, svc) => s + svc.costAmount, 0);

  return (
    <div>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-6 py-3 bg-muted/40 border-b flex-wrap">
          <span className="text-sm text-muted-foreground font-medium">{selectedIds.size} selected:</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleBulk("Send to Billing")}>
            <Send className="h-3.5 w-3.5" /> Send to Billing
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleBulk("Mark Approved")}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark Approved
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30" onClick={() => handleBulk("Drop Service")}>
            <XCircle className="h-3.5 w-3.5" /> Drop
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[44px] pl-6">
              <Checkbox
                checked={selectedIds.size === services.length && services.length > 0}
                onCheckedChange={() => selectedIds.size === services.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(services.map(s => s.id)))}
                className="h-4 w-4"
              />
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

            return (
              <> 
                <TableRow
                  key={svc.id}
                  className="cursor-pointer hover:bg-muted/20"
                  onClick={() => toggle(svc.id)}
                >
                  <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(svc.id)} onCheckedChange={() => toggleSelect(svc.id)} className="h-4 w-4" />
                  </TableCell>
                  <TableCell className="pr-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="font-medium">{svc.name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sStatus.className}`}>{sStatus.label}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{svc.assignedTo}</TableCell>
                  <TableCell>
                    {svc.subServices.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {svc.subServices.map((d) => (
                          <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">{d}</Badge>
                        ))}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{svc.estimatedBillDate || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(svc.totalAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{svc.costAmount > 0 ? formatCurrency(svc.costAmount) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {svc.costAmount > 0 ? (
                      <span className={svcMargin > 50 ? "text-emerald-600 dark:text-emerald-400" : svcMargin < 20 ? "text-red-600 dark:text-red-400" : ""}>
                        {svcMargin}%
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {svc.needsDobFiling ? (
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" /> Start DOB NOW
                      </Button>
                    ) : svc.application ? (
                      <Badge variant="outline" className="font-mono text-xs">#{svc.application.jobNumber}</Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow key={`${svc.id}-detail`} className="hover:bg-transparent">
                    <TableCell colSpan={11} className="p-0">
                      <ServiceExpandedDetail service={svc} />
                    </TableCell>
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
        <Separator orientation="vertical" className="h-4" />
        <span><span className="text-muted-foreground">Margin:</span> <span className="font-semibold">{total > 0 ? `${Math.round((total - cost) / total * 100)}%` : "—"}</span></span>
      </div>
    </div>
  );
}

// ---- Contacts (spacious cards with DOB role mapping) ----

function ContactsFull({ contacts }: { contacts: MockContact[] }) {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      {contacts.map((c) => (
        <div key={c.id} className="flex items-start justify-between p-4 rounded-lg bg-background border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{c.name}</span>
              <Badge variant="secondary" className="text-xs">{dobRoleLabels[c.dobRole]}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">{c.role} · {c.company}</div>
          </div>
          <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground shrink-0">
            <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Phone className="h-3.5 w-3.5" /> {c.phone}
            </a>
            <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <Mail className="h-3.5 w-3.5" /> {c.email}
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Timeline ----

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

// ---- Emails ----

function EmailsFull({ emails }: { emails: MockEmail[] }) {
  if (emails.length === 0) return <p className="text-sm text-muted-foreground italic p-6">No tagged emails.</p>;
  return (
    <div className="p-6 space-y-3">
      {emails.map((em) => (
        <div key={em.id} className="flex items-start gap-4 p-4 rounded-lg bg-background border">
          <div className="shrink-0 mt-0.5">
            {em.direction === "inbound" ? <ArrowDownLeft className="h-4 w-4 text-blue-500" /> : <ArrowUpRight className="h-4 w-4 text-emerald-500" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium truncate">{em.subject}</span>
              <span className="text-xs text-muted-foreground shrink-0">{em.date}</span>
            </div>
            <div className="text-sm text-muted-foreground">{em.from}</div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{em.snippet}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Documents ----

function DocumentsFull({ documents }: { documents: MockDocument[] }) {
  if (documents.length === 0) return <p className="text-sm text-muted-foreground italic p-6">No documents uploaded.</p>;
  return (
    <div className="p-6">
      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="h-3.5 w-3.5" /> Upload
        </Button>
      </div>
      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-3 min-w-0">
              <File className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <span className="font-medium truncate block">{doc.name}</span>
                <span className="text-xs text-muted-foreground">{doc.uploadedBy} · {doc.uploadedDate}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0">
              <Badge variant="outline" className="text-xs">{doc.type}</Badge>
              <span className="text-xs">{doc.size}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Time Logs ----

function TimeLogsFull({ timeEntries }: { timeEntries: MockTimeEntry[] }) {
  if (timeEntries.length === 0) return <p className="text-sm text-muted-foreground italic p-6">No time logged.</p>;
  const totalHours = timeEntries.reduce((s, t) => s + t.hours, 0);
  return (
    <div className="p-6">
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
      <div className="pt-3 text-sm text-muted-foreground text-right">
        Total: <span className="font-semibold text-foreground">{totalHours.toFixed(2)} hrs</span>
      </div>
    </div>
  );
}

// ---- Change Orders ----

function ChangeOrdersFull({ changeOrders }: { changeOrders: MockChangeOrder[] }) {
  if (changeOrders.length === 0) return <p className="text-sm text-muted-foreground italic p-6">No change orders yet.</p>;
  const coTotal = changeOrders.filter(co => co.status === "approved").reduce((s, co) => s + co.amount, 0);
  return (
    <div className="p-6 space-y-3">
      {changeOrders.map((co) => {
        const style = coStatusStyles[co.status] || coStatusStyles.draft;
        return (
          <div key={co.id} className="flex items-center justify-between p-4 rounded-lg bg-background border">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">{co.number}</span>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.className}`}>{style.label}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{co.description}</p>
            </div>
            <div className="text-right shrink-0 pl-6">
              <span className="text-lg font-semibold tabular-nums">{formatCurrency(co.amount)}</span>
              <div className="text-xs text-muted-foreground">{co.createdDate}</div>
            </div>
          </div>
        );
      })}
      {coTotal > 0 && (
        <div className="text-sm text-muted-foreground pt-1">
          Approved total: <span className="font-semibold text-foreground">{formatCurrency(coTotal)}</span>
        </div>
      )}
    </div>
  );
}

// ---- Job Costing ----

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
