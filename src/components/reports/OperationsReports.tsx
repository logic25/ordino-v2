import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOperationsReports } from "@/hooks/useReports";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function OperationsReports() {
  const { data, isLoading } = useOperationsReports();

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  return (
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
  );
}
