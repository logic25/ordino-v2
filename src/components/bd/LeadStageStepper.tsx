import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_ORDER, STAGE_META, stageRank } from "@/components/bd/leadConstants";
import type { LeadStage } from "@/hooks/useLeads";

/**
 * Horizontal stage stepper. Shows NEW → CONTACTED → QUALIFIED → PROPOSAL → WON.
 * Click a future stage to advance (confirms when skipping >1 step).
 * Terminal states (LOST) are handled by separate buttons in the lead header.
 */
export function LeadStageStepper({
  current,
  onChange,
}: {
  current: LeadStage | null;
  onChange: (stage: LeadStage) => void;
}) {
  const currentIdx = stageRank(current);

  const tryAdvance = (stage: LeadStage, idx: number) => {
    if (idx === currentIdx) return;
    if (idx > currentIdx + 1) {
      if (!confirm(`Skip ahead to "${STAGE_META[stage].label}"? You'll bypass ${idx - currentIdx - 1} stage${idx - currentIdx - 1 === 1 ? "" : "s"}.`)) return;
    }
    onChange(stage);
  };

  return (
    <div className="flex items-center w-full overflow-x-auto py-1">
      {STAGE_ORDER.map((stage, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;
        const meta = STAGE_META[stage];
        return (
          <div key={stage} className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => tryAdvance(stage, idx)}
              disabled={isCurrent}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                isCurrent && (meta.className || "bg-primary text-primary-foreground border-primary"),
                isDone && "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
                isFuture && "bg-background text-muted-foreground border-dashed hover:bg-muted hover:text-foreground",
              )}
            >
              {isDone ? (
                <Check className="h-3 w-3" />
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px]",
                    isCurrent ? "bg-white/30" : "border",
                  )}
                >
                  {idx + 1}
                </span>
              )}
              {meta.label}
            </button>
            {idx < STAGE_ORDER.length - 1 && (
              <div
                className={cn(
                  "h-px w-4 sm:w-6 mx-0.5",
                  isDone ? "bg-green-300" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
