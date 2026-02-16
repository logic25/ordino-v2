import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  FileText,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  MessageSquare,
  Users,
  Clock,
  GitBranch,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Circle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ProjectWithRelations } from "@/hooks/useProjects";

interface ProjectTableProps {
  projects: ProjectWithRelations[];
  onEdit: (project: ProjectWithRelations) => void;
  onView: (project: ProjectWithRelations) => void;
  onDelete: (id: string) => void;
  onSendRfi?: (project: ProjectWithRelations) => void;
  isDeleting: boolean;
  isSendingRfi?: boolean;
}

// --- Mock data types ---

interface MockApplication {
  jobNumber: string;
  type: string;
}

interface MockService {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete" | "billed";
  application: MockApplication | null;
  subServices: string[];
  totalAmount: number;
  billedAmount: number;
  assignedTo: string;
  estimatedBillDate: string | null;
  billedAt: string | null;
  scopeOfWork: string;
  notes: string;
  needsDobFiling: boolean;
}

interface MockContact {
  id: string;
  name: string;
  role: string; // DOB NOW role
  company: string;
  phone: string;
  email: string;
  dobRole: "applicant" | "owner" | "filing_rep" | "architect" | "engineer" | "gc" | "other";
}

interface MockMilestone {
  id: string;
  date: string;
  event: string;
  source: "system" | "email" | "user" | "dob";
  details?: string;
}

interface MockChangeOrder {
  id: string;
  number: string;
  description: string;
  amount: number;
  status: "draft" | "pending" | "approved" | "rejected";
  createdDate: string;
  approvedDate?: string;
}

// --- Mock data ---

const MOCK_SERVICES_A: MockService[] = [
  { id: "s1", name: "OER Approval", status: "in_progress", application: { jobNumber: "421639356", type: "FA" }, subServices: [], totalAmount: 750, billedAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "Obtain Office of Environmental Remediation approval for the project site.", notes: "", needsDobFiling: false },
  { id: "s2", name: "Work Permit", status: "not_started", application: null, subServices: ["OT"], totalAmount: 250, billedAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "File and obtain work permit for overtime work at the site.", notes: "", needsDobFiling: true },
  { id: "s3", name: "Letter of Completion", status: "not_started", application: null, subServices: [], totalAmount: 750, billedAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "06/30/2026", billedAt: null, scopeOfWork: "Obtain Letter of Completion from DOB upon project completion.", notes: "", needsDobFiling: false },
  { id: "s4", name: "Alteration Type 2 D14 Approval", status: "in_progress", application: { jobNumber: "520112847", type: "ALT2" }, subServices: ["MH", "PL", "SP"], totalAmount: 4500, billedAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "File the required applications and plans with the DOB.\nAttend the required plan examinations to review & resolve issued objections as required to obtain approval.", notes: "Waiting on structural calcs from architect for beam support.", needsDobFiling: false },
  { id: "s5", name: "Work Permit", status: "not_started", application: null, subServices: ["MH"], totalAmount: 250, billedAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "02/27/2026", billedAt: null, scopeOfWork: "File and obtain mechanical work permit.", notes: "", needsDobFiling: true },
  { id: "s6", name: "Letter of Completion", status: "not_started", application: null, subServices: [], totalAmount: 750, billedAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "06/30/2026", billedAt: null, scopeOfWork: "Obtain Letter of Completion for mechanical systems.", notes: "", needsDobFiling: false },
];

