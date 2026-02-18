import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTimeReports } from "@/hooks/useReports";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function TimeReports() {
  const { data, isLoading } = useTimeReports();

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  return (
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

      {/* Utilization by Team Member */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Team Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          {data.utilization.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.utilization}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="billableHours" name="Billable" fill="hsl(var(--primary))" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="totalHours" name="Total" fill="hsl(var(--muted-foreground))" stackId="b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground">No time data</p>}
        </CardContent>
      </Card>
    </div>
  );
}
