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
  ClipboardList,
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

// --- Mock data types & data ---

interface MockApplication {
  jobNumber: string;
  type: string;
}

interface MockService {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete" | "billed";
  application: MockApplication | null;
  subServices: string[]; // disciplines: MH, PL, SP, FA, OT, GC
  totalAmount: number;
  billedAmount: number;
  assignedTo: string;
  estimatedBillDate: string | null;
  billedAt: string | null;
  scopeOfWork: string;
  notes: string;
  needsDobFiling: boolean; // whether "Start DOB NOW" should show
}

const MOCK_SERVICES_A: MockService[] = [
  {
    id: "s1",
    name: "OER Approval",
    status: "in_progress",
    application: { jobNumber: "421639356", type: "FA" },
    subServices: [],
    totalAmount: 750,
    billedAmount: 0,
    assignedTo: "Natalia S.",
    estimatedBillDate: "02/27/2026",
    billedAt: null,
    scopeOfWork: "Obtain Office of Environmental Remediation approval for the project site.",
    notes: "",
    needsDobFiling: false,
  },
  {
    id: "s2",
    name: "Work Permit",
    status: "not_started",
    application: null,
    subServices: ["OT"],
    totalAmount: 250,
    billedAmount: 0,
    assignedTo: "Natalia S.",
    estimatedBillDate: "02/27/2026",
    billedAt: null,
    scopeOfWork: "File and obtain work permit for overtime work at the site.",
    notes: "",
    needsDobFiling: true,
  },
  {
    id: "s3",
    name: "Letter of Completion",
    status: "not_started",
    application: null,
    subServices: [],
    totalAmount: 750,
    billedAmount: 0,
    assignedTo: "Natalia S.",
    estimatedBillDate: "06/30/2026",
    billedAt: null,
    scopeOfWork: "Obtain Letter of Completion from DOB upon project completion and all inspections passed.",
    notes: "",
    needsDobFiling: false,
  },
  {
    id: "s4",
    name: "Alteration Type 2 D14 Approval",
    status: "in_progress",
    application: { jobNumber: "520112847", type: "ALT2" },
    subServices: ["MH", "PL", "SP"],
    totalAmount: 4500,
    billedAmount: 0,
    assignedTo: "Natalia S.",
    estimatedBillDate: "02/27/2026",
    billedAt: null,
    scopeOfWork:
      "File the required applications and plans with the DOB.\nAttend the required plan examinations to review & resolve issued objections as required to obtain approval.",
    notes: "Waiting on structural calcs from architect for beam support.",
    needsDobFiling: false,
  },
  {
    id: "s5",
    name: "Work Permit",
    status: "not_started",
    application: null,
    subServices: ["MH"],
    totalAmount: 250,
    billedAmount: 0,
    assignedTo: "Natalia S.",
    estimatedBillDate: "02/27/2026",
    billedAt: null,
    scopeOfWork: "File and obtain mechanical work permit.",
    notes: "",
    needsDobFiling: true,
  },
  {
    id: "s6",
    name: "Letter of Completion",
    status: "not_started",
    application: null,
    subServices: [],
    totalAmount: 750,
    billedAmount: 0,
    assignedTo: "Natalia S.",
    estimatedBillDate: "06/30/2026",
    billedAt: null,
    scopeOfWork: "Obtain Letter of Completion for mechanical systems.",
    notes: "",
    needsDobFiling: false,
  },
];

const MOCK_SERVICES_B: MockService[] = [
  {
    id: "s7",
    name: "Zoning Analysis",
    status: "complete",
    application: { jobNumber: "520112847", type: "ALT2" },
    subServices: [],
    totalAmount: 1200,
    billedAmount: 1200,
    assignedTo: "Sheri L.",
    estimatedBillDate: "01/15/2026",
    billedAt: "01/18/2026",
    scopeOfWork: "Complete zoning analysis and confirm project compliance with applicable zoning resolutions.",
    notes: "Completed ahead of schedule.",
    needsDobFiling: false,
  },
  {
    id: "s8",
    name: "DOB Filing",
    status: "in_progress",
    application: { jobNumber: "520112847", type: "ALT2" },
    subServices: ["GC"],
    totalAmount: 650,
    billedAmount: 0,
    assignedTo: "Natalia S.",
    estimatedBillDate: "02/28/2026",
    billedAt: null,
    scopeOfWork: "Prepare and submit DOB application including all required documentation.",
    notes: "Square footage discrepancy — need architect confirmation. 11,300 sqft at $49k seems low.",
    needsDobFiling: false,
  },
  {
    id: "s9",
    name: "Expediting",
    status: "not_started",
    application: null,
    subServices: [],
    totalAmount: 500,
    billedAmount: 0,
    assignedTo: "Sheri L.",
    estimatedBillDate: "03/15/2026",
    billedAt: null,
    scopeOfWork: "Expedite DOB review process through plan examiner coordination.",
    notes: "",
    needsDobFiling: true,
  },
  {
    id: "s10",
    name: "Inspections Coordination",
    status: "not_started",
    application: null,
    subServices: ["GC", "MH"],
    totalAmount: 400,
    billedAmount: 0,
    assignedTo: "Natalia S.",
    estimatedBillDate: "04/30/2026",
    billedAt: null,
    scopeOfWork: "Schedule and coordinate all required DOB inspections including TR-1, TR-8, and final.",
    notes: "",
    needsDobFiling: false,
  },
];

