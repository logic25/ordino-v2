import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye } from "lucide-react";

type DashboardRole = "admin" | "pm" | "accounting" | "manager";

interface RolePreviewSelectorProps {
  currentRole: string;
  previewRole: DashboardRole;
  onPreviewChange: (role: DashboardRole) => void;
}

const roleLabels: Record<string, string> = {
  admin: "Admin",
  pm: "Project Manager",
  accounting: "Accounting",
  manager: "Manager",
};

export function RolePreviewSelector({ currentRole, previewRole, onPreviewChange }: RolePreviewSelectorProps) {
  if (currentRole !== "admin") return null;

  return (
    <div className="flex items-center gap-2">
      <Eye className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Viewing as:</span>
      <Select value={previewRole} onValueChange={(v) => onPreviewChange(v as DashboardRole)}>
        <SelectTrigger className="w-[160px] h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(roleLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
