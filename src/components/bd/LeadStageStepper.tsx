import { cn } from "@/lib/utils";
import { STAGE_ORDER, STAGE_META, stageRank } from "@/components/bd/leadConstants";
import type { LeadStage } from "@/hooks/useLeads";

/**
 * Horizontal stage stepper rendered as segment bars (v3 architectural-editorial style).
 * Each stage is a thin top-border bar with a label underneath.
 * Click any stage to advance; confirms when skipping >1 step.
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
      if (
        !confirm(
          `Skip ahead to "${STAGE_META[stage].label}"? You'll bypass ${idx - currentIdx - 1} stage${
            idx - currentIdx - 1 === 1 ? "" : "s"
          }.`,
        )
      )
        return;
    }
    onChange(stage);
  };

  return (
    <div className="flex items-stretch gap-1.5 w-full">
      {STAGE_ORDER.map((stage, idx) => {
        const isReached = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        const meta = STAGE_META[stage];
        return (
          <button
            key={stage}
            type="button"
            onClick={() => tryAdvance(stage, idx)}
            disabled={isCurrent}
            className="group flex-1 text-left transition-opacity hover:opacity-80 disabled:cursor-default disabled:opacity-100"
            title={meta.label}
          >
            <div
              className={cn(
                "h-1 w-full rounded-full transition-colors",
                isReached ? "bg-amber-500" : "bg-amber-100",
                isCurrent && "bg-amber-600",
              )}
            />
            <div className="mt-2 flex items-baseline gap-1.5">
              <span
                className={cn(
                  "text-[10px] font-bold tabular-nums",
                  isReached ? "text-amber-700" : "text-slate-400",
                )}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-wider",
                  isCurrent ? "text-slate-900" : isReached ? "text-slate-700" : "text-slate-400",
                )}
              >
                {meta.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
