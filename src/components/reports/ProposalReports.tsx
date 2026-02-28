import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProposalReports, useProposalDetailedReports } from "@/hooks/useReports";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid, LineChart, Line } from "recharts";
import { Users, TrendingUp, TrendingDown, Minus } from "lucide-react";

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

function useChangeOrderAnalytics(selectedPmId: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["co-analytics", session?.user?.id, selectedPmId],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const [{ data: changeOrders }, { data: projects }, { data: clients }, { data: profiles }] = await Promise.all([
        supabase.from("change_orders").select("id, project_id, amount, status, created_at"),
        supabase.from("projects").select("id, client_id, project_number, assigned_pm_id"),
        supabase.from("clients").select("id, name, client_type"),
        supabase.from("profiles").select("id, display_name"),
      ]);

      let projs = projects || [];
      // Filter projects by PM if selected
      if (selectedPmId !== "all") {
        const filteredProjIds = new Set(projs.filter((p: any) => p.assigned_pm_id === selectedPmId).map((p: any) => p.id));
        projs = projs.filter((p: any) => filteredProjIds.has(p.id));
      }
      const projIdSet = new Set(projs.map((p: any) => p.id));

      const cos = (changeOrders || []).filter((c: any) => projIdSet.has(c.project_id));
      const cls = clients || [];

      // Build team members list for the filter
      const teamMembers = (profiles || [])
        .map((p: any) => ({ id: p.id, name: p.display_name || "Unknown" }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      const clientMap: Record<string, { name: string; type: string }> = {};
      cls.forEach((c: any) => { clientMap[c.id] = { name: c.name, type: c.client_type || "Unknown" }; });

      const projClientMap: Record<string, string> = {};
      projs.forEach((p: any) => { if (p.client_id) projClientMap[p.id] = p.client_id; });

      const totalCOs = cos.length;
      const approvedCOs = cos.filter((c: any) => c.status === "approved").length;
      const totalCOValue = cos.reduce((s: number, c: any) => s + (c.amount || 0), 0);

      // Projects with COs
      const projectsWithCOs = new Set(cos.map((c: any) => c.project_id));
      const coProjectCount = projectsWithCOs.size;
      const totalProjectCount = projs.length;
      const coProjectRate = totalProjectCount > 0 ? Math.round((coProjectCount / totalProjectCount) * 100) : 0;

      // By client
      const byClient: Record<string, { name: string; type: string; coCount: number; coValue: number; projectCount: number }> = {};
      cos.forEach((co: any) => {
        const clientId = projClientMap[co.project_id];
        if (!clientId) return;
        const info = clientMap[clientId] || { name: "Unknown", type: "Unknown" };
        if (!byClient[clientId]) byClient[clientId] = { name: info.name, type: info.type, coCount: 0, coValue: 0, projectCount: 0 };
        byClient[clientId].coCount++;
        byClient[clientId].coValue += co.amount || 0;
      });
      projectsWithCOs.forEach((projId) => {
        const clientId = projClientMap[projId as string];
        if (clientId && byClient[clientId]) byClient[clientId].projectCount++;
      });
      const clientCOData = Object.values(byClient).sort((a, b) => b.coCount - a.coCount);

      // By client type
      const byType: Record<string, { coCount: number; coValue: number; clientCount: number }> = {};
      Object.values(byClient).forEach((c) => {
        if (!byType[c.type]) byType[c.type] = { coCount: 0, coValue: 0, clientCount: 0 };
        byType[c.type].coCount += c.coCount;
        byType[c.type].coValue += c.coValue;
        byType[c.type].clientCount++;
      });
      const typeCOData = Object.entries(byType).map(([type, v]) => ({
        name: type,
        coCount: v.coCount,
        coValue: v.coValue,
        clientCount: v.clientCount,
      })).sort((a, b) => b.coCount - a.coCount);

      return { totalCOs, approvedCOs, totalCOValue, coProjectCount, totalProjectCount, coProjectRate, clientCOData, typeCOData, teamMembers };
    },
  });
}

