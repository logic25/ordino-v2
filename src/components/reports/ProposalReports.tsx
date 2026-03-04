import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid, LineChart, Line, ComposedChart } from "recharts";
import { Users, TrendingUp, TrendingDown, Minus, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, startOfYear, endOfYear, endOfMonth, subYears } from "date-fns";

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
      const [{ data: rawProposals }, { data: changeOrders }, { data: projects }, { data: clients }, { data: profiles }] = await Promise.all([
        supabase.from("proposals").select("id, status, total_amount, follow_up_count, created_at, lead_source, sales_person_id"),
        supabase.from("change_orders").select("id, project_id, amount, status, created_at, created_by"),
        supabase.from("projects").select("id, client_id, assigned_pm_id"),
        supabase.from("clients").select("id, name, client_type"),
        supabase.from("profiles").select("id, display_name"),
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
      (clients || []).forEach((c: any) => { clientMap[c.id] = { name: c.name, type: c.client_type || "Not Set" }; });

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
      const pendingCOs = cos.filter((c: any) => c.status === "pending").length;
      const rejectedCOs = cos.filter((c: any) => c.status === "rejected").length;
      const totalCOValue = cos.reduce((s: number, c: any) => s + (c.amount || 0), 0);
      const avgCOSize = totalCOs > 0 ? Math.round(totalCOValue / totalCOs) : 0;
      const approvalRate = totalCOs > 0 ? Math.round((approvedCOs / totalCOs) * 100) : 0;
      const projectsWithCOs = new Set(cos.map((c: any) => c.project_id));
      const coProjectCount = projectsWithCOs.size;
      const totalProjectCount = filteredProjs.length;
      const coProjectRate = totalProjectCount > 0 ? Math.round((coProjectCount / totalProjectCount) * 100) : 0;

      // Profile map
      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p.display_name || "Unknown"; });

      // CO by creator (who writes them)
      const byCreator: Record<string, { name: string; count: number; value: number; approved: number }> = {};
      cos.forEach((co: any) => {
        const creatorId = co.created_by || "unknown";
        if (!byCreator[creatorId]) byCreator[creatorId] = { name: profileMap[creatorId] || "Unknown", count: 0, value: 0, approved: 0 };
        byCreator[creatorId].count++;
        byCreator[creatorId].value += co.amount || 0;
        if (co.status === "approved") byCreator[creatorId].approved++;
      });
      const coByCreator = Object.values(byCreator).sort((a, b) => b.count - a.count);

      // CO by PM (who gets them — based on project assignment)
      const byPM: Record<string, { name: string; count: number; value: number }> = {};
      cos.forEach((co: any) => {
        const proj = filteredProjs.find((p: any) => p.id === co.project_id);
        const pmId = proj?.assigned_pm_id;
        if (!pmId) return;
        if (!byPM[pmId]) byPM[pmId] = { name: profileMap[pmId] || "Unknown", count: 0, value: 0 };
        byPM[pmId].count++;
        byPM[pmId].value += co.amount || 0;
      });
      const coByPM = Object.values(byPM).sort((a, b) => b.value - a.value);

      // Monthly CO trend
      const coMonthly = MONTHS.map((month, idx) => {
        const mCOs = cos.filter((c: any) => new Date(c.created_at).getMonth() === idx && String(new Date(c.created_at).getFullYear()) === selectedYear);
        const count = mCOs.length;
        const value = mCOs.reduce((s: number, c: any) => s + (c.amount || 0), 0);
        const avg = count > 0 ? Math.round(value / count) : 0;
        return { month, count, value, avg };
      });

      // CO status breakdown
      const coStatusCounts: Record<string, number> = {};
      cos.forEach((c: any) => { coStatusCounts[c.status || "unknown"] = (coStatusCounts[c.status || "unknown"] || 0) + 1; });

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
        pendingCOs,
        rejectedCOs,
        totalCOValue,
        avgCOSize,
        approvalRate,
        coProjectCount,
        totalProjectCount,
        coProjectRate,
        clientCOData,
        typeCOData,
        coByCreator,
        coByPM,
        coMonthly,
        coStatusCounts,
      };
    },
  });
}

