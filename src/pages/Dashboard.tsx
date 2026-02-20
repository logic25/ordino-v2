import { useState, useEffect } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";
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
import { Button } from "@/components/ui/button";
import { X, BookOpen, Map } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWalkthrough } from "@/components/walkthrough/WalkthroughProvider";
import { WALKTHROUGHS } from "@/components/walkthrough/walkthroughs";

type DashboardRole = "admin" | "pm" | "accounting" | "manager";

function NewHireWelcomeBanner({ name, onDismiss }: { name: string; onDismiss: () => void }) {
  const { startWalkthrough } = useWalkthrough();
  return (
    <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 px-5 py-4 rounded-xl border bg-primary/5 border-primary/20">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">👋 Welcome to Ordino, {name}!</p>
        <p className="text-sm text-muted-foreground mt-0.5">Get oriented quickly — take a guided tour or explore the Help Desk.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { const wt = WALKTHROUGHS.find(w => w.id === "getting-started"); if (wt) startWalkthrough(wt); onDismiss(); }}>
          <Map className="h-3.5 w-3.5" /> Guided Tour
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" asChild>
          <a href="/help"><BookOpen className="h-3.5 w-3.5" /> Help Desk</a>
        </Button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const { track } = useTelemetry();
  const actualRole = profile?.role || "pm";
  const [previewRole, setPreviewRole] = useState<DashboardRole>(actualRole as DashboardRole);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);

  const role = previewRole;
  const layout = useDashboardLayout(role);

  // Check if new hire (onboarding_completed = false)
  useEffect(() => {
    if (!profile?.id) return;
    const dismissed = localStorage.getItem(`welcome-dismissed-${profile.id}`);
    if (dismissed) return;
    const profileAny = profile as any;
    if (profileAny.onboarding_completed === false) {
      setShowWelcomeBanner(true);
    }
  }, [profile]);

  const handleDismissBanner = async () => {
    setShowWelcomeBanner(false);
    if (profile?.id) {
      localStorage.setItem(`welcome-dismissed-${profile.id}`, "true");
      await supabase.from("profiles").update({ onboarding_completed: true } as any).eq("id", profile.id);
    }
  };

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
              onPreviewChange={(role) => {
                track("dashboard", "role_preview_switched", { role });
                setPreviewRole(role);
              }}
            />
          </div>
        </div>

        {/* New hire welcome banner */}
        {showWelcomeBanner && (
          <NewHireWelcomeBanner
            name={profile?.first_name || "there"}
            onDismiss={handleDismissBanner}
          />
        )}

        {/* Stats Grid - only for PM (others have KPIs built in) */}
        {role === "pm" && <DashboardStats role={role} />}

        {/* Role-specific dashboard */}
        {renderDashboard()}
      </div>
    </AppLayout>
  );
}
