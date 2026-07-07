import type { FilingStage } from "@/hooks/usePortal";
import { cn } from "@/lib/utils";

export const STAGE_LABEL: Record<FilingStage, string> = {
  pre_filing: "Pre-filing",
  filed: "Filed",
  in_review: "In Review",
  objections: "Objections",
  approved: "Approved",
  permit_issued: "Permit Issued",
  sign_off: "Sign-off / LOC",
};

export const STAGE_ORDER: FilingStage[] = [
  "pre_filing", "filed", "in_review", "objections", "approved", "permit_issued", "sign_off",
];

// Calm B2B palette — grey / blue / amber / green
const STAGE_CLS: Record<FilingStage, string> = {
  pre_filing:    "bg-slate-100 text-slate-700 ring-slate-200",
  filed:         "bg-sky-50 text-sky-800 ring-sky-200",
  in_review:     "bg-sky-100 text-sky-900 ring-sky-300",
  objections:    "bg-amber-100 text-amber-900 ring-amber-300",
  approved:      "bg-emerald-50 text-emerald-800 ring-emerald-200",
  permit_issued: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  sign_off:      "bg-emerald-200 text-emerald-950 ring-emerald-400",
};

export function StagePill({ stage, className }: { stage: FilingStage | null | undefined; className?: string }) {
  if (!stage) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset tabular-nums",
        STAGE_CLS[stage],
        className,
      )}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function BlockedBadge({ reason }: { reason?: string | null }) {
  return (
    <span
      title={reason ?? "Blocked"}
      className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200"
    >
      Blocked
    </span>
  );
}
