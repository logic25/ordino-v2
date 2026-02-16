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
import { MoreHorizontal, Pencil, Trash2, Eye, FileText, ChevronRight, ChevronDown, ExternalLink } from "lucide-react";
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
  type: string; // e.g. "FA", "ALT2"
}

interface MockService {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "complete" | "billed";
  application: MockApplication | null;
  totalAmount: number;
  billedAmount: number;
}

const MOCK_SERVICES_A: MockService[] = [
  { id: "s1", name: "Application Filing", status: "billed", application: { jobNumber: "421639356", type: "FA" }, totalAmount: 800, billedAmount: 800 },
  { id: "s2", name: "Plan Review", status: "billed", application: { jobNumber: "421639356", type: "FA" }, totalAmount: 200, billedAmount: 200 },
  { id: "s3", name: "Inspections Coordination", status: "in_progress", application: { jobNumber: "421639356", type: "FA" }, totalAmount: 300, billedAmount: 0 },
  { id: "s4", name: "Sign-off Obtainment", status: "not_started", application: null, totalAmount: 250, billedAmount: 0 },
];

const MOCK_SERVICES_B: MockService[] = [
  { id: "s5", name: "Zoning Analysis", status: "complete", application: { jobNumber: "520112847", type: "ALT2" }, totalAmount: 1200, billedAmount: 1200 },
  { id: "s6", name: "DOB Filing", status: "in_progress", application: { jobNumber: "520112847", type: "ALT2" }, totalAmount: 650, billedAmount: 0 },
  { id: "s7", name: "Expediting", status: "not_started", application: null, totalAmount: 500, billedAmount: 0 },
  { id: "s8", name: "Landmark Review", status: "not_started", application: null, totalAmount: 400, billedAmount: 0 },
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

// --- Component ---

export function ProjectTable({ projects, onEdit, onView, onDelete, onSendRfi, isDeleting, isSendingRfi }: ProjectTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const allExpanded = projects.length > 0 && expandedIds.size === projects.length;

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(projects.map((p) => p.id)));
    }
  };

  const toggleRow = (id: string) => {
    setExpandedIds((prev) => {
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
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleAll}>
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
            const isExpanded = expandedIds.has(project.id);
            const services = getMockServices(idx);
            const total = services.reduce((s, svc) => s + svc.totalAmount, 0);
            const billed = services.reduce((s, svc) => s + svc.billedAmount, 0);
            const remaining = total - billed;

            return (
              <>
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleRow(project.id)}
                >
                  <TableCell className="pr-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
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

                {isExpanded && (
                  <>
                    {/* Nested header */}
                    <TableRow key={`${project.id}-sh`} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell />
                      <TableCell colSpan={2} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
                        Service
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
                        Status
                      </TableCell>
                      <TableCell colSpan={2} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">
                        Application
                      </TableCell>
                      <TableCell colSpan={2} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2 text-right">
                        Amount
                      </TableCell>
                      <TableCell />
                    </TableRow>

                    {/* Service rows */}
                    {services.map((svc) => {
                      const sStatus = serviceStatusStyles[svc.status] || serviceStatusStyles.not_started;
                      return (
                        <TableRow key={svc.id} className="bg-muted/10 hover:bg-muted/20 border-b-0">
                          <TableCell />
                          <TableCell colSpan={2} className="text-sm pl-6">
                            {svc.name}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sStatus.className}`}>
                              {sStatus.label}
                            </span>
                          </TableCell>
                          <TableCell colSpan={2}>
                            {svc.application ? (
                              <Badge variant="outline" className="font-mono text-xs">
                                #{svc.application.jobNumber} {svc.application.type}
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={handleStartDobNow}
                              >
                                <ExternalLink className="h-3 w-3" />
                                Start DOB NOW
                              </Button>
                            )}
                          </TableCell>
                          <TableCell colSpan={2} className="text-sm text-right tabular-nums">
                            {formatCurrency(svc.totalAmount)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      );
                    })}

                    {/* Billing summary */}
                    <TableRow key={`${project.id}-sum`} className="bg-muted/20 hover:bg-muted/20 border-b">
                      <TableCell />
                      <TableCell colSpan={5} className="text-sm font-medium">
                        <span className="text-muted-foreground">Total:</span>{" "}
                        <span className="font-semibold">{formatCurrency(total)}</span>
                        <span className="mx-3 text-muted-foreground">|</span>
                        <span className="text-muted-foreground">Billed:</span>{" "}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(billed)}</span>
                        <span className="mx-3 text-muted-foreground">|</span>
                        <span className="text-muted-foreground">Remaining:</span>{" "}
                        <span className="font-semibold">{formatCurrency(remaining)}</span>
                      </TableCell>
                      <TableCell colSpan={3} />
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
