import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { startOfMonth, subMonths } from "date-fns";

export function useProposalActivity() {
  return useQuery({
    queryKey: ["proposal-activity-mom"],
    queryFn: async () => {
      const now = new Date();
      const thisMonthStart = startOfMonth(now).toISOString();
      const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString();

      const { data: proposals } = await supabase
        .from("proposals")
        .select("id, total_amount, created_at")
        .gte("created_at", lastMonthStart);

      const thisMonth = (proposals || []).filter((p: any) => p.created_at >= thisMonthStart);
      const lastMonth = (proposals || []).filter((p: any) => p.created_at >= lastMonthStart && p.created_at < thisMonthStart);

      const thisCount = thisMonth.length;
      const lastCount = lastMonth.length;
      const thisValue = thisMonth.reduce((a: number, p: any) => a + (p.total_amount || 0), 0);
      const lastValue = lastMonth.reduce((a: number, p: any) => a + (p.total_amount || 0), 0);

      const countChange = lastCount > 0 ? Math.round(((thisCount - lastCount) / lastCount) * 100) : thisCount > 0 ? 100 : 0;
      const valueChange = lastValue > 0 ? Math.round(((thisValue - lastValue) / lastValue) * 100) : thisValue > 0 ? 100 : 0;

      return { thisCount, lastCount, thisValue, lastValue, countChange, valueChange };
    },
  });
}

export function ProposalActivityCard() {
  const { data, isLoading } = useProposalActivity();

  const TrendIcon = ({ change }: { change: number }) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const trendColor = (change: number) => change > 0 ? "text-green-600" : change < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Proposal Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : data ? (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Proposals This Month</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-foreground">{data.thisCount}</span>
                <TrendIcon change={data.countChange} />
                <span className={`text-sm font-medium ${trendColor(data.countChange)}`}>
                  {data.countChange > 0 ? "+" : ""}{data.countChange}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">vs {data.lastCount} last month</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Value This Month</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-foreground">${data.thisValue.toLocaleString()}</span>
                <TrendIcon change={data.valueChange} />
                <span className={`text-sm font-medium ${trendColor(data.valueChange)}`}>
                  {data.valueChange > 0 ? "+" : ""}{data.valueChange}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">vs ${data.lastValue.toLocaleString()} last month</p>
            </div>

            <p className="text-sm font-medium text-foreground pt-2 border-t border-border">
              {data.countChange > 0
                ? `Proposals are up ${data.countChange}% this month`
                : data.countChange < 0
                  ? `Proposals are down ${Math.abs(data.countChange)}% this month`
                  : "Proposal volume is steady"}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
