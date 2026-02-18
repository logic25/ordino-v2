import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Clock, FolderKanban, ArrowRight } from "lucide-react";
import { useMyAssignedProjects } from "@/hooks/useDashboard";
import { ProposalFollowUps } from "./ProposalFollowUps";
import { QuickTimeLog } from "./QuickTimeLog";
import { differenceInDays } from "date-fns";

export function PMDailyView() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useMyAssignedProjects();

  const now = new Date();

  const categorized = (projects || []).reduce<{
    overdue: any[];
    today: any[];
    upcoming: any[];
    active: any[];
  }>(
    (acc, p) => {
      const daysSinceUpdate = differenceInDays(now, new Date(p.updated_at));
      if (daysSinceUpdate > 14) acc.overdue.push({ ...p, daysSinceUpdate });
      else if (daysSinceUpdate > 7) acc.upcoming.push({ ...p, daysSinceUpdate });
      else acc.today.push({ ...p, daysSinceUpdate });
      acc.active.push({ ...p, daysSinceUpdate });
      return acc;
    },
    { overdue: [], today: [], upcoming: [], active: [] }
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: Priority tasks + Active projects */}
      <div className="lg:col-span-2 space-y-6">
        {/* Priority Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Day</CardTitle>
            <CardDescription>Projects needing your attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Skeleton className="h-5 w-5" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))
            ) : categorized.active.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-primary/50 mb-3" />
                <p className="text-muted-foreground">No projects assigned to you yet</p>
              </div>
            ) : (
              <>
                {categorized.overdue.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" /> Stale — No activity 14+ days
                    </h4>
                    {categorized.overdue.map((p) => (
                      <ProjectRow key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
                    ))}
                  </div>
                )}
                {categorized.upcoming.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Needs Update — 7-14 days
                    </h4>
                    {categorized.upcoming.map((p) => (
                      <ProjectRow key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
                    ))}
                  </div>
                )}
                {categorized.today.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3" /> Recently Active
                    </h4>
                    {categorized.today.map((p) => (
                      <ProjectRow key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
                    ))}
                  </div>
                )}
                <Button variant="outline" className="w-full" onClick={() => navigate("/projects")}>
                  View All Projects <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Follow-ups + Quick log */}
      <div className="space-y-6">
        <ProposalFollowUps />
        <QuickTimeLog />
      </div>
    </div>
  );
}

function ProjectRow({ project, onClick }: { project: any; onClick: () => void }) {
  const statusColors: Record<string, string> = {
    open: "bg-green-500/10 text-green-700",
    on_hold: "bg-amber-500/10 text-amber-700",
    closed: "bg-muted text-muted-foreground",
  };

  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="space-y-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm truncate">
            {project.name || project.properties?.address || "Untitled"}
          </span>
          <Badge className={statusColors[project.status] || "bg-muted"} variant="secondary">
            {project.status?.replace("_", " ")}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground pl-6">
          {project.project_number && `#${project.project_number} • `}
          {project.clients?.name || ""}
          {project.daysSinceUpdate != null && ` • ${project.daysSinceUpdate}d since update`}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}
