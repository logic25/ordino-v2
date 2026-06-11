import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesHealth, useCycleTimes } from "@/hooks/useDashboardData";
import { InfoTooltip } from "./InfoTooltip";
import { formatCurrency } from "@/lib/utils";

type Window = 30 | 60 | 90 | null;

const WINDOWS: { value: Window; label: string }[] = [
  { value: 30, label: "30d" },
  { value: 60, label: "60d" },
  { value: 90, label: "90d" },
  { value: null, label: "All" },
];

export function SalesHealthCard() {
  const [window, setWindow] = useState<Window>(60);
  const { data, isLoading } = useSalesHealth(window);
  const { data: cycle } = useCycleTimes();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-1.5">
            Sales Health
            <InfoTooltip>
              <strong>Active funnel</strong>: proposals created within the selected
              window, grouped by status.{" "}
              <strong>Conversion</strong>: rolling 6-month win rate (signed or
              executed ÷ sent). <strong>Cycle times</strong>: average days from
              proposal sent → client signed and from invoice issued → paid (last 90 days).
            </InfoTooltip>
          </CardTitle>
          <CardDescription>Pipeline, conversion, and cycle times</CardDescription>
        </div>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <Button
              key={String(w.value)}
              variant={window === w.value ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setWindow(w.value)}
            >
              {w.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Funnel */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Active Funnel
                </p>
                <div className="space-y-2">
                  {data.funnel.map((b) => {
                    const max = Math.max(1, ...data.funnel.map((x) => x.count));
                    const w = (b.count / max) * 100;
                    return (
                      <div key={b.status}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium">{b.label}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {b.count} · {formatCurrency(b.value)}
                          </span>
                        </div>
                        <div className="h-2 rounded bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary/70"
                            style={{ width: `${w}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Conversion */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Conversion (6 mo)
                </p>
                <div className="flex items-end gap-1.5 h-32">
                  {data.winRate.map((m) => {
                    const pct = Math.round(m.rate * 100);
                    return (
                      <div
                        key={m.month}
                        className="flex-1 flex flex-col items-center justify-end gap-1"
                        title={`${m.label}: ${m.won}/${m.sent} (${pct}%)`}
                      >
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {pct}%
                        </span>
                        <div
                          className="w-full bg-primary rounded-sm"
                          style={{ height: `${Math.max(2, pct)}%`, minHeight: 2 }}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {m.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cycle times footer */}
            <div className="pt-4 border-t grid gap-4 grid-cols-2 md:grid-cols-3">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Sent → Signed</p>
                <p className="text-lg font-semibold tabular-nums">
                  {data.avgSignDays} <span className="text-xs font-normal text-muted-foreground">d</span>
                  {data.signSample > 0 && (
                    <span className="text-[10px] text-muted-foreground font-normal ml-1">
                      n={data.signSample}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Invoice → Paid</p>
                <p className="text-lg font-semibold tabular-nums">
                  {cycle?.invoicePaidDays ?? 0} <span className="text-xs font-normal text-muted-foreground">d</span>
                  {(cycle?.invoiceSample ?? 0) > 0 && (
                    <span className="text-[10px] text-muted-foreground font-normal ml-1">
                      n={cycle?.invoiceSample}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Proposal → Signed (90d)</p>
                <p className="text-lg font-semibold tabular-nums">
                  {cycle?.proposalSignDays ?? 0} <span className="text-xs font-normal text-muted-foreground">d</span>
                  {(cycle?.proposalSample ?? 0) > 0 && (
                    <span className="text-[10px] text-muted-foreground font-normal ml-1">
                      n={cycle?.proposalSample}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
