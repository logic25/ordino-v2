import { Badge } from "@/components/ui/badge";
import { Loader2, FolderOpen, FileText } from "lucide-react";
import { format } from "date-fns";
import { statusVariant, formatCurrency } from "./useClientRelations";

interface Props {
  projects: any[];
  proposals: any[];
  isLoading: boolean;
}

export function ClientRelationsList({ projects, proposals, isLoading }: Props) {
  return (
    <>
      {/* Projects */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <FolderOpen className="h-3.5 w-3.5" />
          Projects ({projects.length})
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects linked</p>
        ) : (
          <div className="space-y-2">
            {projects.map((project: any) => (
              <div key={project.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {project.name || project.project_number || "Untitled"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {project.properties?.address || "—"}
                  </p>
                </div>
                <Badge variant={statusVariant[project.status] || "secondary"} className="shrink-0 ml-2">
                  {project.status?.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Proposals */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Proposals ({proposals.length})
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : proposals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No proposals linked</p>
        ) : (
          <div className="space-y-2">
            {proposals.map((proposal: any) => (
              <div key={proposal.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {proposal.title || proposal.proposal_number || "Untitled"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {proposal.created_at ? format(new Date(proposal.created_at), "MMM d, yyyy") : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-sm font-medium">{formatCurrency(proposal.total_amount)}</span>
                  <Badge variant={statusVariant[proposal.status] || "secondary"}>
                    {proposal.status?.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
