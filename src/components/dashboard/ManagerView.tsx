import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/useDashboard";
import { useTimeReports } from "@/hooks/useReports";
import { TeamOverview } from "./TeamOverview";
import { RecentProjects } from "./RecentProjects";
import { Users, Clock, FileText, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function ManagerView() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: timeData, isLoading: timeLoading } = useTimeReports();

  const kpis = [
    { label: "Team Members", value: stats?.teamMembers ?? 0, icon: Users },
    { label: "Active Projects", value: stats?.activeProjects ?? 0, icon: FileText },
    { label: "Hours Today", value: stats?.todayHours ?? 0, icon: Clock },
    { label: "Overdue Invoices", value: stats?.overdueInvoices ?? 0, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              {statsLoading ? (
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team Utilization */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Team Utilization</CardTitle>
            <CardDescription>Billable vs non-billable hours by team member</CardDescription>
          </CardHeader>
          <CardContent>
            {timeLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : timeData?.utilization && timeData.utilization.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={timeData.utilization.slice(0, 8)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="billableHours" fill="hsl(var(--primary))" name="Billable" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No time data available</p>
            )}
          </CardContent>
        </Card>

        <TeamOverview />
      </div>

      <RecentProjects />
    </div>
  );
}
