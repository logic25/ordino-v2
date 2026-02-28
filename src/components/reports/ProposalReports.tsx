import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

/** Fetch team members for the filter dropdown */
function useTeamMembers() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["report-team-members", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name").eq("is_active", true);
      return (data || [])
        .map((p: any) => ({ id: p.id, name: p.display_name || "Unknown" }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
  });
}

/** All proposals + CO data in one query, filtered by sales_person_id */
function useFilteredProposalData(selectedUser: string, selectedYear: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["filtered-proposal-data", session?.user?.id, selectedUser, selectedYear],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const [{ data: rawProposals }, { data: changeOrders }, { data: projects }, { data: clients }] = await Promise.all([
        supabase.from("proposals").select("id, status, total_amount, follow_up_count, created_at, lead_source, sales_person_id"),
        supabase.from("change_orders").select("id, project_id, amount, status, created_at"),
        supabase.from("projects").select("id, client_id, assigned_pm_id"),
        supabase.from("clients").select("id, name, client_type"),
      ]);

      // Filter proposals by user
      let proposals = rawProposals || [];
      if (selectedUser !== "all") {
        proposals = proposals.filter((p: any) => p.sales_person_id === selectedUser);
      }

      // Filter COs by PM (via project assignment)
      let projs = projects || [];
      const projIdSet = new Set<string>();
      if (selectedUser !== "all") {
        projs.filter((p: any) => p.assigned_pm_id === selectedUser).forEach((p: any) => projIdSet.add(p.id));
      } else {
        projs.forEach((p: any) => projIdSet.add(p.id));
      }
      const cos = (changeOrders || []).filter((c: any) => projIdSet.has(c.project_id));
      const filteredProjs = selectedUser !== "all" ? projs.filter((p: any) => projIdSet.has(p.id)) : projs;

      // Client map
      const clientMap: Record<string, { name: string; type: string }> = {};
      (clients || []).forEach((c: any) => { clientMap[c.id] = { name: c.name, type: c.client_type || "Uncategorized" }; });

      const projClientMap: Record<string, string> = {};
      filteredProjs.forEach((p: any) => { if (p.client_id) projClientMap[p.id] = p.client_id; });

      // === Proposal metrics ===
      const statusCounts: Record<string, number> = {};
      proposals.forEach((p: any) => { statusCounts[p.status || "draft"] = (statusCounts[p.status || "draft"] || 0) + 1; });

      const sent = statusCounts["sent"] || 0;
      const executed = statusCounts["executed"] || 0;
      const lost = statusCounts["lost"] || 0;
      const winRate = sent + executed + lost > 0 ? Math.round((executed / (sent + executed + lost)) * 100) : 0;

      const pendingValue = proposals
        .filter((p: any) => ["draft", "sent"].includes(p.status))
        .reduce((a: number, p: any) => a + (p.total_amount || 0), 0);

      const executedProposals = proposals.filter((p: any) => p.status === "executed");
      const avgFollowUps = executedProposals.length > 0
        ? Math.round(executedProposals.reduce((a: number, p: any) => a + (p.follow_up_count || 0), 0) / executedProposals.length * 10) / 10
        : 0;

      // === CO metrics ===
      const totalCOs = cos.length;
      const approvedCOs = cos.filter((c: any) => c.status === "approved").length;
      const totalCOValue = cos.reduce((s: number, c: any) => s + (c.amount || 0), 0);
      const projectsWithCOs = new Set(cos.map((c: any) => c.project_id));
      const coProjectCount = projectsWithCOs.size;
      const totalProjectCount = filteredProjs.length;
      const coProjectRate = totalProjectCount > 0 ? Math.round((coProjectCount / totalProjectCount) * 100) : 0;

      // CO by client
      const byClient: Record<string, { name: string; type: string; coCount: number; coValue: number; projectCount: number }> = {};
      cos.forEach((co: any) => {
        const clientId = projClientMap[co.project_id];
        if (!clientId) return;
        const info = clientMap[clientId] || { name: "Unknown", type: "Uncategorized" };
        if (!byClient[clientId]) byClient[clientId] = { name: info.name, type: info.type, coCount: 0, coValue: 0, projectCount: 0 };
        byClient[clientId].coCount++;
        byClient[clientId].coValue += co.amount || 0;
      });
      projectsWithCOs.forEach((projId) => {
        const clientId = projClientMap[projId as string];
        if (clientId && byClient[clientId]) byClient[clientId].projectCount++;
      });
      const clientCOData = Object.values(byClient).sort((a, b) => b.coValue - a.coValue);

      // CO by client type
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

      return {
        proposals,
        statusCounts,
        winRate,
        pendingValue,
        avgFollowUps,
        total: proposals.length,
        totalCOs,
        approvedCOs,
        totalCOValue,
        coProjectCount,
        totalProjectCount,
        coProjectRate,
        clientCOData,
        typeCOData,
      };
    },
  });
}

