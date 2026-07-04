/**
 * Pure bonus math — REVENUE projection. Used by My Earnings + Admin rollup
 * (event + new-client are accrued by DB triggers).
 */

export interface CompPlan {
  revenue_bonus_pct: number;
  revenue_window_months: number;
}

/** Project 2% (or plan rate) of paid invoices in window that come from clients
 *  originating from this person's BD-sourced leads. Input is already filtered. */
export function projectRevenueBonus(paidInvoices: { paid_at: string | null; payment_amount: number | null; total_due: number | null }[], plan: CompPlan): number {
  const cutoff = Date.now() - plan.revenue_window_months * 30 * 86400_000;
  let total = 0;
  for (const inv of paidInvoices) {
    if (!inv.paid_at) continue;
    if (new Date(inv.paid_at).getTime() < cutoff) continue;
    total += Number(inv.payment_amount ?? inv.total_due ?? 0);
  }
  return Math.round(total * (plan.revenue_bonus_pct / 100) * 100) / 100;
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
