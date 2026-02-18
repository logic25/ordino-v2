import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProposalReports } from "@/hooks/useReports";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

export default function ProposalReports() {
  const { data, isLoading } = useProposalReports();

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  const statusData = Object.entries(data.statusCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Win Rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Win Rate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-3xl font-bold text-foreground">{data.winRate}%</p>
          <p className="text-sm text-muted-foreground">{data.total} total proposals</p>
        </CardContent>
      </Card>

      {/* Pipeline Value */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pipeline Value</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-3xl font-bold text-foreground">${data.pendingValue.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Pending proposals</p>
          <div>
            <p className="text-sm text-muted-foreground">Avg Follow-ups to Close</p>
            <p className="text-2xl font-bold text-foreground">{data.avgFollowUps}</p>
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name} (${value})`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground">No proposal data</p>}
        </CardContent>
      </Card>
    </div>
  );
}
