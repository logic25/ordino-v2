import type { Filing } from "@/hooks/usePortal";
import { STAGE_ORDER, STAGE_LABEL, BlockedBadge } from "./StagePill";
import { cn } from "@/lib/utils";
import { safeFormatDate } from "@/lib/dateUtils";

const DISCIPLINE_LABEL: Record<string, string> = {
  building: "Building / Alt",
  plumbing: "Plumbing",
  sprinkler: "Sprinkler",
  mechanical: "Mechanical",
  electrical: "Electrical",
  fire_alarm: "Fire Alarm",
};

export function DisciplineTimeline({ filing }: { filing: Filing }) {
  const currentIdx = STAGE_ORDER.indexOf(filing.current_stage);

  return (
    <div className={cn(
      "rounded-lg border bg-card p-4 space-y-3",
      filing.blocked && "ring-1 ring-red-300 border-red-200",
    )}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-sm">{DISCIPLINE_LABEL[filing.discipline] ?? filing.discipline}</h3>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{filing.agency}</span>
            {filing.filing_number && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs font-mono text-muted-foreground">{filing.filing_number}</span>
              </>
            )}
            {filing.blocked && <BlockedBadge reason={filing.blocked_reason} />}
          </div>
          {filing.expected_next_milestone && (
            <p className="text-xs text-muted-foreground mt-1">
              Next: <span className="text-foreground">{filing.expected_next_milestone}</span>
            </p>
          )}
        </div>
        <div className="text-right text-xs text-muted-foreground shrink-0">
          <div>Entered {safeFormatDate(filing.stage_entered_at, "MMM d")}</div>
          {filing.blocked && filing.blocked_since && (
            <div className="text-red-700 mt-0.5">Blocked {safeFormatDate(filing.blocked_since, "MMM d")}</div>
          )}
        </div>
      </div>

      {/* Horizontal stage tracker */}
      <div className="flex items-center gap-0 pt-1">
        {STAGE_ORDER.map((stage, i) => {
          const isPast = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isObj = stage === "objections";
          return (
            <div key={stage} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full ring-2 shrink-0",
                    isCurrent && isObj && "bg-amber-500 ring-amber-200",
                    isCurrent && !isObj && "bg-sky-600 ring-sky-200",
                    isPast && "bg-emerald-500 ring-emerald-100",
                    !isPast && !isCurrent && "bg-slate-200 ring-slate-100",
                  )}
                />
                <span className={cn(
                  "text-[10px] leading-tight text-center whitespace-nowrap",
                  isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
                )}>
                  {STAGE_LABEL[stage]}
                </span>
              </div>
              {i < STAGE_ORDER.length - 1 && (
                <div className={cn(
                  "h-px flex-1 mx-1 mb-4",
                  isPast ? "bg-emerald-400" : "bg-slate-200",
                )} />
              )}
            </div>
          );
        })}
      </div>

      {filing.blocked && filing.blocked_reason && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          <span className="font-medium">Blocked:</span> {filing.blocked_reason}
        </div>
      )}
    </div>
  );
}
