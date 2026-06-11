import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCycleTimes } from "@/hooks/useDashboardData";
import { InfoTooltip } from "./InfoTooltip";
import { Clock } from "lucide-react";

export function CycleTimesCard() {
  const { data, isLoading } = useCycleTimes();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          Cycle Times
          <InfoTooltip>
            Average days from proposal sent → client signed, and invoice issued
            → paid, over the last 90 days.
          </InfoTooltip>
        </CardTitle>
        <CardDescription>Last 90 days</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Metric
              label="Proposal → Signed"
              days={data.proposalSignDays}
              sample={data.proposalSample}
            />
            <Metric
              label="Invoice → Paid"
              days={data.invoicePaidDays}
              sample={data.invoiceSample}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, days, sample }: { label: string; days: number; sample: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">
        {sample > 0 ? `${days}d` : "—"}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {sample > 0 ? `n=${sample}` : "No data"}
      </p>
    </div>
  );
}
