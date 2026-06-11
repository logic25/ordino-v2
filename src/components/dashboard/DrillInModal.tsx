import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";

export interface DrillInRow {
  id: string;
  primary: string;
  secondary?: string;
  badge?: { label: string; tone?: "default" | "warning" | "danger" | "success" };
  href?: string;
}

export interface DrillInSummary {
  label: string;
  value: string | number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  summary?: DrillInSummary[];
  loading?: boolean;
  rows: DrillInRow[];
  emptyMessage?: string;
}

const TONE: Record<string, string> = {
  default: "bg-muted text-muted-foreground",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-destructive/15 text-destructive",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function DrillInModal({
  open,
  onOpenChange,
  title,
  description,
  summary,
  loading,
  rows,
  emptyMessage = "Nothing to show.",
}: Props) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}{rows.length > 0 ? ` (${rows.length})` : ""}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {summary && summary.length > 0 && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 border-b pb-4">
            {summary.map((s) => (
              <div key={s.label}>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">{emptyMessage}</p>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => {
                const Inner: ReactNode = (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.primary}</p>
                      {r.secondary && (
                        <p className="text-xs text-muted-foreground truncate">{r.secondary}</p>
                      )}
                    </div>
                    {r.badge && (
                      <span className={`text-xs px-2 py-0.5 rounded ${TONE[r.badge.tone || "default"]}`}>
                        {r.badge.label}
                      </span>
                    )}
                    {r.href && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                );
                return (
                  <li key={r.id}>
                    {r.href ? (
                      <button
                        onClick={() => { onOpenChange(false); navigate(r.href!); }}
                        className="w-full text-left hover:bg-muted/40 px-2 -mx-2 rounded-md transition-colors"
                      >
                        {Inner}
                      </button>
                    ) : (
                      <div className="px-2 -mx-2">{Inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
