import { Clock, Building2, FileText, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats } from "@/hooks/useDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendingDraftsCount } from "@/hooks/useChecklistFollowupDrafts";
import { Sparkles } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  loading?: boolean;
}

function StatCard({ title, value, subtitle, icon, loading }: StatCardProps) {
  return (
    <Card className="card-hover">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-4 w-24" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface DashboardStatsProps {
  role: "admin" | "manager" | "pm" | "accounting";
}

export function DashboardStats({ role }: DashboardStatsProps) {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: pendingDraftsCount = 0 } = usePendingDraftsCount();

  // PM-only stats (admin/accounting/manager have KPIs built into their views)
  const pmStats = [
    {
      title: "Hours Today",
      value: stats?.todayHours ?? 0,
      subtitle: "Keep logging!",
      icon: <Clock className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "My Projects",
      value: stats?.activeProjects ?? 0,
      subtitle: "Currently assigned",
      icon: <Building2 className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "Pending Proposals",
      value: stats?.pendingProposals ?? 0,
      subtitle: "Awaiting client response",
      icon: <FileText className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "Team Members",
      value: stats?.teamMembers ?? 0,
      subtitle: "Active staff",
      icon: <Users className="h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    <div className="space-y-4">
      {pendingDraftsCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {pendingDraftsCount} auto-generated follow-up draft{pendingDraftsCount > 1 ? "s" : ""} pending review
          </span>
          <span className="text-xs text-muted-foreground ml-auto">Check project readiness checklists</span>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {pmStats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            subtitle={stat.subtitle}
            icon={stat.icon}
            loading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}
