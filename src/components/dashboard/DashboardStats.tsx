import { Clock, AlertTriangle, UserClock, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats, useMyAssignedProjects } from "@/hooks/useDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendingDraftsCount } from "@/hooks/useChecklistFollowupDrafts";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays } from "date-fns";

// Lucide doesn't have UserClock; alias to Clock + warning combo via icons we already imported.
// (Keeping import list lean.)

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
  accent?: "neutral" | "destructive" | "amber";
}

function StatCard({ title, value, subtitle, icon, loading, onClick, accent = "neutral" }: StatCardProps) {
  const accentClass =
    accent === "destructive"
      ? "border-l-4 border-l-destructive"
      : accent === "amber"
      ? "border-l-4 border-l-amber-500"
      : "";
  return (
    <Card
      className={`card-hover cursor-pointer hover:shadow-md transition-shadow ${accentClass}`}
      onClick={onClick}
    >
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
              <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function useMyReadinessLite() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["my-readiness-lite", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [] as Array<{ id: string; name: string; readyPercent: number }>;
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, properties(address)")
        .or(`assigned_pm_id.eq.${profile.id},senior_pm_id.eq.${profile.id}`)
        .eq("status", "open");
      if (!projects?.length) return [];
      const ids = projects.map((p: any) => p.id);
      const { data: items } = await supabase
        .from("project_checklist_items")
        .select("project_id, status")
        .in("project_id", ids);
      const agg: Record<string, { total: number; done: number }> = {};
      (items || []).forEach((i: any) => {
        const a = (agg[i.project_id] ||= { total: 0, done: 0 });
        a.total++;
        if (i.status === "received") a.done++;
      });
      return projects.map((p: any) => {
        const a = agg[p.id] || { total: 0, done: 0 };
        return {
          id: p.id,
          name: p.name || p.properties?.address || "Untitled",
          readyPercent: a.total > 0 ? Math.round((a.done / a.total) * 100) : 0,
        };
      });
    },
    enabled: !!profile?.id,
  });
}

interface DashboardStatsProps {
  role: "admin" | "manager" | "pm" | "accounting";
}

export function DashboardStats({ role }: DashboardStatsProps) {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useDashboardStats();
  const { data: pendingDraftsCount = 0 } = usePendingDraftsCount();
  const { data: myProjects = [], isLoading: projLoading } = useMyAssignedProjects();
  const { data: readiness = [], isLoading: readyLoading } = useMyReadinessLite();

  const now = new Date();
  const onYouCount = (myProjects || []).filter((p: any) => {
    const waitingOn = p.waiting_on || "us";
    const days = differenceInDays(now, new Date(p.updated_at));
    return waitingOn === "us" && days >= 7;
  }).length;

  const waitingClientCount = (myProjects || []).filter((p: any) => {
    if (p.waiting_on !== "client") return false;
    const since = p.waiting_since ? new Date(p.waiting_since) : null;
    return since ? differenceInDays(now, since) >= 14 : false;
  }).length;

  const lowReadiness = (readiness || []).filter((r) => r.readyPercent < 50);
  const lowestProject = [...lowReadiness].sort((a, b) => a.readyPercent - b.readyPercent)[0];

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pmStats = [
    {
      title: "Hours Today",
      value: stats?.todayHours ?? 0,
      subtitle: "Keep logging",
      icon: <Clock className="h-4 w-4 text-muted-foreground" />,
      onClick: () => navigate("/time"),
      accent: "neutral" as const,
      loading: isLoading,
    },
    {
      title: "On You",
      value: onYouCount,
      subtitle: "Idle 7+ days — your move",
      icon: <AlertTriangle className={`h-4 w-4 ${onYouCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />,
      onClick: () => scrollTo("bucket-on-you"),
      accent: onYouCount > 0 ? ("destructive" as const) : ("neutral" as const),
      loading: projLoading,
    },
    {
      title: "Waiting on Client",
      value: waitingClientCount,
      subtitle: "14+ days — time to nudge",
      icon: <UserClock className={`h-4 w-4 ${waitingClientCount > 0 ? "text-amber-600" : "text-muted-foreground"}`} />,
      onClick: () => scrollTo("bucket-waiting-client"),
      accent: waitingClientCount > 0 ? ("amber" as const) : ("neutral" as const),
      loading: projLoading,
    },
    {
      title: "Readiness < 50%",
      value: lowReadiness.length,
      subtitle: lowestProject
        ? `Lowest: ${lowestProject.name} (${lowestProject.readyPercent}%)`
        : "All projects in good shape",
      icon: <ClipboardCheck className={`h-4 w-4 ${lowReadiness.length > 0 ? "text-amber-600" : "text-muted-foreground"}`} />,
      onClick: () => scrollTo("section-readiness"),
      accent: lowReadiness.length > 0 ? ("amber" as const) : ("neutral" as const),
      loading: readyLoading,
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
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {pmStats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>
    </div>
  );
}

// Fallback for UserClock icon (not in lucide-react default export)
function UserClock({ className }: { className?: string }) {
  return <Clock className={className} />;
}
