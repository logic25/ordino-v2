import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export function useYearOverYearRevenue() {
  return useQuery({
    queryKey: ["yoy-revenue"],
    queryFn: async () => {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, status, total_due, payment_amount, created_at, paid_at");

      const now = new Date();
      const currentYear = now.getFullYear();
      const prevYear = currentYear - 1;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      const result: { month: string; [key: string]: number | string }[] = [];

      for (let m = 0; m < 12; m++) {
        const entry: any = { month: monthNames[m] };
        entry[`${prevYear}`] = 0;
        entry[`${currentYear}`] = 0;

        (invoices || []).forEach((inv: any) => {
          const created = new Date(inv.created_at);
          if (created.getMonth() === m) {
            const amount = inv.total_due || 0;
            if (created.getFullYear() === currentYear) entry[`${currentYear}`] += amount;
            if (created.getFullYear() === prevYear) entry[`${prevYear}`] += amount;
          }
        });

        result.push(entry);
      }

      return { data: result, currentYear, prevYear };
    },
  });
}

const formatCurrency = (v: number) => {
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v}`;
};

export function YearOverYearChart() {
  const { data, isLoading } = useYearOverYearRevenue();

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Year-over-Year Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : data && data.data.some((d: any) => d[data.currentYear] > 0 || d[data.prevYear] > 0) ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.data} barGap={1} barSize={12}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCurrency} />
              <Tooltip formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name]} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey={`${data.prevYear}`} fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} opacity={0.6} />
              <Bar dataKey={`${data.currentYear}`} fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
            No revenue data to compare
          </div>
        )}
      </CardContent>
    </Card>
  );
}
