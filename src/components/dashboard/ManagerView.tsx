import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/useDashboard";
import { useTeamUtilization, useProjectsByPM } from "@/hooks/useDashboardData";
import { TeamOverview } from "./TeamOverview";
import { ProposalFollowUps } from "./ProposalFollowUps";
import { Users, Clock, FileText, FolderKanban } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export function ManagerView() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: utilization = [], isLoading: utilLoading } = useTeamUtilization();
  const { data: projectsByPM = [], isLoading: pmLoading } = useProjectsByPM();

  const kpis = [
    { label: "Team Members", value: stats?.teamMembers ?? 0, icon: Users },
    { label: "Active Projects", value: stats?.activeProjects ?? 0, icon: FileText },
    { label: "Hours Today (Team)", value: stats?.todayHours ?? 0, icon: Clock },
    { label: "Pending Proposals", value: stats?.pendingProposals ?? 0, icon: FolderKanban },
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
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold">{kpi.value}</p>
                    <kpi.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Team Utilization */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team Utilization (This Week)</CardTitle>
            <CardDescription>Billable vs total hours by team member</CardDescription>
          </CardHeader>
          <CardContent>
            {utilLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : utilization.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={utilization.slice(0, 8)} layout="vertical" barGap={2}>
                  <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip
                    formatter={(v: number, name: string) => [`${v}h`, name]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="billableHours" fill="hsl(var(--primary))" name="Billable" radius={[0, 4, 4, 0]} stackId="hours" />
                  <Bar dataKey="totalHours" fill="hsl(var(--muted-foreground))" name="Total" radius={[0, 4, 4, 0]} opacity={0.3} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8 text-sm">No time data this week</p>
            )}
          </CardContent>
        </Card>

        {/* Projects by PM */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects by PM</CardTitle>
            <CardDescription>Active project distribution across team</CardDescription>
          </CardHeader>
          <CardContent>
            {pmLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : projectsByPM.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={projectsByPM.slice(0, 8)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="projects" name="Projects" radius={[0, 4, 4, 0]}>
                    {projectsByPM.slice(0, 8).map((_: any, i: number) => {
                      const colors = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))", "hsl(var(--secondary))"];
                      return <Cell key={i} fill={colors[i % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8 text-sm">No project assignments found</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProposalFollowUps />
        </div>
        <TeamOverview />
      </div>
    </div>
  );
}
