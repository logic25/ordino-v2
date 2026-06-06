import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Clock, Circle, FolderKanban, ArrowRight, ClipboardCheck } from "lucide-react";
import { useMyAssignedProjects } from "@/hooks/useDashboard";
import { ProposalFollowUps } from "./ProposalFollowUps";
import { MyActionItemsCard } from "./MyActionItemsCard";
import { differenceInDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const BUCKET_PREVIEW = 3;

function ProjectBucket({
  id,
  title,
  tone,
  icon,
  items,
  onItemClick,
}: {
  id?: string;
  title: string;
  tone: "destructive" | "amber" | "muted";
  icon: React.ReactNode;
  items: any[];
  onItemClick: (p: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const toneClass =
    tone === "destructive" ? "text-destructive" : tone === "amber" ? "text-amber-600" : "text-muted-foreground";
  const visible = expanded ? items : items.slice(0, BUCKET_PREVIEW);
  const hidden = items.length - visible.length;
  return (
    <div id={id} className="space-y-2 scroll-mt-24">
      <h4 className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${toneClass}`}>
        {icon} {title} <span className="text-muted-foreground font-normal normal-case tracking-normal">· {items.length}</span>
      </h4>
      {visible.map((p) => (
        <ProjectRow key={p.id} project={p} onClick={() => onItemClick(p)} />
      ))}
      {items.length > BUCKET_PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors pl-1"
        >
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}


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
  const [readinessExpanded, setReadinessExpanded] = useState(false);

  const show = isVisible || (() => true);

  const now = new Date();

  const categorized = (projects || []).reduce<{
    untouched: any[];
    onYou: any[];
    waitingClient: any[];
    stale: any[];
    active: any[];
    all: any[];
  }>(
    (acc, p) => {
      const daysSinceUpdate = differenceInDays(now, new Date(p.updated_at));
      const daysSinceCreate = differenceInDays(now, new Date((p as any).created_at));
      const updatedSinceCreate = differenceInDays(new Date(p.updated_at), new Date((p as any).created_at));
      const waitingOn = (p as any).waiting_on || "us";
      const waitingSince = (p as any).waiting_since ? new Date((p as any).waiting_since) : null;
      const daysWaiting = waitingSince ? differenceInDays(now, waitingSince) : 0;
      const item = { ...p, daysSinceUpdate, waitingOn, daysWaiting };

      // Untouched: never meaningfully edited (updated_at within 1 day of created_at) and at least 3 days old
      if (updatedSinceCreate <= 1 && daysSinceCreate >= 3) {
        acc.untouched.push(item);
      } else if (waitingOn === "us" && daysSinceUpdate >= 7) {
        acc.onYou.push(item);
      } else if (waitingOn === "client" && daysWaiting >= 14) {
        acc.waitingClient.push(item);
      } else if (daysSinceUpdate >= 30) {
        acc.stale.push(item);
      } else {
        acc.active.push(item);
      }
      acc.all.push(item);
      return acc;
    },
    { untouched: [], onYou: [], waitingClient: [], stale: [], active: [], all: [] }
  );

  // Sort Recently Active oldest-first so neglected ones rise; no cap.
  categorized.active.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);


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
                <ProjectBucket
                  id="bucket-untouched"
                  title="Hasn't been touched"
                  tone="amber"
                  icon={<AlertTriangle className="h-3 w-3" />}
                  items={categorized.untouched}
                  onItemClick={(p) => navigate(`/projects/${p.id}`)}
                />
                <ProjectBucket
                  id="bucket-on-you"
                  title="On you — idle 7+ days"
                  tone="destructive"
                  icon={<AlertTriangle className="h-3 w-3" />}
                  items={categorized.onYou}
                  onItemClick={(p) => navigate(`/projects/${p.id}`)}
                />
                <ProjectBucket
                  id="bucket-waiting-client"
                  title="Waiting on client — 14+ days"
                  tone="amber"
                  icon={<Clock className="h-3 w-3" />}
                  items={categorized.waitingClient}
                  onItemClick={(p) => navigate(`/projects/${p.id}`)}
                />
                <ProjectBucket
                  title="Truly stale — 30+ days"
                  tone="muted"
                  icon={<Clock className="h-3 w-3" />}
                  items={categorized.stale}
                  onItemClick={(p) => navigate(`/projects/${p.id}`)}
                />
                {categorized.untouched.length === 0 &&
                  categorized.onYou.length === 0 &&
                  categorized.waitingClient.length === 0 &&
                  categorized.stale.length === 0 && (
                    <div className="flex flex-col items-center py-6 text-center">
                      <CheckCircle2 className="h-8 w-8 text-primary/60 mb-2" />
                      <p className="text-sm text-muted-foreground">All caught up — no projects need attention right now.</p>
                    </div>
                  )}
                <Button variant="outline" className="w-full" onClick={() => navigate("/projects")}>
                  View all my projects <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Project Readiness */}
        {show("project-readiness") && (
        <Card id="section-readiness" className="scroll-mt-24">
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
            ) : (() => {
              const incomplete = (readiness as any[]).filter((p) => p.readyPercent < 100);
              if (incomplete.length === 0) {
                return (
                  <div className="flex flex-col items-center py-4 text-center">
                    <CheckCircle2 className="h-7 w-7 text-green-600 mb-2" />
                    <p className="text-sm text-muted-foreground">All your projects are checklist-complete.</p>
                  </div>
                );
              }
              const visible = readinessExpanded ? incomplete : incomplete.slice(0, 3);
              const hidden = incomplete.length - visible.length;
              return (
                <>
                  {visible.map((p: any) => {
                    const isInProgress = p.readyPercent > 0;
                    const cardClass = isInProgress
                      ? "border-l-4 border-l-amber-500 bg-amber-500/5"
                      : "border-l-4 border-l-destructive bg-destructive/5";
                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer ${cardClass}`}
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isInProgress ? (
                              <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="font-medium text-sm truncate">
                              {p.name || p.properties?.address || "Untitled"}
                            </span>
                          </div>
                          <Badge
                            variant={p.readyPercent >= 50 ? "secondary" : "destructive"}
                            className="text-xs shrink-0"
                          >
                            {p.checklistDone}/{p.checklistTotal} ({p.readyPercent}%)
                          </Badge>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all ${p.readyPercent >= 50 ? "bg-amber-500" : "bg-destructive"}`}
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
                  })}
                  {incomplete.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setReadinessExpanded((v) => !v)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors pl-1"
                    >
                      {readinessExpanded ? "Show less" : `Show ${hidden} more`}
                    </button>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
        )}
      </div>
      )}

      {/* Right: My tasks + proposal follow-ups */}
      <div className="space-y-6">
        {show("my-action-items") && <MyActionItemsCard />}
        {show("proposal-followups") && <ProposalFollowUps />}
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

  const waitingLabels: Record<string, string> = {
    client: "⏸ Waiting on client",
    agency: "⏸ Waiting on agency",
    partner: "⏸ Waiting on partner",
    none: "✓ No blockers",
  };
  const waitingBadge = project.waitingOn && waitingLabels[project.waitingOn];

  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="space-y-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm truncate">
            {project.name || project.properties?.address || "Untitled"}
          </span>
          <Badge className={statusColors[project.status] || "bg-muted"} variant="secondary">
            {project.status?.replace("_", " ")}
          </Badge>
          {waitingBadge && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {waitingBadge}
              {project.daysWaiting > 0 && ` · ${project.daysWaiting}d`}
            </Badge>
          )}
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
