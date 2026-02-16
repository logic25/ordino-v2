import { useNavigate } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Eye, FileText } from "lucide-react";
import type { ProjectWithRelations } from "@/hooks/useProjects";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "./projectMockData";

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
  const navigate = useNavigate();
  const { data: assignableProfiles = [] } = useAssignableProfiles();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handlePmChange = async (projectId: string, profileId: string) => {
    const pmId = profileId === "__unassigned__" ? null : profileId;
    const { error } = await supabase.from("projects").update({ assigned_pm_id: pmId } as any).eq("id", projectId);
    if (error) {
      toast({ title: "Error", description: "Failed to update PM.", variant: "destructive" });
    } else {
      toast({ title: "PM Updated" });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
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
          {projects.map((project) => {
            const status = statusConfig[project.status] || statusConfig.open;

            return (
              <TableRow
                key={project.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <TableCell className="font-mono text-sm">{project.project_number || "—"}</TableCell>
                <TableCell className="font-medium">{project.name || project.proposals?.title || "Untitled"}</TableCell>
                <TableCell className="text-muted-foreground">{project.properties?.address || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{project.clients?.name || "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={project.assigned_pm_id || "__unassigned__"}
                    onValueChange={(val) => handlePmChange(project.id, val)}
                  >
                    <SelectTrigger className="h-7 w-auto min-w-[110px] border-none bg-transparent shadow-none text-sm p-0 px-1 hover:bg-muted/40 focus:ring-0 gap-1 text-muted-foreground">
                      <SelectValue />
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
                </TableCell>
                <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{formatCurrency(project.proposals?.total_amount ?? null)}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}><Eye className="h-4 w-4 mr-2" />View</DropdownMenuItem>
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
            );
          })}
          {projects.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No projects match your search.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
