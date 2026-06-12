import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { useBdEvents, type EventStatus } from "@/hooks/useBdEvents";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import {
  isInvested, eventCost, fmtMoney0, scopeToYear,
} from "@/lib/eventBudget";

// Budget tab — analytical breakdown only. The glance (Invested / Considering)
// lives on the Events tab as a summary strip. Don't reintroduce headline cards
// here; this view is "who paid / reimbursement / by-status totals" only.
export function EventBudgetSummary() {
  const { data: events = [], isLoading } = useBdEvents();
  const { data: profiles = [] } = useCompanyProfiles();

  const profileNameByUserId = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => {
      const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
      if (p.user_id) m.set(p.user_id, full || p.email || "Unknown");
    });
    return m;
  }, [profiles]);

  const years = useMemo(() => {
    const set = new Set<number>();
    events.forEach((e) => {
      const y = e.start_date ? new Date(e.start_date).getFullYear() : null;
      if (y) set.add(y);
    });
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [events]);

  const [year, setYear] = useState<number>(new Date().getFullYear());

  const scoped = useMemo(() => scopeToYear(events, year), [events, year]);

  const invested = scoped.filter(isInvested);
  const includedCount = scoped.filter((e) => e.included_in_membership).length;
  const oopCount = scoped.filter((e) => !e.included_in_membership).length;
  const includedTotal = scoped
    .filter((e) => e.included_in_membership)
    .reduce((s, e) => s + Number(e.cost_actual ?? e.cost_member ?? 0), 0);
  const oopTotal = invested
    .filter((e) => !e.included_in_membership)
    .reduce((s, e) => s + eventCost(e), 0);

  const byStatus = useMemo(() => {
    const map = new Map<EventStatus, { count: number; total: number }>();
    scoped.forEach((e) => {
      const cur = map.get(e.status) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += eventCost(e);
      map.set(e.status, cur);
    });
    return Array.from(map.entries());
  }, [scoped]);

  // By "paid by" user (Invested only) — resolve UUID to real name.
  const byPayer = useMemo(() => {
    const map = new Map<string | null, number>();
    invested.forEach((e) => {
      const k = e.paid_by_user_id ?? null;
      map.set(k, (map.get(k) ?? 0) + eventCost(e));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [invested]);

  if (isLoading) {
    return <Card className="p-6 text-sm text-muted-foreground">Loading budget…</Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {scoped.length} events · glance totals live on the Events tab
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Who paid (Invested)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {byPayer.length === 0 && (
              <p className="text-xs text-muted-foreground">No invested events yet.</p>
            )}
            {byPayer.map(([uid, total]) => {
              const name = uid
                ? (profileNameByUserId.get(uid) || "Unknown user")
                : "Unattributed";
              return (
                <div key={uid ?? "none"} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="tabular-nums">{fmtMoney0(total)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cost type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Membership-included</span>
              <span className="tabular-nums">{includedCount} · {fmtMoney0(includedTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Out-of-pocket (invested)</span>
              <span className="tabular-nums">{oopCount} · {fmtMoney0(oopTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">By status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {byStatus.length === 0 && (
              <p className="text-sm text-muted-foreground">No events in {year}.</p>
            )}
            {byStatus.map(([status, v]) => (
              <Badge key={status} variant="outline" className="gap-1.5 py-1.5">
                <span className="font-medium">{status}</span>
                <span className="text-muted-foreground">{v.count}</span>
                <span className="tabular-nums">{fmtMoney0(v.total)}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
