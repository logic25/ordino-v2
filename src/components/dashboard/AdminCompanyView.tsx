import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, TrendingUp, Users, DollarSign } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboard";
import { useRevenueTrend } from "@/hooks/useDashboardData";
import { PMDailyView } from "./PMDailyView";
import { TeamOverview } from "./TeamOverview";
import { ProposalFollowUps } from "./ProposalFollowUps";
import { YearOverYearChart } from "./YearOverYearChart";
import { ProposalActivityCard } from "./ProposalActivityCard";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export function AdminCompanyView() {
  const [view, setView] = useState<"company" | "my">("company");
  const [trendPeriod, setTrendPeriod] = useState("6");
  const { data: stats, isLoading } = useDashboardStats();
  const { data: revenueTrend, isLoading: trendLoading } = useRevenueTrend(parseInt(trendPeriod));

  if (view === "my") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setView("company")}>
            ← Company View
          </Button>
        </div>
        <PMDailyView />
      </div>
    );
  }

  const kpis = [
    { label: "Active Projects", value: stats?.activeProjects ?? 0, icon: Building2 },
    { label: "Team Members", value: stats?.teamMembers ?? 0, icon: Users },
    { label: "Outstanding", value: `$${((stats?.totalOutstanding ?? 0) / 1000).toFixed(0)}k`, icon: DollarSign },
    { label: "Overdue Invoices", value: stats?.overdueInvoices ?? 0, icon: TrendingUp },
  ];

  const formatCurrency = (v: number) => {
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
    return `$${v}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setView("my")}>
          My View →
        </Button>
      </div>

      {/* Row 1: KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: Revenue Trend -- full width, taller */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Revenue Trend</CardTitle>
          <Select value={trendPeriod} onValueChange={setTrendPeriod}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 Months</SelectItem>
              <SelectItem value="6">6 Months</SelectItem>
              <SelectItem value="12">12 Months</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <Skeleton className="h-[360px] w-full" />
          ) : revenueTrend && revenueTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={revenueTrend} barGap={2}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
                <Tooltip
                  formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="billed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Billed" />
                <Bar dataKey="collected" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Collected" />
                <Bar dataKey="outstanding" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Outstanding" opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[360px] flex items-center justify-center text-muted-foreground text-sm">
              No invoice data yet. Revenue will appear here as invoices are created.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 3: YoY + Proposal Activity + Follow-Ups */}
      <div className="grid gap-6 lg:grid-cols-3">
        <YearOverYearChart />
        <ProposalActivityCard />
        <ProposalFollowUps />
      </div>

      {/* Row 4: Team Overview */}
      <TeamOverview />
    </div>
  );
}
