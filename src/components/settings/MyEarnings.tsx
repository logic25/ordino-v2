import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useBdBonusLedger, useBdCompPlanFor, useIsCompAdmin,
} from "@/hooks/useBdComp";
import { money, projectRevenueBonus } from "@/lib/bdComp";

/**
 * "My Earnings" tab — gated to self + comp-admin. Never renders base salary.
 * BD bonuses only: event $250 × eligible, new-client $1,000 (or 50% if <$2k),
 * 2% projected from PAID invoices in window for clients originating from this
 * person's BD-sourced leads.
 */
export function MyEarnings({ personId }: { personId?: string }) {
  const { profile } = useAuth();
  const isCompAdmin = useIsCompAdmin();
  const target = personId ?? profile?.id;
  const canView = !!target && (isCompAdmin || target === profile?.id);

  const plan = useBdCompPlanFor(target);
  const ledger = useBdBonusLedger(target);

  // Paid invoices for clients tied to this person's BD-sourced leads
  const paidR = useQuery({
    queryKey: ["bd-revenue-invoices", profile?.company_id, target, plan?.revenue_window_months],
    enabled: !!profile?.company_id && !!target && !!plan,
    queryFn: async () => {
      const { data: leads } = await supabase
        .from("leads")
        .select("client_id")
        .eq("company_id", profile!.company_id)
        .eq("bd_sourced", true)
        .or(`assigned_to.eq.${target},created_by.eq.${target}`)
        .not("client_id", "is", null);
      const clientIds = Array.from(new Set((leads ?? []).map((l) => l.client_id))).filter(Boolean) as string[];
      if (!clientIds.length) return [];
      const { data: invs } = await supabase
        .from("invoices")
        .select("paid_at, payment_amount, total_due, status, client_id")
        .in("client_id", clientIds)
        .eq("status", "paid");
      return invs ?? [];
    },
  });

  const totals = useMemo(() => {
    const rows = ledger.data ?? [];
    const sumByType = (t: string) => rows.filter((r) => r.type === t).reduce((s, r) => s + Number(r.amount), 0);
    return {
      event: sumByType("EVENT"),
      newClient: sumByType("NEW_CLIENT"),
      ledgerRevenue: sumByType("REVENUE"),
    };
  }, [ledger.data]);

  if (!canView) {
    return <p className="text-sm text-muted-foreground">Not authorized to view earnings.</p>;
  }

  const projectedRev = plan && paidR.data
    ? projectRevenueBonus(paidR.data as any[], plan)
    : 0;

  return (
    <div className="space-y-4">
      {!plan && <p className="text-sm text-muted-foreground">No comp plan set up yet.</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Event bonuses</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{money(totals.event)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">New-client bonuses</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{money(totals.newClient)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Projected revenue bonus</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{money(projectedRev)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{plan?.revenue_bonus_pct ?? 2}% of paid invoices · {plan?.revenue_window_months ?? 12}mo window</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Bonus ledger</CardTitle></CardHeader>
        <CardContent>
          {ledger.isLoading ? <Skeleton className="h-20" /> : (ledger.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No accrued bonuses yet.</p>
          ) : (
            <div className="space-y-2">
              {(ledger.data ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div className="text-sm">
                    <Badge variant="outline" className="mr-2 text-[10px]">{r.type}</Badge>
                    <span>{r.notes ?? r.type}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-medium">{money(Number(r.amount))}</span>
                    <Badge
                      variant="outline"
                      className={
                        r.status === "PAID" ? "border-emerald-300 text-emerald-700"
                        : r.status === "APPROVED" ? "border-amber-300 text-amber-700"
                        : "border-slate-300 text-slate-700"
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default MyEarnings;
