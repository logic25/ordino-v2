import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjectReports } from "@/hooks/useReports";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))", "hsl(var(--destructive))"];

export default function ProjectReports() {
  const { data, isLoading } = useProjectReports();

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  const statusData = Object.entries(data.statusCounts).map(([name, value]) => ({ name, value }));
  const appData = Object.entries(data.appStatusCounts).map(([name, value]) => ({ name, value }));

  return (
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

      {/* Application Pipeline */}
      <Card className="md:col-span-1 lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Application Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          {appData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={appData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground">No application data</p>}
        </CardContent>
      </Card>
    </div>
  );
}
