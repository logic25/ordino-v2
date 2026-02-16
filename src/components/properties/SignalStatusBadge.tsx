import { Badge } from "@/components/ui/badge";
import { Radio } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  trial: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  prospect: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  expired: "bg-red-500/10 text-red-600 border-red-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trial: "Trial",
  prospect: "Prospect",
  expired: "Expired",
};

interface SignalStatusBadgeProps {
  status: string | null;
  showIcon?: boolean;
}

export function SignalStatusBadge({ status, showIcon = true }: SignalStatusBadgeProps) {
  if (!status) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  return (
    <Badge variant="outline" className={`gap-1 ${STATUS_STYLES[status] || "bg-muted text-muted-foreground"}`}>
      {showIcon && <Radio className="h-3 w-3" />}
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}
