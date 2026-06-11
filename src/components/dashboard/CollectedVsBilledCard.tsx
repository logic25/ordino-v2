import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollectedVsBilledMtd } from "@/hooks/useDashboardData";
import { InfoTooltip } from "./InfoTooltip";
import { formatCurrency } from "@/lib/utils";

export function CollectedVsBilledCard() {
  const { data, isLoading } = useCollectedVsBilledMtd();

  const billed = data?.billed ?? 0;
  const collected = data?.collected ?? 0;
  const max = Math.max(1, billed, collected);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-1.5">
          Collected vs Billed
          <InfoTooltip>
            Total amount billed this month (billing requests created) vs total
            payments received this month.
          </InfoTooltip>
        </CardTitle>
        <CardDescription>Month-to-date</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-3">
            <Bar label="Billed" value={billed} max={max} color="bg-primary" />
            <Bar label="Collected" value={collected} max={max} color="bg-emerald-500" />
            <p className="text-[11px] text-muted-foreground pt-1">
              Collection rate:{" "}
              <span className="font-medium text-foreground">
                {billed > 0 ? Math.round((collected / billed) * 100) : 0}%
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const w = (value / max) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{formatCurrency(value)}</span>
      </div>
      <div className="h-2.5 rounded bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}