const MOCK_SERVICES_B: MockService[] = [
  { id: "s7", name: "Zoning Analysis", status: "complete", application: { jobNumber: "520112847", type: "ALT2" }, subServices: [], totalAmount: 1200, billedAmount: 1200, assignedTo: "Sheri L.", estimatedBillDate: "01/15/2026", billedAt: "01/18/2026", scopeOfWork: "Complete zoning analysis and confirm project compliance.", notes: "Completed ahead of schedule.", needsDobFiling: false },
  { id: "s8", name: "DOB Filing", status: "in_progress", application: { jobNumber: "520112847", type: "ALT2" }, subServices: ["GC"], totalAmount: 650, billedAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "02/28/2026", billedAt: null, scopeOfWork: "Prepare and submit DOB application.", notes: "Square footage discrepancy — need architect confirmation.", needsDobFiling: false },
  { id: "s9", name: "Expediting", status: "not_started", application: null, subServices: [], totalAmount: 500, billedAmount: 0, assignedTo: "Sheri L.", estimatedBillDate: "03/15/2026", billedAt: null, scopeOfWork: "Expedite DOB review process.", notes: "", needsDobFiling: true },
  { id: "s10", name: "Inspections Coordination", status: "not_started", application: null, subServices: ["GC", "MH"], totalAmount: 400, billedAmount: 0, assignedTo: "Natalia S.", estimatedBillDate: "04/30/2026", billedAt: null, scopeOfWork: "Schedule and coordinate all required DOB inspections.", notes: "", needsDobFiling: false },
];

const MOCK_CONTACTS_A: MockContact[] = [
  { id: "c1", name: "Mayra Maisch", role: "Project Contact", company: "BGO", phone: "(212) 555-0101", email: "mayra@bgo.com", dobRole: "owner" },
  { id: "c2", name: "Antonio Rossi", role: "Architect of Record", company: "Rossi Architecture", phone: "(212) 555-0202", email: "antonio@rossiarch.com", dobRole: "architect" },
  { id: "c3", name: "Natalia Smith", role: "Filing Representative", company: "GLE", phone: "(212) 555-0303", email: "natalia@gle.com", dobRole: "filing_rep" },
  { id: "c4", name: "David Chen", role: "Structural Engineer", company: "Chen Engineering", phone: "(212) 555-0404", email: "david@cheneng.com", dobRole: "engineer" },
];

const MOCK_CONTACTS_B: MockContact[] = [
  { id: "c5", name: "Sarah Johnson", role: "Property Manager", company: "Brookfield Properties", phone: "(212) 555-0501", email: "sjohnson@brookfield.com", dobRole: "owner" },
  { id: "c6", name: "Mike Torres", role: "GC Superintendent", company: "Turner Construction", phone: "(212) 555-0502", email: "mtorres@turner.com", dobRole: "gc" },
  { id: "c7", name: "Sheri Lopez", role: "Filing Representative", company: "GLE", phone: "(212) 555-0503", email: "sheri@gle.com", dobRole: "filing_rep" },
];

const MOCK_MILESTONES_A: MockMilestone[] = [
  { id: "m1", date: "02/05/2026", event: "Project created from Proposal #021526-1", source: "system" },
  { id: "m2", date: "02/06/2026", event: "Natalia Smith assigned as Project Manager", source: "system" },
  { id: "m3", date: "02/07/2026", event: "Plans received from architect", source: "email", details: "Antonio sent architectural set v1" },
  { id: "m4", date: "02/10/2026", event: "DOB Application #421639356 filed (Fire Alarm)", source: "dob" },
  { id: "m5", date: "02/12/2026", event: "Objection received — missing structural calcs", source: "dob", details: "Examiner requires beam support calculations" },
  { id: "m6", date: "02/14/2026", event: "Email sent to architect requesting structural calcs", source: "email" },
];

const MOCK_MILESTONES_B: MockMilestone[] = [
  { id: "m7", date: "01/10/2026", event: "Project created from Proposal #011026-3", source: "system" },
  { id: "m8", date: "01/12/2026", event: "Zoning analysis started", source: "user" },
  { id: "m9", date: "01/18/2026", event: "Zoning analysis completed — compliant", source: "user" },
  { id: "m10", date: "01/20/2026", event: "DOB Application #520112847 filed (ALT2)", source: "dob" },
];