const MOCK_SETS = [MOCK_SERVICES_A, MOCK_SERVICES_B];

function getMockServices(index: number): MockService[] {
  return MOCK_SETS[index % MOCK_SETS.length];
}

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

// --- Helpers ---

const formatCurrency = (value: number | null) => {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
};

const formatName = (profile: { first_name: string | null; last_name: string | null } | null | undefined) => {
  if (!profile) return "—";
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "—";
};

// --- Expanded service detail ---
function ServiceDetail({ service }: { service: MockService }) {
  return (
    <div className="px-6 py-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scope of Work */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Scope of Work
          </h4>
          <p className="text-sm whitespace-pre-line">{service.scopeOfWork || "No scope defined."}</p>
        </div>

        {/* Notes */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Notes
          </h4>
          {service.notes ? (
            <p className="text-sm">{service.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No notes.</p>
          )}
        </div>
      </div>

      {/* Application link */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground font-medium">Application:</span>
        {service.application ? (
          <Badge variant="outline" className="font-mono text-xs">
            #{service.application.jobNumber} {service.application.type}
          </Badge>
        ) : (
          <span className="text-muted-foreground italic">Not defined</span>
        )}
        <Button variant="link" size="sm" className="h-auto p-0 text-xs">
          Change
        </Button>
      </div>
    </div>
  );
}

// --- Component ---

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
      if (next.has(id)) {
        next.delete(id);
        // Collapse all services in this project too
        setExpandedServiceIds((sids) => {
          const newSids = new Set(sids);
          // Remove any service IDs (we'll let them all close)
          return newSids;
        });
      } else {
        next.add(id);
      }
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
            const services = getMockServices(idx);
            const total = services.reduce((s, svc) => s + svc.totalAmount, 0);
            const billed = services.reduce((s, svc) => s + svc.billedAmount, 0);
            const remaining = total - billed;

            return (
              <>
                {/* Project row */}
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleProject(project.id)}
                >
                  <TableCell className="pr-0">
                    {isProjectExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {project.project_number || "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {project.name || project.proposals?.title || "Untitled"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.properties?.address || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.clients?.name || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatName(project.assigned_pm)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatCurrency(project.proposals?.total_amount ?? null)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(project)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(project)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {onSendRfi && (
                          <DropdownMenuItem
                            disabled={isSendingRfi}
                            onClick={() => onSendRfi(project)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Send RFI
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={isDeleting}
                          onClick={() => onDelete(project.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>

                {/* Expanded services section */}
                {isProjectExpanded && (
                  <>
                    {/* Service sub-header */}
                    <TableRow key={`${project.id}-sh`} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell />
                      <TableCell className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2" />
                      <TableCell className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
                        Service
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
                        Status
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
                        Assigned
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
                        Disciplines
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
                        Est. Bill Date
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2 text-right">
                        Price
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
                        Action
                      </TableCell>
                    </TableRow>

                    {/* Service rows */}
                    {services.map((svc) => {
                      const sStatus = serviceStatusStyles[svc.status] || serviceStatusStyles.not_started;
                      const isServiceExpanded = expandedServiceIds.has(svc.id);

                      return (
                        <>
                          <TableRow
                            key={svc.id}
                            className="bg-muted/10 hover:bg-muted/20 cursor-pointer"
                            onClick={() => toggleService(svc.id)}
                          >
                            <TableCell />
                            <TableCell className="pr-0">
                              {isServiceExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {svc.name}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sStatus.className}`}
                              >
                                {sStatus.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {svc.assignedTo}
                            </TableCell>
                            <TableCell>
                              {svc.subServices.length > 0 ? (
                                <div className="flex gap-1 flex-wrap">
                                  {svc.subServices.map((d) => (
                                    <Badge
                                      key={d}
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0 font-mono"
                                    >
                                      {d}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {svc.estimatedBillDate || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-right tabular-nums font-medium">
                              {formatCurrency(svc.totalAmount)}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {svc.needsDobFiling ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={handleStartDobNow}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Start DOB NOW
                                </Button>
                              ) : svc.application ? (
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  #{svc.application.jobNumber} {svc.application.type}
                                </Badge>
                              ) : null}
                            </TableCell>
                          </TableRow>

                          {/* Expanded service detail */}
                          {isServiceExpanded && (
                            <TableRow
                              key={`${svc.id}-detail`}
                              className="bg-muted/5 hover:bg-muted/5"
                            >
                              <TableCell />
                              <TableCell colSpan={8} className="p-0">
                                <ServiceDetail service={svc} />
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}

                    {/* Job Cost Summary */}
                    <TableRow
                      key={`${project.id}-sum`}
                      className="bg-muted/20 hover:bg-muted/20 border-b"
                    >
                      <TableCell />
                      <TableCell colSpan={6} className="text-sm font-medium py-3">
                        <div className="flex items-center gap-6">
                          <span>
                            <span className="text-muted-foreground">Contract Price:</span>{" "}
                            <span className="font-semibold">{formatCurrency(total)}</span>
                          </span>
                          <Separator orientation="vertical" className="h-4" />
                          <span>
                            <span className="text-muted-foreground">Billed:</span>{" "}
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(billed)}
                            </span>
                          </span>
                          <Separator orientation="vertical" className="h-4" />
                          <span>
                            <span className="text-muted-foreground">Remaining:</span>{" "}
                            <span className="font-semibold">{formatCurrency(remaining)}</span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </>
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