export default function ProposalReports() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedPm, setSelectedPm] = useState("all");
  const { data, isLoading } = useProposalReports();
  const { data: detailed, isLoading: detailedLoading } = useProposalDetailedReports();
  const { data: salesByRep } = useYTDSalesByRep();
  const { data: coData } = useChangeOrderAnalytics(selectedPm);

  const years: string[] = useMemo(() => {
    if (!detailed?.allProposals) return [String(currentYear)];
    const yrs = new Set<string>(detailed.allProposals.map((p: any) => String(new Date(p.created_at).getFullYear())));
    yrs.add(String(currentYear));
    return Array.from(yrs).sort().reverse();
  }, [detailed, currentYear]);

  // Monthly trend data — count & avg price
  const trendData = useMemo(() => {
    if (!detailed?.allProposals) return [];
    const yearProposals = detailed.allProposals.filter(
      (p: any) => String(new Date(p.created_at).getFullYear()) === selectedYear
    );
    return MONTHS.map((month, idx) => {
      const mp = yearProposals.filter((p: any) => new Date(p.created_at).getMonth() === idx);
      const count = mp.length;
      const totalValue = mp.reduce((s: number, p: any) => s + (p.total_amount || 0), 0);
      const avgPrice = count > 0 ? Math.round(totalValue / count) : 0;
      return { month, count, avgPrice };
    });
  }, [detailed, selectedYear]);

  // Compute MoM trend
  const currentMonth = new Date().getMonth();
  const thisMonthCount = trendData[currentMonth]?.count || 0;
  const lastMonthCount = currentMonth > 0 ? (trendData[currentMonth - 1]?.count || 0) : 0;
  const countTrend = lastMonthCount > 0 ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100) : thisMonthCount > 0 ? 100 : 0;
  const thisMonthAvg = trendData[currentMonth]?.avgPrice || 0;
  const lastMonthAvg = currentMonth > 0 ? (trendData[currentMonth - 1]?.avgPrice || 0) : 0;
  const avgTrend = lastMonthAvg > 0 ? Math.round(((thisMonthAvg - lastMonthAvg) / lastMonthAvg) * 100) : thisMonthAvg > 0 ? 100 : 0;

  const TrendIcon = ({ change }: { change: number }) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };
  const trendColor = (c: number) => c > 0 ? "text-green-600" : c < 0 ? "text-destructive" : "text-muted-foreground";

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

      {/* Summary Cards Row — now with trends */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
            <CardTitle className="text-base">Proposals This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{thisMonthCount}</span>
              <TrendIcon change={countTrend} />
              <span className={`text-sm font-medium ${trendColor(countTrend)}`}>
                {countTrend > 0 ? "+" : ""}{countTrend}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">vs {lastMonthCount} last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Avg Proposal Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{fmt(thisMonthAvg)}</span>
              <TrendIcon change={avgTrend} />
              <span className={`text-sm font-medium ${trendColor(avgTrend)}`}>
                {avgTrend > 0 ? "+" : ""}{avgTrend}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">vs {fmt(lastMonthAvg)} last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Avg Follow-ups</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.avgFollowUps}</p>
            <p className="text-sm text-muted-foreground">To close</p>
          </CardContent>
        </Card>
      </div>

      {/* Proposal Count & Avg Price Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Proposal Count & Avg Price — {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="count" orientation="left" tick={{ fontSize: 11 }} label={{ value: "Count", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
              <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} label={{ value: "Avg Price", angle: 90, position: "insideRight", style: { fontSize: 11 } }} />
              <Tooltip formatter={(v: number, name: string) => name === "Avg Price" ? fmt(v) : v} />
              <Legend />
              <Line yAxisId="count" type="monotone" dataKey="count" name="Proposals" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="price" type="monotone" dataKey="avgPrice" name="Avg Price" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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

      {/* Change Order Analytics Section */}
      {coData && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground pt-4 border-t border-border">Change Order Analytics</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter by PM:</span>
              <Select value={selectedPm} onValueChange={setSelectedPm}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {coData.teamMembers?.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Total COs</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{coData.totalCOs}</p>
                <p className="text-sm text-muted-foreground">{coData.approvedCOs} approved</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">CO Value</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{fmt(coData.totalCOValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Projects with COs</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{coData.coProjectCount}</p>
                <p className="text-sm text-muted-foreground">{coData.coProjectRate}% of {coData.totalProjectCount} projects</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Avg CO per Project</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{coData.coProjectCount > 0 ? (coData.totalCOs / coData.coProjectCount).toFixed(1) : "—"}</p>
              </CardContent>
            </Card>
          </div>

          {/* CO by Client */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change Orders by Client</CardTitle>
            </CardHeader>
            <CardContent>
              {coData.clientCOData.length > 0 ? (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">COs</TableHead>
                        <TableHead className="text-right">Projects w/ COs</TableHead>
                        <TableHead className="text-right">CO Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coData.clientCOData.map((row) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-muted-foreground">{row.type}</TableCell>
                          <TableCell className="text-right">{row.coCount}</TableCell>
                          <TableCell className="text-right">{row.projectCount}</TableCell>
                          <TableCell className="text-right">{fmt(row.coValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No change order data</p>
              )}
            </CardContent>
          </Card>

          {/* CO by Client Type */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">COs by Client Type</CardTitle>
              </CardHeader>
              <CardContent>
                {coData.typeCOData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={coData.typeCOData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="coCount" name="Change Orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="clientCount" name="Clients" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">CO Value by Client Type</CardTitle>
              </CardHeader>
              <CardContent>
                {coData.typeCOData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={coData.typeCOData} dataKey="coValue" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, coValue }) => `${name} (${fmt(coValue)})`}>
                        {coData.typeCOData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
