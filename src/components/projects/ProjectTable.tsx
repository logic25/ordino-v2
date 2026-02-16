import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Eye, FileText, ChevronRight, ChevronDown } from "lucide-react";
import type { ProjectWithRelations } from "@/hooks/useProjects";
import { ProjectExpandedTabs } from "./ProjectExpandedTabs";
import {
  SERVICE_SETS, CONTACT_SETS, MILESTONE_SETS, CO_SETS,
  EMAIL_SETS, DOCUMENT_SETS, TIME_SETS, formatCurrency,
} from "./projectMockData";

interface ProjectTableProps {
  projects: ProjectWithRelations[];
  onEdit: (project: ProjectWithRelations) => void;
  onView: (project: ProjectWithRelations) => void;
  onDelete: (id: string) => void;
  onSendRfi?: (project: ProjectWithRelations) => void;
  isDeleting: boolean;
  isSendingRfi?: boolean;
}

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

export function ProjectTable({ projects, onEdit, onView, onDelete, onSendRfi, isDeleting, isSendingRfi }: ProjectTableProps) {
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());

  const allExpanded = projects.length > 0 && expandedProjectIds.size === projects.length;

  const toggleAllProjects = () => {
    setExpandedProjectIds(allExpanded ? new Set() : new Set(projects.map((p) => p.id)));
  };

  const toggleProject = (id: string) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
            const isExpanded = expandedProjectIds.has(project.id);

            return (
              <>
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleProject(project.id)}
                >
                  <TableCell className="pr-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
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

                {isExpanded && (
                  <TableRow key={`${project.id}-expanded`} className="hover:bg-transparent">
                    <TableCell />
                    <TableCell colSpan={8} className="p-0">
                      <ProjectExpandedTabs
                        services={SERVICE_SETS[idx % SERVICE_SETS.length]}
                        contacts={CONTACT_SETS[idx % CONTACT_SETS.length]}
                        milestones={MILESTONE_SETS[idx % MILESTONE_SETS.length]}
                        changeOrders={CO_SETS[idx % CO_SETS.length]}
                        emails={EMAIL_SETS[idx % EMAIL_SETS.length]}
                        documents={DOCUMENT_SETS[idx % DOCUMENT_SETS.length]}
                        timeEntries={TIME_SETS[idx % TIME_SETS.length]}
                      />
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
