import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTodaySummary, useWeekSummary, formatMinutes } from "@/hooks/useTimeEntries";
import { useTodayAttendance } from "@/hooks/useAttendance";
import { Clock, CalendarDays, TrendingUp } from "lucide-react";

export function TimeSummaryCards() {
  const { data: todaySummary } = useTodaySummary();
  const { data: weekSummary } = useWeekSummary();
  const { data: attendance } = useTodayAttendance();

  const todayTotal = todaySummary?.totalMinutes ?? 0;
  const weekTotal = weekSummary?.totalMinutes ?? 0;
  const weekBillable = weekSummary?.billableMinutes ?? 0;
  const billableRate = weekTotal > 0 ? Math.round((weekBillable / weekTotal) * 100) : 0;

  // Gap detection: clocked hours vs attributed hours
  const clockedMinutes = attendance?.total_minutes ?? 0;
  const gapMinutes = clockedMinutes > 0 ? Math.max(0, clockedMinutes - todayTotal) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tabular-nums">{formatMinutes(todayTotal)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {todaySummary?.entries ?? 0} entries logged
          </p>
          {gapMinutes > 0 && (
            <p className="text-xs text-warning font-medium mt-1">
              {formatMinutes(gapMinutes)} unattributed
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tabular-nums">{formatMinutes(weekTotal)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Target: 40:00
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Billable Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{billableRate}%</div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatMinutes(weekBillable)} billable this week
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
