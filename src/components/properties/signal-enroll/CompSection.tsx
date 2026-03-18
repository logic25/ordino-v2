import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface Project {
  id: string;
  name: string | null;
  project_number: string | null;
}

interface CompSectionProps {
  linkedProjectId: string;
  onLinkedProjectIdChange: (val: string) => void;
  compReason: string;
  onCompReasonChange: (val: string) => void;
  projects: Project[];
  computedExpiresAt: string | null;
  status: string;
}

export function CompSection({
  linkedProjectId,
  onLinkedProjectIdChange,
  compReason,
  onCompReasonChange,
  projects,
  computedExpiresAt,
  status,
}: CompSectionProps) {
  return (
    <>
      <div className="space-y-2">
        <Label>Linked Project <span className="text-muted-foreground font-normal">(optional)</span></Label>
        {projects.length > 0 ? (
          <Select value={linkedProjectId} onValueChange={onLinkedProjectIdChange}>
            <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.project_number ? `${p.project_number} — ` : ""}{p.name || "Untitled"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">No projects for this property yet. You can link one later.</p>
        )}
        <p className="text-xs text-muted-foreground">Link when the property becomes tied to an expediting job.</p>
      </div>

      <div className="space-y-2">
        <Label>Justification</Label>
        <Textarea
          placeholder="Pre-sale monitoring, referral relationship, owner requested early monitoring..."
          value={compReason}
          onChange={(e) => onCompReasonChange(e.target.value)}
          rows={2}
        />
      </div>

      {computedExpiresAt && status === "active" && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
          Comp expires: <span className="font-medium">{format(new Date(computedExpiresAt), "MMM d, yyyy")}</span> (1 year — forces review)
        </div>
      )}
    </>
  );
}
