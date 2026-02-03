import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { RecentProjects } from "@/components/dashboard/RecentProjects";
import { QuickTimeLog } from "@/components/dashboard/QuickTimeLog";
import { BillingSummary } from "@/components/dashboard/BillingSummary";
import { TeamOverview } from "@/components/dashboard/TeamOverview";

export default function Dashboard() {
  const { profile } = useAuth();
  const role = profile?.role || "pm";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getRoleDescription = () => {
    switch (role) {
      case "pm":
        return "Here are your assigned projects and quick actions.";
      case "accounting":
        return "Here's your billing overview and revenue opportunities.";
      case "manager":
        return "Here's your team's progress and project status.";
      case "admin":
        return "Here's an overview of your company's operations.";
      default:
        return "Here's what's happening with your projects today.";
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {getGreeting()}, {profile?.first_name || "there"}!
          </h1>
          <p className="text-muted-foreground mt-1">{getRoleDescription()}</p>
        </div>

        {/* Stats Grid - role-based */}
        <DashboardStats role={role} />

        {/* Main Content Grid - role-based layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* PM View: My projects + Quick log */}
          {role === "pm" && (
            <>
              <RecentProjects showOnlyMine />
              <QuickTimeLog />
            </>
          )}

          {/* Accounting View: Billing summary + Recent projects */}
          {role === "accounting" && (
            <>
              <RecentProjects />
              <BillingSummary />
            </>
          )}

          {/* Manager View: Team + Recent projects */}
          {role === "manager" && (
            <>
              <RecentProjects />
              <TeamOverview />
            </>
          )}

          {/* Admin View: Everything */}
          {role === "admin" && (
            <>
              <RecentProjects />
              <div className="space-y-6">
                <TeamOverview />
                <QuickTimeLog />
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
