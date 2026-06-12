import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DollarSign, Calendar } from "lucide-react";
import { useBdEvents, type BdEvent, type EventStatus } from "@/hooks/useBdEvents";

const fmt = (n: number) =>
  `$${Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

// Sai-approved status semantics:
//   INVESTED   = REGISTERED + ATTENDED  (we committed; money out the door)
//   CONSIDERING = PENDING_APPROVAL + APPROVED  (in the funnel, not yet acted)
const INVESTED: EventStatus[] = ["REGISTERED", "ATTENDED"];
const CONSIDERING: EventStatus[] = ["PENDING_APPROVAL", "APPROVED"];

function eventCost(e: BdEvent): number {
  if (e.included_in_membership) return 0;
  return Number(
    e.cost_actual ?? e.cost_member ?? e.cost_nonmember ?? e.cost_low ?? 0,
  );
}

export function EventBudgetSummary() {
  const { data: events = [], isLoading } = useBdEvents();
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

  const scoped = useMemo(
    () => events.filter((e) => {
      if (!e.start_date) return false;
      return new Date(e.start_date).getFullYear() === year;
    }),
    [events, year],
  );

  // Belt-and-suspenders: anything we've actually paid for (or that's membership-included)
  // counts as Invested regardless of status. Catches stale APPROVED rows where the user
  // already entered a real cost.
  const isInvested = (e: BdEvent) =>
    INVESTED.includes(e.status) ||
    (e.cost_actual != null && Number(e.cost_actual) > 0) ||
    (e.included_in_membership === true && !!e.start_date);
  const invested = scoped.filter(isInvested);
  const considering = scoped.filter((e) => CONSIDERING.includes(e.status) && !isInvested(e));

  const investedTotal = invested.reduce((s, e) => s + eventCost(e), 0);
  const consideringTotal = considering.reduce((s, e) => s + eventCost(e), 0);

  const includedCount = scoped.filter((e) => e.included_in_membership).length;
  const oopCount = scoped.filter((e) => !e.included_in_membership).length;

  // By status breakdown
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

  // By "paid by" user (Invested only)
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
        <span className="text-xs text-muted-foreground">{scoped.length} events</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-green-600" />
              Invested
              <span className="text-xs font-normal text-muted-foreground">
                (registered + attended)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{fmt(investedTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {invested.length} events · {includedCount} membership-included this year
            </p>
            {byPayer.length > 0 && (
              <div className="pt-2 border-t space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Who paid
                </p>
                {byPayer.map(([uid, total]) => (
                  <div key={uid ?? "none"} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {uid ? `User ${uid.slice(0, 8)}…` : "Unattributed"}
                    </span>
                    <span className="tabular-nums">{fmt(total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-blue-600" />
              Considering
              <span className="text-xs font-normal text-muted-foreground">
                (pending + approved)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">{fmt(consideringTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {considering.length} events in the funnel
            </p>
            <div className="pt-2 border-t space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Cost type
              </p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Membership-included</span>
                <span>{includedCount}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Out-of-pocket</span>
                <span>{oopCount}</span>
              </div>
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
                <span className="tabular-nums">{fmt(v.total)}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
