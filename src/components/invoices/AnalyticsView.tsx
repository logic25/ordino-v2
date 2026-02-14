import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, TrendingUp, Clock, Percent, BarChart3, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useInvoices, type InvoiceStatus } from "@/hooks/useInvoices";
import { useAllPaymentPromises } from "@/hooks/usePaymentPromises";
import { differenceInDays, parseISO } from "date-fns";

export function AnalyticsView() {
  const { data: allInvoices = [] } = useInvoices("all");
  const { data: promises = [] } = useAllPaymentPromises();

  const metrics = useMemo(() => {
    const paid = allInvoices.filter((i) => i.status === "paid");
    const sent = allInvoices.filter((i) => i.status === "sent" || i.status === "overdue" || i.status === "paid");
    const overdue = allInvoices.filter((i) => i.status === "overdue");

    // Collections rate: paid / (paid + sent + overdue)
    const collectionsRate = sent.length > 0 ? Math.round((paid.length / sent.length) * 100) : 0;

    // Avg days to pay
    const paidWithDates = paid.filter((i) => i.sent_at && i.paid_at);
    const avgDays = paidWithDates.length > 0
      ? Math.round(
          paidWithDates.reduce((sum, i) => {
            return sum + differenceInDays(parseISO(i.paid_at!), parseISO(i.sent_at!));
          }, 0) / paidWithDates.length
        )
      : 0;

    // Total outstanding
    const outstanding = allInvoices
      .filter((i) => i.status === "sent" || i.status === "overdue")
      .reduce((s, i) => s + (Number(i.total_due) || 0), 0);

    // Total collected (paid)
    const collected = paid.reduce((s, i) => s + (Number(i.payment_amount) || Number(i.total_due) || 0), 0);

    // Promise kept rate
    const keptPromises = promises.filter((p) => p.status === "kept").length;
    const totalResolved = promises.filter((p) => p.status === "kept" || p.status === "broken").length;
    const promiseRate = totalResolved > 0 ? Math.round((keptPromises / totalResolved) * 100) : 0;

    return {
      collectionsRate,
      avgDays,
      outstanding,
      collected,
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + (Number(i.total_due) || 0), 0),
      promiseRate,
    };
  }, [allInvoices, promises]);

  // Aging buckets for overdue invoices
  const agingData = useMemo(() => {
    const now = new Date();
    const overdue = allInvoices.filter((i) => i.status === "overdue" && i.due_date);
    const buckets = [
      { name: "1–30 days", min: 1, max: 30, amount: 0, count: 0 },
      { name: "31–60 days", min: 31, max: 60, amount: 0, count: 0 },
      { name: "61–90 days", min: 61, max: 90, amount: 0, count: 0 },
      { name: "90+ days", min: 91, max: 9999, amount: 0, count: 0 },
    ];

    overdue.forEach((inv) => {
      const days = differenceInDays(now, parseISO(inv.due_date!));
      const bucket = buckets.find((b) => days >= b.min && days <= b.max);
      if (bucket) {
        bucket.amount += Number(inv.total_due) || 0;
        bucket.count++;
      }
    });

    return buckets;
  }, [allInvoices]);

  // Status distribution for pie chart
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    allInvoices.forEach((inv) => {
      counts[inv.status] = (counts[inv.status] || 0) + 1;
    });
    return [
      { name: "Draft", value: (counts.draft || 0) + (counts.ready_to_send || 0), color: "hsl(var(--muted-foreground))" },
      { name: "Sent", value: counts.sent || 0, color: "hsl(var(--primary))" },
      { name: "Overdue", value: counts.overdue || 0, color: "hsl(var(--destructive))" },
      { name: "Paid", value: counts.paid || 0, color: "hsl(var(--success))" },
    ].filter((d) => d.value > 0);
  }, [allInvoices]);

  return (
    <div className="space-y-6 py-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            <div>
              <div className="text-xl font-bold">{metrics.collectionsRate}%</div>
              <div className="text-[11px] text-muted-foreground">Collections Rate</div>
            </div>
          </div>
        </Card>
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xl font-bold">{metrics.avgDays}d</div>
              <div className="text-[11px] text-muted-foreground">Avg Days to Pay</div>
            </div>
          </div>
        </Card>
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-warning" />
            <div>
              <div className="text-xl font-bold">${(metrics.outstanding / 1000).toFixed(0)}k</div>
              <div className="text-[11px] text-muted-foreground">Outstanding</div>
            </div>
          </div>
        </Card>
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <div>
              <div className="text-xl font-bold">${(metrics.collected / 1000).toFixed(0)}k</div>
              <div className="text-[11px] text-muted-foreground">Collected</div>
            </div>
          </div>
        </Card>
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-destructive" />
            <div>
              <div className="text-xl font-bold">{metrics.overdueCount}</div>
              <div className="text-[11px] text-muted-foreground">Overdue</div>
            </div>
          </div>
        </Card>
        <Card className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <div>
              <div className="text-xl font-bold">{metrics.promiseRate}%</div>
              <div className="text-[11px] text-muted-foreground">Promise Kept</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Aging Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Collections by Age</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={agingData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Amount"]}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="amount" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {agingData.map((b) => (
                <div key={b.name} className="text-center">
                  <div className="text-[10px] text-muted-foreground">{b.name}</div>
                  <div className="text-xs font-medium">{b.count} inv</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invoice Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  dataKey="value"
                  nameKey="name"
                  stroke="none"
                >
                  {statusDistribution.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
