import { Clock, Building2, FileText, AlertCircle, Users, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats } from "@/hooks/useDashboard";
import { Skeleton } from "@/components/ui/skeleton";

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

  // Role-based stat configuration
  const getStatsForRole = () => {
    const baseStats = [
      {
        title: "Active Projects",
        value: stats?.activeProjects ?? 0,
        subtitle: `${stats?.overdueInvoices ?? 0} overdue invoices`,
        icon: <Building2 className="h-4 w-4 text-muted-foreground" />,
      },
    ];

    switch (role) {
      case "pm":
        return [
          {
            title: "Hours Today",
            value: stats?.todayHours ?? 0,
            subtitle: "Keep logging!",
            icon: <Clock className="h-4 w-4 text-muted-foreground" />,
          },
          ...baseStats,
          {
            title: "Pending Proposals",
            value: stats?.pendingProposals ?? 0,
            subtitle: "Awaiting client response",
            icon: <FileText className="h-4 w-4 text-muted-foreground" />,
          },
          {
            title: "Overdue Invoices",
            value: stats?.overdueInvoices ?? 0,
            subtitle: "Need follow-up",
            icon: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
          },
        ];

      case "accounting":
        return [
          {
            title: "Unbilled Hours",
            value: stats?.unbilledHours ?? 0,
            subtitle: "Ready to invoice",
            icon: <DollarSign className="h-4 w-4 text-muted-foreground" />,
          },
          ...baseStats,
          {
            title: "Overdue Invoices",
            value: stats?.overdueInvoices ?? 0,
            subtitle: `$${((stats?.totalOutstanding ?? 0) / 1000).toFixed(0)}k outstanding`,
            icon: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
          },
          {
            title: "Pending Proposals",
            value: stats?.pendingProposals ?? 0,
            subtitle: "Awaiting approval",
            icon: <FileText className="h-4 w-4 text-muted-foreground" />,
          },
        ];

      case "manager":
        return [
          {
            title: "Team Members",
            value: stats?.teamMembers ?? 0,
            subtitle: "Active staff",
            icon: <Users className="h-4 w-4 text-muted-foreground" />,
          },
          ...baseStats,
          {
            title: "Hours Today",
            value: stats?.todayHours ?? 0,
            subtitle: "Team total",
            icon: <Clock className="h-4 w-4 text-muted-foreground" />,
          },
          {
            title: "Overdue Invoices",
            value: stats?.overdueInvoices ?? 0,
            subtitle: "Need attention",
            icon: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
          },
        ];

      case "admin":
      default:
        return [
          {
            title: "Team Members",
            value: stats?.teamMembers ?? 0,
            subtitle: "Active staff",
            icon: <Users className="h-4 w-4 text-muted-foreground" />,
          },
          ...baseStats,
          {
            title: "Outstanding",
            value: `$${((stats?.totalOutstanding ?? 0) / 1000).toFixed(0)}k`,
            subtitle: `${stats?.overdueInvoices ?? 0} overdue`,
            icon: <DollarSign className="h-4 w-4 text-muted-foreground" />,
          },
          {
            title: "Unbilled Hours",
            value: stats?.unbilledHours ?? 0,
            subtitle: "Ready to invoice",
            icon: <Clock className="h-4 w-4 text-muted-foreground" />,
          },
        ];
    }
  };

  const statsToShow = getStatsForRole();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statsToShow.map((stat, i) => (
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
  );
}
