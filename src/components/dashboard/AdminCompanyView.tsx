import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, TrendingUp, Users } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboard";
import { PMDailyView } from "./PMDailyView";
import { RecentProjects } from "./RecentProjects";
import { TeamOverview } from "./TeamOverview";
import { ProposalFollowUps } from "./ProposalFollowUps";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useBillingReports } from "@/hooks/useReports";

export function AdminCompanyView() {
  const [view, setView] = useState<"company" | "my">("company");
  const { data: stats, isLoading } = useDashboardStats();
  const { data: billing } = useBillingReports();

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
    { label: "Outstanding", value: `$${((stats?.totalOutstanding ?? 0) / 1000).toFixed(0)}k`, icon: TrendingUp },
    { label: "Overdue Invoices", value: stats?.overdueInvoices ?? 0, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setView("my")}>
          My View →
        </Button>
      </div>

      {/* KPI Row */}
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

      {/* Revenue Chart + Sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend (6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {billing?.months ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={billing.months}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="collected" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Collected" />
                  <Bar dataKey="outstanding" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Outstanding" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton className="h-[250px] w-full" />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <ProposalFollowUps />
          <TeamOverview />
        </div>
      </div>

      <RecentProjects />
    </div>
  );
}
