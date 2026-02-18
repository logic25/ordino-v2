import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBillingReports } from "@/hooks/useReports";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function BillingReports() {
  const { data, isLoading } = useBillingReports();

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  const agingData = Object.entries(data.aging).map(([name, value]) => ({ name: name === "current" ? "0-30 days" : name + " days", value }));

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Revenue Trend */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.months}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="collected" name="Collected" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outstanding" name="Outstanding" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Collections KPIs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Collections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Collection Rate</p>
            <p className="text-3xl font-bold text-foreground">{data.collectionRate}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Days to Pay</p>
            <p className="text-3xl font-bold text-foreground">{data.avgDaysToPay}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Collected</p>
            <p className="text-xl font-semibold text-foreground">${data.totalCollected.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      {/* Aging Report */}
      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Aging Report</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agingData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
