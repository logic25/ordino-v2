import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOperationsReports } from "@/hooks/useReports";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { subMonths, startOfMonth, format, differenceInDays } from "date-fns";
import { AlertTriangle } from "lucide-react";

function useOperationsTrends() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["operations-trends", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: projects } = await supabase.from("projects").select("id, status, created_at, updated_at");
      const now = new Date();
      const items = projects || [];

      // Monthly completion rate (last 12 months)
      const completionTrend: { month: string; completed: number; total: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = startOfMonth(subMonths(now, i));
        const label = format(d, "MMM yy");
        const created = items.filter((p: any) => format(startOfMonth(new Date(p.created_at)), "MMM yy") === label);
        const closed = items.filter((p: any) => p.status === "closed" && p.updated_at && format(startOfMonth(new Date(p.updated_at)), "MMM yy") === label);
        completionTrend.push({ month: label, completed: closed.length, total: created.length });
      }

      // Stalled projects (open, no update in 30+ days)
      const stalled = items
        .filter((p: any) => p.status === "open" && p.updated_at && differenceInDays(now, new Date(p.updated_at)) > 30)
        .map((p: any) => ({ id: p.id, daysSinceUpdate: differenceInDays(now, new Date(p.updated_at)) }))
        .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
        .slice(0, 10);

      return { completionTrend, stalled };
    },
  });
}

export default function OperationsReports() {
  const { data, isLoading } = useOperationsReports();
  const { data: trends, isLoading: trendsLoading } = useOperationsTrends();

  if (isLoading || trendsLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Client Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Clients by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {data.clientActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.clientActivity} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground">No client data</p>}
          </CardContent>
        </Card>

        {/* Team Workload */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Team Workload</CardTitle>
          </CardHeader>
          <CardContent>
            {data.teamWorkload.length > 0 ? (
              <div className="space-y-3">
                {data.teamWorkload.map((member, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="font-medium text-foreground">{member.name}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{member.active} active</span>
                      {member.upcoming > 0 && (
                        <span className="text-accent font-medium">{member.upcoming} due soon</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No workload data</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Completion Rate Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Project Completion Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trends && trends.completionTrend.some((m) => m.total > 0 || m.completed > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trends.completionTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" name="Created" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
                  <Bar dataKey="completed" name="Completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">No data yet</p>}
          </CardContent>
        </Card>

        {/* Stalled Projects */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Stalled Projects (30+ days inactive)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trends && trends.stalled.length > 0 ? (
              <div className="space-y-2">
                {trends.stalled.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-foreground font-mono truncate">{p.id.slice(0, 8)}…</span>
                    <span className="text-sm text-destructive font-medium">{p.daysSinceUpdate} days</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">No stalled projects 🎉</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