const MOCK_CHANGE_ORDERS_A: MockChangeOrder[] = [
  { id: "co1", number: "CO-001", description: "Additional sprinkler heads — 3rd floor scope expansion", amount: 1200, status: "approved", createdDate: "02/10/2026", approvedDate: "02/12/2026" },
  { id: "co2", number: "CO-002", description: "Structural engineer review for beam modification", amount: 800, status: "pending", createdDate: "02/14/2026" },
];

const MOCK_CHANGE_ORDERS_B: MockChangeOrder[] = [];

const MOCK_SETS = [MOCK_SERVICES_A, MOCK_SERVICES_B];
const CONTACT_SETS = [MOCK_CONTACTS_A, MOCK_CONTACTS_B];
const MILESTONE_SETS = [MOCK_MILESTONES_A, MOCK_MILESTONES_B];
const CO_SETS = [MOCK_CHANGE_ORDERS_A, MOCK_CHANGE_ORDERS_B];

// --- Status configs ---

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", variant: "default" },
  on_hold: { label: "On Hold", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
  paid: { label: "Paid", variant: "default" },
};

const serviceStatusStyles: Record<string, { label: string; className: string }> = {
  not_started: { label: "Not Started", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  complete: { label: "Complete", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  billed: { label: "Billed", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
};

const dobRoleLabels: Record<string, string> = {
  applicant: "Applicant",
  owner: "Owner",
  filing_rep: "Filing Rep",
  architect: "Architect",
  engineer: "Engineer",
  gc: "General Contractor",
  other: "Other",
};

const coStatusStyles: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

const milestoneSourceIcons: Record<string, typeof Circle> = {
  system: Circle,
  email: Mail,
  user: Pencil,
  dob: FileText,
};

// --- Helpers ---

const formatCurrency = (value: number | null) => {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);
};

const formatName = (profile: { first_name: string | null; last_name: string | null } | null | undefined) => {
  if (!profile) return "—";
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—";
};

// --- Sub-components ---

function ServiceDetail({ service }: { service: MockService }) {
  return (
    <div className="px-6 py-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Scope of Work</h4>
          <p className="text-sm whitespace-pre-line">{service.scopeOfWork || "No scope defined."}</p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Notes
          </h4>
          {service.notes ? <p className="text-sm">{service.notes}</p> : <p className="text-sm text-muted-foreground italic">No notes.</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground font-medium">Application:</span>
        {service.application ? (
          <Badge variant="outline" className="font-mono text-xs">#{service.application.jobNumber} {service.application.type}</Badge>
        ) : (
          <span className="text-muted-foreground italic">Not defined</span>
        )}
        <Button variant="link" size="sm" className="h-auto p-0 text-xs">Change</Button>
      </div>
    </div>
  );
}

function ContactsSection({ contacts }: { contacts: MockContact[] }) {
  return (
    <div className="space-y-2">
      {contacts.map((c) => (
        <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-background border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{c.name}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                  {dobRoleLabels[c.dobRole] || c.dobRole}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">{c.role} · {c.company}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
            <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Phone className="h-3 w-3" /> {c.phone}
            </a>
            <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Mail className="h-3 w-3" /> {c.email}
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineSection({ milestones }: { milestones: MockMilestone[] }) {
  return (
    <div className="space-y-0">
      {milestones.map((m, i) => {
        const Icon = milestoneSourceIcons[m.source] || Circle;
        return (
          <div key={m.id} className="flex gap-3 relative">
            {/* Vertical line */}
            {i < milestones.length - 1 && (
              <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border" />
            )}
            <div className="shrink-0 mt-1 z-10 bg-background rounded-full">
              <Icon className="h-[22px] w-[22px] p-1 rounded-full bg-muted text-muted-foreground" />
            </div>
            <div className="pb-4 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">{m.date}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{m.source}</Badge>
              </div>
              <p className="text-sm mt-0.5">{m.event}</p>
              {m.details && <p className="text-xs text-muted-foreground mt-0.5">{m.details}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChangeOrdersSection({ changeOrders }: { changeOrders: MockChangeOrder[] }) {
  if (changeOrders.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-2">No change orders yet.</p>;
  }

  const coTotal = changeOrders.filter(co => co.status === "approved").reduce((s, co) => s + co.amount, 0);

  return (
    <div className="space-y-2">
      {changeOrders.map((co) => {
        const style = coStatusStyles[co.status] || coStatusStyles.draft;
        return (
          <div key={co.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-background border">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium">{co.number}</span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0 text-[10px] font-semibold ${style.className}`}>
                  {style.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{co.description}</p>
            </div>
            <div className="text-right shrink-0 pl-4">
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

// --- Main Component ---

export function ProjectTable({ projects, onEdit, onView, onDelete, onSendRfi, isDeleting, isSendingRfi }: ProjectTableProps) {
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const [expandedServiceIds, setExpandedServiceIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const allExpanded = projects.length > 0 && expandedProjectIds.size === projects.length;

  const toggleAllProjects = () => {
    if (allExpanded) {
      setExpandedProjectIds(new Set());
      setExpandedServiceIds(new Set());
    } else {
      setExpandedProjectIds(new Set(projects.map((p) => p.id)));
    }
  };

  const toggleProject = (id: string) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleService = (id: string) => {
    setExpandedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartDobNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({ title: "Coming soon", description: "DOB NOW integration is under development." });
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleAllProjects}>
                {allExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </TableHead>
            <TableHead>Project #</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>PM</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project, idx) => {
            const status = statusConfig[project.status] || statusConfig.open;
            const isProjectExpanded = expandedProjectIds.has(project.id);
            const services = MOCK_SETS[idx % MOCK_SETS.length];
            const contacts = CONTACT_SETS[idx % CONTACT_SETS.length];
            const milestones = MILESTONE_SETS[idx % MILESTONE_SETS.length];
            const changeOrders = CO_SETS[idx % CO_SETS.length];

            const total = services.reduce((s, svc) => s + svc.totalAmount, 0);
            const billed = services.reduce((s, svc) => s + svc.billedAmount, 0);
            const remaining = total - billed;
            const approvedCOs = changeOrders.filter(co => co.status === "approved").reduce((s, co) => s + co.amount, 0);

            return (
              <>
                {/* Project row */}
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleProject(project.id)}
                >
                  <TableCell className="pr-0">
                    {isProjectExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{project.project_number || "—"}</TableCell>
                  <TableCell className="font-medium">{project.name || project.proposals?.title || "Untitled"}</TableCell>
                  <TableCell className="text-muted-foreground">{project.properties?.address || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{project.clients?.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatName(project.assigned_pm)}</TableCell>
                  <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{formatCurrency(project.proposals?.total_amount ?? null)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(project)}><Eye className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(project)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        {onSendRfi && (
                          <DropdownMenuItem disabled={isSendingRfi} onClick={() => onSendRfi(project)}>
                            <FileText className="h-4 w-4 mr-2" />Send RFI
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" disabled={isDeleting} onClick={() => onDelete(project.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>

                {/* Expanded section */}
                {isProjectExpanded && (
                  <TableRow key={`${project.id}-expanded`} className="hover:bg-transparent">
                    <TableCell />
                    <TableCell colSpan={8} className="p-0">
                      <div className="border-l-2 border-primary/30 ml-2">
                        <Tabs defaultValue="services" className="w-full">
                          <TabsList className="w-full justify-start rounded-none border-b bg-muted/20 h-9 px-4">
                            <TabsTrigger value="services" className="text-xs gap-1 data-[state=active]:bg-background">
                              <FileText className="h-3 w-3" /> Services ({services.length})
                            </TabsTrigger>
                            <TabsTrigger value="contacts" className="text-xs gap-1 data-[state=active]:bg-background">
                              <Users className="h-3 w-3" /> Contacts ({contacts.length})
                            </TabsTrigger>
                            <TabsTrigger value="timeline" className="text-xs gap-1 data-[state=active]:bg-background">
                              <Clock className="h-3 w-3" /> Timeline ({milestones.length})
                            </TabsTrigger>
                            <TabsTrigger value="change-orders" className="text-xs gap-1 data-[state=active]:bg-background">
                              <GitBranch className="h-3 w-3" /> Change Orders ({changeOrders.length})
                            </TabsTrigger>
                          </TabsList>

                          {/* Services Tab */}
                          <TabsContent value="services" className="mt-0">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                  <TableHead className="w-[30px]" />
                                  <TableHead className="text-xs uppercase tracking-wider">Service</TableHead>
                                  <TableHead className="text-xs uppercase tracking-wider">Status</TableHead>
                                  <TableHead className="text-xs uppercase tracking-wider">Assigned</TableHead>
                                  <TableHead className="text-xs uppercase tracking-wider">Disciplines</TableHead>
                                  <TableHead className="text-xs uppercase tracking-wider">Est. Bill Date</TableHead>
                                  <TableHead className="text-xs uppercase tracking-wider text-right">Price</TableHead>
                                  <TableHead className="text-xs uppercase tracking-wider">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {services.map((svc) => {
                                  const sStatus = serviceStatusStyles[svc.status] || serviceStatusStyles.not_started;
                                  const isServiceExpanded = expandedServiceIds.has(svc.id);
                                  return (
                                    <>
                                      <TableRow
                                        key={svc.id}
                                        className="cursor-pointer hover:bg-muted/20"
                                        onClick={() => toggleService(svc.id)}
                                      >
                                        <TableCell className="pr-0">
                                          {isServiceExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
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
                                        <TableCell className="text-sm text-right tabular-nums font-medium">{formatCurrency(svc.totalAmount)}</TableCell>
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
                                      {isServiceExpanded && (
                                        <TableRow key={`${svc.id}-detail`} className="hover:bg-transparent">
                                          <TableCell />
                                          <TableCell colSpan={7} className="p-0">
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
                            <div className="px-4 py-3 bg-muted/20 border-t flex items-center gap-6 text-sm">
                              <span>
                                <span className="text-muted-foreground">Contract:</span>{" "}
                                <span className="font-semibold">{formatCurrency(total)}</span>
                              </span>
                              {approvedCOs > 0 && (
                                <>
                                  <Separator orientation="vertical" className="h-4" />
                                  <span>
                                    <span className="text-muted-foreground">Change Orders:</span>{" "}
                                    <span className="font-semibold">{formatCurrency(approvedCOs)}</span>
                                  </span>
                                </>
                              )}
                              <Separator orientation="vertical" className="h-4" />
                              <span>
                                <span className="text-muted-foreground">Billed:</span>{" "}
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(billed)}</span>
                              </span>
                              <Separator orientation="vertical" className="h-4" />
                              <span>
                                <span className="text-muted-foreground">Remaining:</span>{" "}
                                <span className="font-semibold">{formatCurrency(remaining)}</span>
                              </span>
                            </div>
                          </TabsContent>

                          {/* Contacts Tab */}
                          <TabsContent value="contacts" className="mt-0 p-4">
                            <ContactsSection contacts={contacts} />
                          </TabsContent>

                          {/* Timeline Tab */}
                          <TabsContent value="timeline" className="mt-0 p-4">
                            <TimelineSection milestones={milestones} />
                          </TabsContent>

                          {/* Change Orders Tab */}
                          <TabsContent value="change-orders" className="mt-0 p-4">
                            <ChangeOrdersSection changeOrders={changeOrders} />
                          </TabsContent>
                        </Tabs>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
          {projects.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                No projects match your search.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
