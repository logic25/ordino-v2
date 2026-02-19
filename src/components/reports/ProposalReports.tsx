import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProposalReports, useProposalDetailedReports } from "@/hooks/useReports";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid } from "recharts";
import { Users } from "lucide-react";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
  "hsl(142, 76%, 36%)",
  "hsl(45, 93%, 47%)",
  "hsl(280, 67%, 55%)",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function useYTDSalesByRep() {
  const { session } = useAuth();
  const currentYear = new Date().getFullYear();
  return useQuery({
    queryKey: ["ytd-sales-by-rep", session?.user?.id, currentYear],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const startOfYear = `${currentYear}-01-01`;
      const { data: proposals } = await supabase
        .from("proposals")
        .select("id, status, total_amount, sales_person_id, created_at")
        .eq("status", "executed")
        .gte("created_at", startOfYear);

      if (!proposals || proposals.length === 0) return [];

      const repIds = [...new Set(proposals.map((p: any) => p.sales_person_id).filter(Boolean))];
      if (repIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", repIds);

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p.display_name || "Unknown"; });

      const byRep: Record<string, { name: string; value: number }> = {};
      proposals.forEach((p: any) => {
        const rid = p.sales_person_id;
        if (!rid) return;
        if (!byRep[rid]) byRep[rid] = { name: profileMap[rid] || "Unknown", value: 0 };
        byRep[rid].value += p.total_amount || 0;
      });

      return Object.values(byRep).sort((a, b) => b.value - a.value);
    },
  });
}

export default function ProposalReports() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const { data, isLoading } = useProposalReports();
  const { data: detailed, isLoading: detailedLoading } = useProposalDetailedReports();
  const { data: salesByRep } = useYTDSalesByRep();

  const years: string[] = useMemo(() => {
    if (!detailed?.allProposals) return [String(currentYear)];
    const yrs = new Set<string>(detailed.allProposals.map((p: any) => String(new Date(p.created_at).getFullYear())));
    yrs.add(String(currentYear));
    return Array.from(yrs).sort().reverse();
  }, [detailed, currentYear]);

  // Conversion table data
  const conversionData = useMemo(() => {
    if (!detailed?.allProposals) return [];
    const yearProposals = detailed.allProposals.filter(
      (p: any) => String(new Date(p.created_at).getFullYear()) === selectedYear
    );

    return MONTHS.map((month, idx) => {
      const monthProposals = yearProposals.filter(
        (p: any) => new Date(p.created_at).getMonth() === idx
      );
      const total = monthProposals.length;
      const converted = monthProposals.filter((p: any) => p.status === "executed").length;
      const totalValue = monthProposals.reduce((s: number, p: any) => s + (p.total_amount || 0), 0);
      const convertedValue = monthProposals
        .filter((p: any) => p.status === "executed")
        .reduce((s: number, p: any) => s + (p.total_amount || 0), 0);
      const rate = total > 0 ? Math.round((converted / total) * 100) : 0;

      return { month, total, converted, rate, totalValue, convertedValue };
    });
  }, [detailed, selectedYear]);

  const conversionTotals = useMemo(() => {
    const t = conversionData.reduce(
      (acc, r) => ({
        total: acc.total + r.total,
        converted: acc.converted + r.converted,
        totalValue: acc.totalValue + r.totalValue,
        convertedValue: acc.convertedValue + r.convertedValue,
      }),
      { total: 0, converted: 0, totalValue: 0, convertedValue: 0 }
    );
    return { ...t, rate: t.total > 0 ? Math.round((t.converted / t.total) * 100) : 0 };
  }, [conversionData]);

  // Source pie chart
  const sourceData = useMemo(() => {
    if (!detailed?.allProposals) return [];
    const yearProposals = detailed.allProposals.filter(
      (p: any) => String(new Date(p.created_at).getFullYear()) === selectedYear
    );
    const counts: Record<string, number> = {};
    yearProposals.forEach((p: any) => {
      const src = p.lead_source || "Unknown";
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [detailed, selectedYear]);

  // Yearly comparison
  const yearlyComparison = useMemo(() => {
    if (!detailed?.allProposals) return [];
    return MONTHS.map((month, idx) => {
      const row: any = { month };
      years.forEach((yr) => {
        const yp = detailed.allProposals.filter(
          (p: any) => String(new Date(p.created_at).getFullYear()) === yr && new Date(p.created_at).getMonth() === idx
        );
        row[yr] = yp.reduce((s: number, p: any) => s + (p.total_amount || 0), 0);
      });
      return row;
    });
  }, [detailed, years]);

  const fmt = (v: number) => `$${v.toLocaleString()}`;

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  const statusData = Object.entries(data.statusCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Year:</span>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[100px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.winRate}%</p>
            <p className="text-sm text-muted-foreground">{data.total} total proposals</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">${data.pendingValue.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Pending proposals</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Avg Follow-ups to Close</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.avgFollowUps}</p>
            <p className="text-sm text-muted-foreground">For executed proposals</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Rates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Conversion Rates — {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {detailedLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Proposals</TableHead>
                    <TableHead className="text-right">Converted</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Converted Value</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversionData.map((row) => (
                    <TableRow key={row.month} className={row.total === 0 ? "text-muted-foreground" : ""}>
                      <TableCell className="font-medium">{row.month}</TableCell>
                      <TableCell className="text-right">{row.total}</TableCell>
                      <TableCell className="text-right">{row.converted}</TableCell>
                      <TableCell className="text-right">{row.rate}%</TableCell>
                      <TableCell className="text-right">{fmt(row.convertedValue)}</TableCell>
                      <TableCell className="text-right">{fmt(row.totalValue)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{conversionTotals.total}</TableCell>
                    <TableCell className="text-right">{conversionTotals.converted}</TableCell>
                    <TableCell className="text-right">{conversionTotals.rate}%</TableCell>
                    <TableCell className="text-right">{fmt(conversionTotals.convertedValue)}</TableCell>
                    <TableCell className="text-right">{fmt(conversionTotals.totalValue)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Proposal Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposal Sources — {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                    {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No source data</p>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No proposal data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* YTD Sales by Rep + Yearly Comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">YTD Sales by Rep — {currentYear}</CardTitle>
          </CardHeader>
          <CardContent>
            {salesByRep && salesByRep.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={salesByRep}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="value" name="Executed Value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Users className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Sales data will appear as proposals are executed</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yearly Comparison — Proposal Value by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {yearlyComparison.length > 0 && years.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={yearlyComparison}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Legend />
                  {years.slice(0, 3).map((yr, i) => (
                    <Bar key={yr} dataKey={yr} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No data</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