export default function ProposalReports() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedUser, setSelectedUser] = useState("all");
  const { data: teamMembers } = useTeamMembers();
  const { data, isLoading } = useFilteredProposalData(selectedUser, selectedYear);

  const years: string[] = useMemo(() => {
    if (!data?.proposals) return [String(currentYear)];
    const yrs = new Set<string>(data.proposals.map((p: any) => String(new Date(p.created_at).getFullYear())));
    yrs.add(String(currentYear));
    return Array.from(yrs).sort().reverse();
  }, [data, currentYear]);

  // Monthly trend data
  const trendData = useMemo(() => {
    if (!data?.proposals) return [];
    const yearProposals = data.proposals.filter(
      (p: any) => String(new Date(p.created_at).getFullYear()) === selectedYear
    );
    return MONTHS.map((month, idx) => {
      const mp = yearProposals.filter((p: any) => new Date(p.created_at).getMonth() === idx);
      const count = mp.length;
      const totalValue = mp.reduce((s: number, p: any) => s + (p.total_amount || 0), 0);
      const avgPrice = count > 0 ? Math.round(totalValue / count) : 0;
      return { month, count, avgPrice };
    });
  }, [data, selectedYear]);

  // MoM trend
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

  // Conversion table
  const conversionData = useMemo(() => {
    if (!data?.proposals) return [];
    const yearProposals = data.proposals.filter(
      (p: any) => String(new Date(p.created_at).getFullYear()) === selectedYear
    );
    return MONTHS.map((month, idx) => {
      const mp = yearProposals.filter((p: any) => new Date(p.created_at).getMonth() === idx);
      const total = mp.length;
      const converted = mp.filter((p: any) => p.status === "executed").length;
      const totalValue = mp.reduce((s: number, p: any) => s + (p.total_amount || 0), 0);
      const convertedValue = mp.filter((p: any) => p.status === "executed").reduce((s: number, p: any) => s + (p.total_amount || 0), 0);
      const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
      return { month, total, converted, rate, totalValue, convertedValue };
    });
  }, [data, selectedYear]);

  const conversionTotals = useMemo(() => {
    const t = conversionData.reduce(
      (acc, r) => ({ total: acc.total + r.total, converted: acc.converted + r.converted, totalValue: acc.totalValue + r.totalValue, convertedValue: acc.convertedValue + r.convertedValue }),
      { total: 0, converted: 0, totalValue: 0, convertedValue: 0 }
    );
    return { ...t, rate: t.total > 0 ? Math.round((t.converted / t.total) * 100) : 0 };
  }, [conversionData]);

  // Source pie
  const sourceData = useMemo(() => {
    if (!data?.proposals) return [];
    const yearProposals = data.proposals.filter(
      (p: any) => String(new Date(p.created_at).getFullYear()) === selectedYear
    );
    const counts: Record<string, number> = {};
    yearProposals.forEach((p: any) => { counts[p.lead_source || "Unknown"] = (counts[p.lead_source || "Unknown"] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [data, selectedYear]);

  // Yearly comparison
  const yearlyComparison = useMemo(() => {
    if (!data?.proposals) return [];
    return MONTHS.map((month, idx) => {
      const row: any = { month };
      years.forEach((yr) => {
        const yp = data.proposals.filter(
          (p: any) => String(new Date(p.created_at).getFullYear()) === yr && new Date(p.created_at).getMonth() === idx
        );
        row[yr] = yp.reduce((s: number, p: any) => s + (p.total_amount || 0), 0);
      });
      return row;
    });
  }, [data, years]);

  const fmt = (v: number) => `$${v.toLocaleString()}`;

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  const statusData = Object.entries(data.statusCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* Global Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">User:</span>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {teamMembers?.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className="text-2xl font-bold">{data.winRate}%</p>
            <p className="text-xs text-muted-foreground">{data.total} proposals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pipeline</p>
            <p className="text-2xl font-bold">{fmt(data.pendingValue)}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">This Month</p>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-bold">{thisMonthCount}</span>
              <TrendIcon change={countTrend} />
              <span className={`text-xs font-medium ${trendColor(countTrend)}`}>{countTrend > 0 ? "+" : ""}{countTrend}%</span>
            </div>
            <p className="text-xs text-muted-foreground">vs {lastMonthCount} last mo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Avg Price</p>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-bold">{fmt(thisMonthAvg)}</span>
              <TrendIcon change={avgTrend} />
              <span className={`text-xs font-medium ${trendColor(avgTrend)}`}>{avgTrend > 0 ? "+" : ""}{avgTrend}%</span>
            </div>
            <p className="text-xs text-muted-foreground">vs {fmt(lastMonthAvg)} last mo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Avg Follow-ups</p>
            <p className="text-2xl font-bold">{data.avgFollowUps}</p>
            <p className="text-xs text-muted-foreground">To close</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly Proposal Count & Avg Price — {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="count" orientation="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="price" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number, name: string) => name === "Avg Price" ? fmt(v) : v} />
              <Legend />
              <Line yAxisId="count" type="monotone" dataKey="count" name="Proposals" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="price" type="monotone" dataKey="avgPrice" name="Avg Price" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Conversion Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly Conversion — {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Won $</TableHead>
                  <TableHead className="text-right">Total $</TableHead>
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
        </CardContent>
      </Card>

      {/* Sources + Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Proposal Sources — {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${name} (${value})`}>
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
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, value }) => `${name} (${value})`}>
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

      {/* Yearly Comparison */}
      {yearlyComparison.length > 0 && years.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Year-over-Year Proposal Value</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={yearlyComparison}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                {years.slice(0, 3).map((yr, i) => (
                  <Bar key={yr} dataKey={yr} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ─── Change Order Analytics ─── */}
      <div className="pt-4 border-t border-border space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Change Order Analytics</h2>

        {/* CO Summary Cards */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total COs</p>
              <p className="text-2xl font-bold">{data.totalCOs}</p>
              <p className="text-xs text-muted-foreground">{data.approvedCOs} approved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">CO Value</p>
              <p className="text-2xl font-bold">{fmt(data.totalCOValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Projects w/ COs</p>
              <p className="text-2xl font-bold">{data.coProjectCount} <span className="text-sm font-normal text-muted-foreground">/ {data.totalProjectCount}</span></p>
              <p className="text-xs text-muted-foreground">{data.coProjectRate}% of projects</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Avg COs per Project</p>
              <p className="text-2xl font-bold">{data.coProjectCount > 0 ? (data.totalCOs / data.coProjectCount).toFixed(1) : "—"}</p>
            </CardContent>
          </Card>
        </div>

        {/* CO by Client Type + Top Clients side by side */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">COs by Client Type</CardTitle>
            </CardHeader>
            <CardContent>
              {data.typeCOData.length > 0 ? (
                <div className="space-y-3">
                  {data.typeCOData.map((t: any) => (
                    <div key={t.name} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{t.name}</span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{t.coCount} COs</span>
                        <span>{t.clientCount} clients</span>
                        <span className="font-medium text-foreground">{fmt(t.coValue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No change order data</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Clients by CO Value</CardTitle>
            </CardHeader>
            <CardContent>
              {data.clientCOData.length > 0 ? (
                <div className="space-y-2">
                  {data.clientCOData.slice(0, 8).map((c: any) => (
                    <div key={c.name} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-foreground">{c.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{c.type}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{c.coCount} COs</span>
                        <span className="font-medium text-foreground">{fmt(c.coValue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No change order data</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
