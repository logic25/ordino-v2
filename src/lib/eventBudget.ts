// Shared event-budget helpers — single source of truth used by both the
// Events summary strip (BdEvents.tsx) and the Budget tab (EventBudgetSummary.tsx).
// Keep this file thin — semantics here drive the Invested KPI and must not drift.
import type { BdEvent, EventStatus } from "@/hooks/useBdEvents";

// Sai-approved status semantics — do not change without checking the spec:
//
//   INVESTED    = status IN ('REGISTERED','ATTENDED')
//                 OR cost_actual > 0
//                 OR included_in_membership = true
//   CONSIDERING = status IN ('PENDING_APPROVAL','APPROVED')
//                 AND NOT already captured by INVESTED   ← no double-count
export const INVESTED_STATUSES: EventStatus[] = ["REGISTERED", "ATTENDED"];
export const CONSIDERING_STATUSES: EventStatus[] = ["PENDING_APPROVAL", "APPROVED"];

export function isInvested(e: BdEvent): boolean {
  return (
    INVESTED_STATUSES.includes(e.status) ||
    (e.cost_actual != null && Number(e.cost_actual) > 0) ||
    e.included_in_membership === true
  );
}

export function isConsidering(e: BdEvent): boolean {
  if (isInvested(e)) return false; // explicit de-dupe
  return CONSIDERING_STATUSES.includes(e.status);
}

export function eventCost(e: BdEvent): number {
  if (e.included_in_membership) return 0;
  return Number(
    e.cost_actual ?? e.cost_member ?? e.cost_nonmember ?? e.cost_low ?? 0,
  );
}

export function fmtMoney0(n: number): string {
  return `$${Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function scopeToYear(events: BdEvent[], year: number): BdEvent[] {
  return events.filter((e) => {
    if (!e.start_date) return false;
    return new Date(e.start_date).getFullYear() === year;
  });
}
