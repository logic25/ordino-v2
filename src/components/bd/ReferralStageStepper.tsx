import { cn } from "@/lib/utils";
import {
  STAGE_ORDER,
  STAGE_META,
  stageRank,
  type ReferralStage,
} from "@/components/bd/referralConstants";

/**
 * Horizontal pill stepper for referral stages. Click advances stage.
 * Mirrors LeadStageStepper visual language (slate bars, amber active).
 * WON is the rightmost stage in STAGE_ORDER. LOST is handled by a separate button.
 */
export function ReferralStageStepper({
  current,
  onChange,
}: {
  current: ReferralStage;
  onChange: (stage: ReferralStage) => void;
}) {
  const currentIdx = stageRank(current);

  const tryAdvance = (stage: ReferralStage, idx: number) => {
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
                isCurrent ? "bg-amber-500" : isReached ? "bg-slate-700" : "bg-slate-200",
              )}
            />
            <div className="mt-1.5 flex items-baseline gap-1">
              <span
                className={cn(
                  "text-[10px] font-semibold tabular-nums",
                  isReached ? "text-slate-700" : "text-slate-400",
                )}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "text-xs font-medium truncate",
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