/** Inline date picker button */
function DatePickerButton({ date, onChange }: { date: Date; onChange: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2 font-normal">
          <CalendarIcon className="h-3 w-3" />
          {format(date, "MM/dd/yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onChange} initialFocus className={cn("p-3 pointer-events-auto")} />
      </PopoverContent>
    </Popover>
  );
}

export default function ProposalReports() {
  const currentYear = new Date().getFullYear();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedUser, setSelectedUser] = useState("all");
  const [periodA, setPeriodA] = useState<{ from: Date; to: Date }>({ from: startOfYear(now), to: endOfMonth(now) });
  const [periodB, setPeriodB] = useState<{ from: Date; to: Date } | null>(null);
  const [showCompare, setShowCompare] = useState(false);
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
      // CO columns
      const mCOs = data.coMonthly?.[idx];
      const coCount = mCOs?.count || 0;
      const coValue = mCOs?.value || 0;
      return { month, total, converted, rate, totalValue, convertedValue, coCount, coValue };
    });
  }, [data, selectedYear]);

  const conversionTotals = useMemo(() => {
    const t = conversionData.reduce(
      (acc, r) => ({ total: acc.total + r.total, converted: acc.converted + r.converted, totalValue: acc.totalValue + r.totalValue, convertedValue: acc.convertedValue + r.convertedValue, coCount: acc.coCount + r.coCount, coValue: acc.coValue + r.coValue }),
      { total: 0, converted: 0, totalValue: 0, convertedValue: 0, coCount: 0, coValue: 0 }
    );
    return { ...t, rate: t.total > 0 ? Math.round((t.converted / t.total) * 100) : 0 };
  }, [conversionData]);

  // Period comparison helper — aggregate proposals + COs in a date range
  const aggregatePeriod = (proposals: any[], coMonthly: any[], range: { from: Date; to: Date }) => {
    const inRange = proposals.filter((p: any) => {
      const d = new Date(p.created_at);
      return d >= range.from && d <= range.to;
    });
    const total = inRange.length;
    const converted = inRange.filter((p: any) => p.status === "executed").length;
    const totalValue = inRange.reduce((s: number, p: any) => s + (p.total_amount || 0), 0);
    const convertedValue = inRange.filter((p: any) => p.status === "executed").reduce((s: number, p: any) => s + (p.total_amount || 0), 0);
    const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
    // COs — sum from coMonthly where month falls in range
    let coCount = 0, coValue = 0;
    coMonthly?.forEach((m: any) => { coCount += m.count || 0; coValue += m.value || 0; });
    return { total, converted, rate, totalValue, convertedValue, coCount, coValue };
  };

  const periodASummary = useMemo(() => {
    if (!data?.proposals) return null;
    return aggregatePeriod(data.proposals, data.coMonthly || [], periodA);
  }, [data, periodA]);

  const periodBSummary = useMemo(() => {
    if (!showCompare || !periodB || !data?.proposals) return null;
    return aggregatePeriod(data.proposals, data.coMonthly || [], periodB);
  }, [data, periodB, showCompare]);

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

      {/* Conversion Table — monthly breakdown */}
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
                  <TableHead className="text-right border-l border-border">COs</TableHead>
                  <TableHead className="text-right">CO $</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversionData.map((row) => (
                  <TableRow key={row.month} className={row.total === 0 && row.coCount === 0 ? "text-muted-foreground" : ""}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right">{row.total}</TableCell>
                    <TableCell className="text-right">{row.converted}</TableCell>
                    <TableCell className="text-right">{row.rate}%</TableCell>
                    <TableCell className="text-right">{fmt(row.convertedValue)}</TableCell>
                    <TableCell className="text-right">{fmt(row.totalValue)}</TableCell>
                    <TableCell className="text-right border-l border-border">{row.coCount}</TableCell>
                    <TableCell className="text-right">{fmt(row.coValue)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{conversionTotals.total}</TableCell>
                  <TableCell className="text-right">{conversionTotals.converted}</TableCell>
                  <TableCell className="text-right">{conversionTotals.rate}%</TableCell>
                  <TableCell className="text-right">{fmt(conversionTotals.convertedValue)}</TableCell>
                  <TableCell className="text-right">{fmt(conversionTotals.totalValue)}</TableCell>
                  <TableCell className="text-right border-l border-border">{conversionTotals.coCount}</TableCell>
                  <TableCell className="text-right">{fmt(conversionTotals.coValue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Period Comparison — QB-style date pickers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Period Comparison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Period A */}
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Period A</span>
              <div className="flex items-center gap-1">
                <DatePickerButton date={periodA.from} onChange={(d) => d && setPeriodA(prev => ({ ...prev, from: d }))} />
                <span className="text-xs text-muted-foreground">to</span>
                <DatePickerButton date={periodA.to} onChange={(d) => d && setPeriodA(prev => ({ ...prev, to: d }))} />
              </div>
            </div>
            {/* Period B toggle */}
            {!showCompare ? (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setShowCompare(true); setPeriodB({ from: startOfYear(subYears(now, 1)), to: endOfYear(subYears(now, 1)) }); }}>
                + Compare Period
              </Button>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Period B</span>
                  <button className="text-xs text-destructive hover:underline" onClick={() => { setShowCompare(false); setPeriodB(null); }}>Remove</button>
                </div>
                <div className="flex items-center gap-1">
                  <DatePickerButton date={periodB?.from ?? now} onChange={(d) => d && setPeriodB(prev => prev ? { ...prev, from: d } : { from: d, to: endOfYear(d) })} />
                  <span className="text-xs text-muted-foreground">to</span>
                  <DatePickerButton date={periodB?.to ?? now} onChange={(d) => d && setPeriodB(prev => prev ? { ...prev, to: d } : { from: startOfYear(d), to: d })} />
                </div>
              </div>
            )}
          </div>

          {/* Comparison Table */}
          {periodASummary && (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">Period A</TableHead>
                    {periodBSummary && <TableHead className="text-right">Period B</TableHead>}
                    {periodBSummary && <TableHead className="text-right">Change</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { label: "Proposals Sent", a: periodASummary.total, b: periodBSummary?.total, isCurrency: false },
                    { label: "Proposals Won", a: periodASummary.converted, b: periodBSummary?.converted, isCurrency: false },
                    { label: "Win Rate", a: periodASummary.rate, b: periodBSummary?.rate, isCurrency: false, suffix: "%" },
                    { label: "Won Value", a: periodASummary.convertedValue, b: periodBSummary?.convertedValue, isCurrency: true },
                    { label: "Total Value", a: periodASummary.totalValue, b: periodBSummary?.totalValue, isCurrency: true },
                    { label: "Change Orders", a: periodASummary.coCount, b: periodBSummary?.coCount, isCurrency: false },
                    { label: "CO Value", a: periodASummary.coValue, b: periodBSummary?.coValue, isCurrency: true },
                  ].map((row) => {
                    const delta = row.b != null ? row.a - row.b : null;
                    const pctChange = row.b != null && row.b > 0 ? Math.round(((row.a - row.b) / row.b) * 100) : null;
                    return (
                      <TableRow key={row.label}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="text-right">{row.isCurrency ? fmt(row.a) : `${row.a}${row.suffix || ""}`}</TableCell>
                        {periodBSummary && (
                          <TableCell className="text-right text-muted-foreground">
                            {row.isCurrency ? fmt(row.b ?? 0) : `${row.b ?? 0}${row.suffix || ""}`}
                          </TableCell>
                        )}
                        {periodBSummary && (
                          <TableCell className={cn("text-right font-medium", delta != null && delta > 0 ? "text-green-600" : delta != null && delta < 0 ? "text-destructive" : "text-muted-foreground")}>
                            {pctChange != null ? `${pctChange > 0 ? "+" : ""}${pctChange}%` : "—"}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
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
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
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
              <p className="text-xs text-muted-foreground">Avg CO Size</p>
              <p className="text-2xl font-bold">{fmt(data.avgCOSize)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Approval Rate</p>
              <p className="text-2xl font-bold">{data.approvalRate}%</p>
              <p className="text-xs text-muted-foreground">{data.pendingCOs} pending · {data.rejectedCOs} rejected</p>
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

        {/* Monthly CO Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Change Orders — {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={data.coMonthly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="count" orientation="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="value" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number, name: string) => name === "Avg Size" || name === "Value" ? fmt(v) : v} />
                <Legend />
                <Bar yAxisId="count" dataKey="count" name="Count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="value" type="monotone" dataKey="avg" name="Avg Size" stroke="hsl(142, 76%, 36%)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Who Writes + Who Gets COs */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Who Writes COs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.coByCreator.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">COs</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Avg Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.coByCreator.map((c: any) => (
                      <TableRow key={c.name}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">{c.count}</TableCell>
                        <TableCell className="text-right">{c.approved}</TableCell>
                        <TableCell className="text-right">{fmt(c.value)}</TableCell>
                        <TableCell className="text-right">{c.count > 0 ? fmt(Math.round(c.value / c.count)) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No change order data</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                COs by Project Manager
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.coByPM.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PM</TableHead>
                      <TableHead className="text-right">COs</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                      <TableHead className="text-right">Avg Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.coByPM.map((pm: any) => (
                      <TableRow key={pm.name}>
                        <TableCell className="font-medium">{pm.name}</TableCell>
                        <TableCell className="text-right">{pm.count}</TableCell>
                        <TableCell className="text-right">{fmt(pm.value)}</TableCell>
                        <TableCell className="text-right">{pm.count > 0 ? fmt(Math.round(pm.value / pm.count)) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No change order data</p>
              )}
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
