import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjectReports } from "@/hooks/useReports";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { subMonths, startOfMonth, format, differenceInDays } from "date-fns";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))", "hsl(var(--destructive))"];

function useProjectTrends() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["project-creation-trend", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: projects } = await supabase.from("projects").select("id, status, created_at, updated_at");
      const now = new Date();
      const items = projects || [];

      // Monthly creation trend (12 months)
      const monthlyCreation: { month: string; count: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = startOfMonth(subMonths(now, i));
        const label = format(d, "MMM yy");
        const count = items.filter((p: any) => format(startOfMonth(new Date(p.created_at)), "MMM yy") === label).length;
        monthlyCreation.push({ month: label, count });
      }

      // Average project duration (created to last updated for closed projects)
      const closed = items.filter((p: any) => p.status === "closed" && p.created_at && p.updated_at);
      const avgDuration = closed.length > 0
        ? Math.round(closed.reduce((a: number, p: any) => a + differenceInDays(new Date(p.updated_at), new Date(p.created_at)), 0) / closed.length)
        : 0;

      return { monthlyCreation, avgDuration, closedCount: closed.length };
    },
  });
}

export default function ProjectReports() {
  const { data, isLoading } = useProjectReports();
  const { data: trends, isLoading: trendsLoading } = useProjectTrends();

  if (isLoading || trendsLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  const statusData = Object.entries(data.statusCounts).map(([name, value]) => ({ name, value }));
  const appData = Object.entries(data.appStatusCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Project Status Summary */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Project Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground mb-4">{data.totalProjects} total</p>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name} (${value})`}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground">No project data</p>}
          </CardContent>
        </Card>

        {/* Checklist Completion */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Checklist Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground mb-2">{data.avgChecklistRate}%</p>
            <p className="text-sm text-muted-foreground mb-4">Average completion rate</p>
            <div className="space-y-1">
              {data.checklistRates.filter(c => c.rate < 50).slice(0, 5).map((c) => (
                <div key={c.projectId} className="flex justify-between text-sm">
                  <span className="text-muted-foreground truncate">{c.projectId.slice(0, 8)}…</span>
                  <span className="text-destructive font-medium">{c.rate}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Avg Duration */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Avg Project Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground mb-2">{trends?.avgDuration ?? 0} days</p>
            <p className="text-sm text-muted-foreground">Based on {trends?.closedCount ?? 0} closed projects</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly Creation Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Projects Created (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {trends && trends.monthlyCreation.some((m) => m.count > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trends.monthlyCreation}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Projects" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">No data yet</p>}
          </CardContent>
        </Card>

        {/* Application Pipeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">DOB Application Status</CardTitle>
          </CardHeader>
          <CardContent>
            {appData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={appData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground">No application data</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
