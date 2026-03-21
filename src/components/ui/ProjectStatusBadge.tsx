import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const projectStatusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-success/10 text-success border-success/30" },
  on_hold: { label: "On Hold", className: "bg-warning/10 text-warning border-warning/30" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground border-border" },
  paid: { label: "Paid", className: "bg-primary/10 text-primary border-primary/30" },
};

interface ProjectStatusBadgeProps {
  status: string | null;
  className?: string;
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  if (!status) return null;
  const config = projectStatusConfig[status] || {
    label: status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    className: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", config.className, className)}>
      {config.label}
    </Badge>
  );
}
