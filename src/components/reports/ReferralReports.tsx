import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))", "hsl(var(--destructive))", "#8884d8", "#82ca9d", "#ffc658"];

function useReferralReports(year: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["reports-referrals", session?.user?.id, year],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      let query = supabase.from("proposals").select("id, status, total_amount, referred_by, lead_source, created_at");
      if (year !== "all") {
        query = query.gte("created_at", `${year}-01-01`).lt("created_at", `${parseInt(year) + 1}-01-01`);
      }
      const { data: proposals } = await query;
      const items = proposals || [];

      // Top referrers
      const referrerMap: Record<string, { name: string; proposals: number; converted: number; totalValue: number; convertedValue: number }> = {};
      items.forEach((p: any) => {
        const ref = p.referred_by?.trim();
        if (!ref) return;
        if (!referrerMap[ref]) referrerMap[ref] = { name: ref, proposals: 0, converted: 0, totalValue: 0, convertedValue: 0 };
        referrerMap[ref].proposals++;
        referrerMap[ref].totalValue += p.total_amount || 0;
        if (p.status === "executed") {
          referrerMap[ref].converted++;
          referrerMap[ref].convertedValue += p.total_amount || 0;
        }
      });
      const topReferrers = Object.values(referrerMap)
        .map((r) => ({ ...r, conversionRate: r.proposals > 0 ? Math.round((r.converted / r.proposals) * 100) : 0 }))
        .sort((a, b) => b.totalValue - a.totalValue);

      // Lead source breakdown
      const sourceMap: Record<string, { count: number; converted: number; value: number }> = {};
      items.forEach((p: any) => {
        const src = p.lead_source || "Unknown";
        if (!sourceMap[src]) sourceMap[src] = { count: 0, converted: 0, value: 0 };
        sourceMap[src].count++;
        sourceMap[src].value += p.total_amount || 0;
        if (p.status === "executed") sourceMap[src].converted++;
      });
      const leadSources = Object.entries(sourceMap).map(([name, d]) => ({
        name, count: d.count, converted: d.converted, value: d.value,
        conversionRate: d.count > 0 ? Math.round((d.converted / d.count) * 100) : 0,
      }));

      return { topReferrers, leadSources, totalReferred: items.filter((p: any) => p.referred_by?.trim()).length };
    },
  });
}

export default function ReferralReports() {
  const [year, setYear] = useState("all");
  const { data, isLoading } = useReferralReports(year);
  const currentYear = new Date().getFullYear();

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  const pieData = data.leadSources.map((s) => ({ name: s.name, value: s.count }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.totalReferred} referred proposals total</p>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value={`${currentYear}`}>{currentYear}</SelectItem>
            <SelectItem value={`${currentYear - 1}`}>{currentYear - 1}</SelectItem>
            <SelectItem value={`${currentYear - 2}`}>{currentYear - 2}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Referrers Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Referrers by Value</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topReferrers.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.topReferrers.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="totalValue" name="Total Referred" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">No referral data yet</p>}
          </CardContent>
        </Card>

        {/* Lead Source Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lead Source Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name} (${value})`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">No data</p>}
          </CardContent>
        </Card>
      </div>

      {/* Referrers Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Referral Details</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topReferrers.length > 0 ? (
            <div className="rounded-md border border-border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referrer</TableHead>
                    <TableHead className="text-right">Proposals</TableHead>
                    <TableHead className="text-right">Converted</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead className="text-right">Converted Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topReferrers.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{r.proposals}</TableCell>
                      <TableCell className="text-right">{r.converted}</TableCell>
                      <TableCell className="text-right">{r.conversionRate}%</TableCell>
                      <TableCell className="text-right">${r.totalValue.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${r.convertedValue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-4">No referral data</p>}
        </CardContent>
      </Card>
    </div>
  );
}
