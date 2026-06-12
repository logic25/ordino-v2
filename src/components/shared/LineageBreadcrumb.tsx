import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { FileText, UserPlus, Building2, FolderOpen } from "lucide-react";

interface LineageChip {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface LineageBreadcrumbProps {
  lead?: { id: string; full_name: string | null } | null;
  proposal?: { id: string; proposal_number?: string | null; title?: string | null } | null;
  client?: { id: string; name: string | null } | null;
  project?: { id: string; project_number?: string | null; name?: string | null } | null;
  prefix?: string;
  className?: string;
}

/**
 * Compact lineage row showing the chain of records this entity was created
 * from. Renders nothing when no upstream lineage exists.
 */
export function LineageBreadcrumb({
  lead, proposal, client, project, prefix = "From", className = "",
}: LineageBreadcrumbProps) {
  const chips: LineageChip[] = [];
  if (lead) chips.push({
    to: `/bd/leads/${lead.id}`,
    label: `lead · ${lead.full_name ?? "Untitled"}`,
    icon: UserPlus,
  });
  if (proposal) chips.push({
    to: `/proposals?id=${proposal.id}`,
    label: `proposal ${proposal.proposal_number ?? proposal.title ?? ""}`.trim(),
    icon: FileText,
  });
  if (client) chips.push({
    to: `/clients/${client.id}`,
    label: `client · ${client.name ?? ""}`.trim(),
    icon: Building2,
  });
  if (project) chips.push({
    to: `/projects/${project.id}`,
    label: `project ${project.project_number ?? project.name ?? ""}`.trim(),
    icon: FolderOpen,
  });
  if (chips.length === 0) return null;

  return (
    <div className={`flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground ${className}`}>
      <span>{prefix}</span>
      {chips.map((c, i) => (
        <span key={c.to} className="inline-flex items-center gap-1">
          <Link to={c.to}>
            <Badge variant="secondary" className="gap-1 hover:bg-secondary/80 cursor-pointer">
              <c.icon className="h-3 w-3" />
              {c.label}
            </Badge>
          </Link>
          {i < chips.length - 1 && <span>·</span>}
        </span>
      ))}
    </div>
  );
}
