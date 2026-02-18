import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTimeReports } from "@/hooks/useReports";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { subWeeks, startOfWeek, format } from "date-fns";

const DONUT_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground))"];

function useWeeklyHoursTrend() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["weekly-hours-trend", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const now = new Date();
      const eightWeeksAgo = subWeeks(now, 8).toISOString().split("T")[0];
      const { data: entries } = await supabase
        .from("activities")
        .select("activity_date, duration_minutes, billable")
        .gte("activity_date", eightWeeksAgo);

      const weeks: { week: string; hours: number; billable: number }[] = [];
      for (let i = 7; i >= 0; i--) {
        const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
        const label = format(ws, "MMM d");
        const nextWs = startOfWeek(subWeeks(now, i - 1), { weekStartsOn: 1 });
        let hours = 0, billable = 0;
        (entries || []).forEach((e: any) => {
          const d = new Date(e.activity_date);
          if (d >= ws && d < nextWs) {
            hours += e.duration_minutes || 0;
            if (e.billable) billable += e.duration_minutes || 0;
          }
        });
        weeks.push({ week: label, hours: Math.round(hours / 60 * 10) / 10, billable: Math.round(billable / 60 * 10) / 10 });
      }
      return weeks;
    },
  });
}

export default function TimeReports() {
  const { data, isLoading } = useTimeReports();
  const { data: weeklyTrend, isLoading: weeklyLoading } = useWeeklyHoursTrend();

  if (isLoading || weeklyLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  const nonBillable = Math.round((data.totalHours - data.billableHours) * 10) / 10;
  const donutData = [
    { name: "Billable", value: data.billableHours },
    { name: "Non-Billable", value: Math.max(0, nonBillable) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Hours Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Hours</p>
              <p className="text-3xl font-bold text-foreground">{data.totalHours}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Billable Hours</p>
              <p className="text-3xl font-bold text-foreground">{data.billableHours}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Utilization Rate</p>
              <p className="text-3xl font-bold text-foreground">
                {data.totalHours > 0 ? Math.round((data.billableHours / data.totalHours) * 100) : 0}%
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Billable vs Non-Billable Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Billable Split</CardTitle>
          </CardHeader>
          <CardContent>
            {data.totalHours > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, value }) => `${name}: ${value}h`}>
                    {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}h`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">No time data</p>}
          </CardContent>
        </Card>

        {/* Team Utilization */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Team Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            {data.utilization.length > 0 ? (
              <div className="space-y-2">
                {data.utilization.slice(0, 8).map((u, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate flex-1">{u.name}</span>
                    <span className="text-muted-foreground">{u.billableHours}h / {u.totalHours}h</span>
                    <span className="ml-2 font-medium text-foreground w-12 text-right">{u.rate}%</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No time data</p>}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Hours Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weekly Hours (Last 8 Weeks)</CardTitle>
        </CardHeader>
        <CardContent>
          {weeklyTrend && weeklyTrend.some((w) => w.hours > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}h`} />
                <Legend />
                <Bar dataKey="billable" name="Billable" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="hours" name="Total" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.4} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground py-8 text-center">No weekly data yet</p>}
        </CardContent>
      </Card>
    </div>
  );
}
