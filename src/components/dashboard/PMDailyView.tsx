import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Clock, Circle, FolderKanban, ArrowRight, ClipboardCheck } from "lucide-react";
import { useMyAssignedProjects } from "@/hooks/useDashboard";
import { ProposalFollowUps } from "./ProposalFollowUps";
import { QuickTimeLog } from "./QuickTimeLog";
import { MyActionItemsCard } from "./MyActionItemsCard";
import { differenceInDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function useMyProjectReadiness() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["my-project-readiness", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data: projects } = await supabase
        .from("projects")
        .select(`
          id, name, project_number, status,
          properties(address),
          clients!projects_client_id_fkey(name)
        `)
        .or(`assigned_pm_id.eq.${profile.id},senior_pm_id.eq.${profile.id}`)
        .eq("status", "open");

      if (!projects || projects.length === 0) return [];

      const projectIds = projects.map((p: any) => p.id);
      const { data: checklistItems } = await supabase
        .from("project_checklist_items")
        .select("id, project_id, status, label")
        .in("project_id", projectIds);

      const byProject: Record<string, { total: number; done: number; missing: string[] }> = {};
      (checklistItems || []).forEach((item: any) => {
        if (!byProject[item.project_id]) byProject[item.project_id] = { total: 0, done: 0, missing: [] };
        byProject[item.project_id].total++;
        if (item.status === "received") {
          byProject[item.project_id].done++;
        } else {
          byProject[item.project_id].missing.push(item.label || "Unnamed item");
        }
      });

      return projects.map((p: any) => {
        const checklist = byProject[p.id] || { total: 0, done: 0, missing: [] };
        return {
          ...p,
          checklistTotal: checklist.total,
          checklistDone: checklist.done,
          missingItems: checklist.missing.slice(0, 3),
          readyPercent: checklist.total > 0 ? Math.round((checklist.done / checklist.total) * 100) : 0,
        };
      }).sort((a: any, b: any) => a.readyPercent - b.readyPercent);
    },
    enabled: !!profile?.id,
  });
}

export function PMDailyView({ isVisible }: { isVisible?: (id: string) => boolean }) {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useMyAssignedProjects();
  const { data: readiness = [], isLoading: readinessLoading } = useMyProjectReadiness();

  const show = isVisible || (() => true);

  const now = new Date();

  const categorized = (projects || []).reduce<{
    stale: any[];
    needsUpdate: any[];
    active: any[];
    all: any[];
  }>(
    (acc, p) => {
      const daysSinceUpdate = differenceInDays(now, new Date(p.updated_at));
      const item = { ...p, daysSinceUpdate };
      if (daysSinceUpdate > 14) acc.stale.push(item);
      else if (daysSinceUpdate > 7) acc.needsUpdate.push(item);
      else acc.active.push(item);
      acc.all.push(item);
      return acc;
    },
    { stale: [], needsUpdate: [], active: [], all: [] }
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {show("my-projects") && (
        <div className="lg:col-span-2 space-y-6">
        {/* My Active Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Projects</CardTitle>
            <CardDescription>Projects assigned to you, sorted by activity</CardDescription>
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
            ) : categorized.all.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-primary/50 mb-3" />
                <p className="text-muted-foreground">No projects assigned to you yet</p>
              </div>
            ) : (
              <>
                {categorized.stale.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" /> Stale — No activity 14+ days
                    </h4>
                    {categorized.stale.map((p) => (
                      <ProjectRow key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
                    ))}
                  </div>
                )}
                {categorized.needsUpdate.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Needs Update — 7-14 days
                    </h4>
                    {categorized.needsUpdate.map((p) => (
                      <ProjectRow key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
                    ))}
                  </div>
                )}
                {categorized.active.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3" /> Recently Active
                    </h4>
                    {categorized.active.map((p) => (
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

        {/* Project Readiness */}
        {show("project-readiness") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Project Readiness
            </CardTitle>
            <CardDescription>Checklist completion and missing items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {readinessLoading ? (
              [1, 2].map((i) => (
                <div key={i} className="p-3 rounded-lg border space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))
            ) : readiness.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No project checklists found</p>
            ) : (
              readiness.map((p: any) => {
                const isComplete = p.readyPercent === 100;
                const isInProgress = p.readyPercent > 0 && p.readyPercent < 100;
                const cardClass = isComplete
                  ? "border-l-4 border-l-green-500 bg-green-500/5"
                  : isInProgress
                  ? "border-l-4 border-l-amber-500 bg-amber-500/5"
                  : "";
                return (
                <div
                  key={p.id}
                  className={`p-3 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer ${cardClass}`}
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {isComplete ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      ) : isInProgress ? (
                        <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-medium text-sm truncate">
                        {p.name || p.properties?.address || "Untitled"}
                      </span>
                    </div>
                    <Badge
                      variant={isComplete ? "default" : p.readyPercent >= 50 ? "secondary" : "destructive"}
                      className="text-xs shrink-0"
                    >
                      {p.checklistDone}/{p.checklistTotal} ({p.readyPercent}%)
                    </Badge>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isComplete
                          ? "bg-green-500"
                          : p.readyPercent >= 50
                          ? "bg-amber-500"
                          : "bg-destructive"
                      }`}
                      style={{ width: `${p.readyPercent}%` }}
                    />
                  </div>
                  {p.missingItems.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.missingItems.map((item: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                          Missing: {item}
                        </span>
                      ))}
                      {p.checklistTotal - p.checklistDone > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{p.checklistTotal - p.checklistDone - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                );
              })
            )}
          </CardContent>
        </Card>
        )}
      </div>
      )}

      {/* Right: Follow-ups + Quick log */}
      <div className="space-y-6">
        {show("my-action-items") && <MyActionItemsCard />}
        {show("proposal-followups") && <ProposalFollowUps />}
        {show("quick-time-log") && <QuickTimeLog />}
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
