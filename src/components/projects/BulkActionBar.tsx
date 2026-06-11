import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, Loader2 } from "lucide-react";
import { useAssignableProfiles } from "@/hooks/useProfiles";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  onSetStatus: (status: string) => void;
  onAssignPm: (pmId: string | null) => void;
  isBusy?: boolean;
}

export function BulkActionBar({ count, onClear, onSetStatus, onAssignPm, isBusy }: BulkActionBarProps) {
  const { data: profiles = [] } = useAssignableProfiles();
  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-card shadow-lg px-4 py-2.5">
      <span className="text-sm font-medium">
        {count} selected
      </span>
      <div className="h-5 w-px bg-border" />

      <Select onValueChange={onSetStatus} disabled={isBusy}>
        <SelectTrigger className="h-8 w-[140px]">
          <SelectValue placeholder="Set status…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="on_hold">On Hold</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
        </SelectContent>
      </Select>

      <Select onValueChange={(v) => onAssignPm(v === "__unassigned__" ? null : v)} disabled={isBusy}>
        <SelectTrigger className="h-8 w-[160px]">
          <SelectValue placeholder="Assign PM…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__unassigned__">Unassigned</SelectItem>
          {profiles.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.user_id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isBusy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

      <Button variant="ghost" size="sm" onClick={onClear} className="gap-1">
        <X className="h-3.5 w-3.5" />
        Clear
      </Button>
    </div>
  );
}
