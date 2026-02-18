import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { PMDailyView } from "@/components/dashboard/PMDailyView";
import { AdminCompanyView } from "@/components/dashboard/AdminCompanyView";
import { AccountingView } from "@/components/dashboard/AccountingView";
import { ManagerView } from "@/components/dashboard/ManagerView";
import { RolePreviewSelector } from "@/components/dashboard/RolePreviewSelector";
import { DashboardLayoutConfig } from "@/components/dashboard/DashboardLayoutConfig";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";

type DashboardRole = "admin" | "pm" | "accounting" | "manager";

export default function Dashboard() {
  const { profile } = useAuth();
  const actualRole = profile?.role || "pm";
  const [previewRole, setPreviewRole] = useState<DashboardRole>(actualRole as DashboardRole);

  const role = previewRole;
  const layout = useDashboardLayout(role);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getRoleDescription = () => {
    switch (role) {
      case "pm":
        return "Here's what needs your attention today.";
      case "accounting":
        return "Here's your billing overview and collection status.";
      case "manager":
        return "Here's your team's performance and workload.";
      case "admin":
        return "Here's an overview of your company's operations.";
      default:
        return "Here's what's happening with your projects today.";
    }
  };

  const renderDashboard = () => {
    switch (role) {
      case "pm":
        return <PMDailyView isVisible={layout.isVisible} />;
      case "admin":
        return <AdminCompanyView isVisible={layout.isVisible} />;
      case "accounting":
        return <AccountingView isVisible={layout.isVisible} />;
      case "manager":
        return <ManagerView isVisible={layout.isVisible} />;
      default:
        return <PMDailyView isVisible={layout.isVisible} />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in" data-tour="dashboard">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {getGreeting()}, {profile?.first_name || "there"}!
            </h1>
            <p className="text-muted-foreground mt-1">{getRoleDescription()}</p>
          </div>
          <div className="flex items-center gap-2">
            <DashboardLayoutConfig
              widgets={layout.widgets}
              visibility={layout.visibility}
              onToggle={layout.toggleWidget}
            />
            <RolePreviewSelector
              currentRole={actualRole}
              previewRole={previewRole}
              onPreviewChange={setPreviewRole}
            />
          </div>
        </div>

        {/* Stats Grid - only for PM (others have KPIs built in) */}
        {role === "pm" && <DashboardStats role={role} />}

        {/* Role-specific dashboard */}
        {renderDashboard()}
      </div>
    </AppLayout>
  );
}
