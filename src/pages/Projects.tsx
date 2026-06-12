import { formatCurrency } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useCompanyDashboardSettings } from "@/hooks/useDashboardData";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderKanban, Search, Loader2, Users, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectTable } from "@/components/projects/ProjectTable";
import { BulkActionBar } from "@/components/projects/BulkActionBar";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  ProjectWithRelations,
  ProjectFormInput,
} from "@/hooks/useProjects";
import { useCreateRfiRequest, DEFAULT_PIS_SECTIONS } from "@/hooks/useRfi";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useUserRoles";

export default function Projects() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithRelations | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllProjects, setShowAllProjects] = useState(true);
  const [groupBy, setGroupBy] = useState<"none" | "client" | "address">("none");
  const [statusFilter, setStatusFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("status") || "all";
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const pmFilter = searchParams.get("pm");
  const staleBucket = searchParams.get("stale"); // "fresh" | "warming" | "stale"
  const { data: companySettings } = useCompanyDashboardSettings();
  const companyStaleDays = companySettings?.staleProjectDays ?? 14;

  const { data: projects = [], isLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createRfi = useCreateRfiRequest();

  // If we arrived from "Stale Projects by PM" widget, default to All scope + stale tab
  useEffect(() => {
    if (pmFilter && !showAllProjects) setShowAllProjects(true);
    if (staleBucket === "stale" && statusFilter !== "stale") setStatusFilter("stale");
    if ((staleBucket === "fresh" || staleBucket === "warming") && statusFilter !== "open") setStatusFilter("open");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pmFilter, staleBucket]);

  // Filter by PM assignment (non-admins see only their projects, admins can toggle)
  const myProjects = profile?.id
    ? projects.filter((p) => p.assigned_pm_id === profile.id || p.senior_pm_id === profile.id)
    : projects;
  const baseProjects = showAllProjects ? projects : myProjects;
  const visibleProjects = pmFilter
    ? baseProjects.filter((p) => p.assigned_pm_id === pmFilter || (p as any).senior_pm_id === pmFilter)
    : baseProjects;

  const projectAgeDays = (p: any) =>
    p.last_activity_at
      ? Math.floor((Date.now() - new Date(p.last_activity_at).getTime()) / 86400000)
      : 9999;

  const isStale = (p: any) => {
    if (p.status !== "open" || !p.last_activity_at) return false;
    const threshold = p.stale_threshold_days || companyStaleDays;
    return projectAgeDays(p) >= threshold;
  };

  const matchesBucket = (p: any) => {
    if (!staleBucket) return true;
    if (p.status !== "open") return false;
    const days = projectAgeDays(p);
    const threshold = p.stale_threshold_days || companyStaleDays;
    if (staleBucket === "stale") return days >= threshold;
    if (staleBucket === "warming") return days >= 8 && days < threshold;
    if (staleBucket === "fresh") return days < 8;
    return true;
  };

  const filteredProjects = visibleProjects.filter((p) => {
    // Status filter
    if (statusFilter === "stale") {
      if (!isStale(p)) return false;
    } else if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!matchesBucket(p)) return false;
    // Search filter
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    return (
      p.properties?.address?.toLowerCase().includes(query) ||
      p.project_number?.toLowerCase().includes(query) ||
      p.name?.toLowerCase().includes(query) ||
      p.clients?.name?.toLowerCase().includes(query) ||
      p.proposals?.title?.toLowerCase().includes(query)
    );
  });

  // Stats
  const openCount = visibleProjects.filter((p) => p.status === "open").length;
  const onHoldCount = visibleProjects.filter((p) => p.status === "on_hold").length;
  const closedCount = visibleProjects.filter((p) => ["closed", "paid"].includes(p.status)).length;
  const staleCount = visibleProjects.filter(isStale).length;

  const totalValue = visibleProjects.reduce(
    (sum, p) => sum + Number(p.proposals?.total_amount || 0),
    0
  );


  const handleOpenCreate = () => {
    setEditingProject(null);
    setDialogOpen(true);
  };

  const handleEdit = (project: ProjectWithRelations) => {
    setEditingProject(project);
    setDialogOpen(true);
  };

  const handleView = (project: ProjectWithRelations) => {
    // For now, open edit dialog — will add detail view later
    setEditingProject(project);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: ProjectFormInput) => {
    try {
      if (editingProject) {
        await updateProject.mutateAsync({ id: editingProject.id, ...data });
        toast({ title: "Project updated", description: "The project has been updated." });
      } else {
        await createProject.mutateAsync(data);
        toast({ title: "Project created", description: "New project has been created." });
      }
      setDialogOpen(false);
      setEditingProject(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject.mutateAsync(id);
      toast({ title: "Project deleted", description: "The project has been removed." });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete project.",
        variant: "destructive",
      });
    }
  };

  const handleSendRfi = async (project: ProjectWithRelations) => {
    try {
      // Always use the latest default sections — ignore stale DB templates
      const sections = DEFAULT_PIS_SECTIONS;

      const rfi = await createRfi.mutateAsync({
        project_id: project.id,
        property_id: project.property_id,
        title: `PIS — ${project.name || "Project"} — ${project.properties?.address || ""}`.trim(),
        sections,
      });

      const rfiUrl = `${window.location.origin}/rfi?token=${rfi.access_token}`;
      await navigator.clipboard.writeText(rfiUrl);
      toast({
        title: "RFI Created",
        description: "Link copied to clipboard! Share it with your client.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create RFI.",
        variant: "destructive",
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = (ids: string[], select: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const runBulkUpdate = async (patch: Record<string, any>, label: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    const { error } = await supabase.from("projects").update(patch as any).in("id", ids);
    setBulkBusy(false);
    if (error) {
      toast({ title: "Bulk update failed", description: error.message, variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
    toast({ title: `${ids.length} project${ids.length === 1 ? "" : "s"} updated`, description: label });
    setSelectedIds(new Set());
  };



  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in" data-tour="projects-page">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" data-tour="projects-header">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-1">
              {showAllProjects ? "All company projects" : "Your assigned projects"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as "none" | "client" | "address")}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Group projects by"
            >
              <option value="none">No grouping</option>
              <option value="client">Group by Client</option>
              <option value="address">Group by Address</option>
            </select>
            <Button
              variant={showAllProjects ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setShowAllProjects(!showAllProjects)}
            >
              <Users className="h-4 w-4" />
              {showAllProjects ? "All Projects" : "My Projects"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4" data-tour="projects-stats">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{openCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Active projects</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">On Hold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{onHoldCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Paused</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{closedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Closed or paid</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(totalValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">All projects</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="overflow-x-auto w-full sm:w-auto scrollbar-hide">
              <TabsList className="inline-flex w-auto">
                <TabsTrigger value="all">All ({visibleProjects.length})</TabsTrigger>
                <TabsTrigger value="open">Open ({openCount})</TabsTrigger>
                <TabsTrigger value="on_hold">On Hold ({onHoldCount})</TabsTrigger>
                <TabsTrigger value="closed">Closed ({visibleProjects.filter(p => p.status === "closed").length})</TabsTrigger>
                <TabsTrigger
                  value="paid"
                  title="Projects whose final invoice has been paid. Lifecycle: Open → Closed → Paid."
                >
                  Paid ({visibleProjects.filter(p => p.status === "paid").length})
                </TabsTrigger>
                <TabsTrigger
                  value="stale"
                  title="Open projects with no activity in 14+ days (time, notes, status, email). Still open — just a nudge."
                  className="data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground"
                >
                  Stale ({staleCount})
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="relative w-full sm:max-w-md sm:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by project #, name, property, or client..."
                className="pl-9 border-2 border-border bg-background shadow-sm focus:border-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5" />
              {showAllProjects ? "All Projects" : "My Projects"}
              {!isLoading && (
                <span className="text-muted-foreground font-normal text-sm">
                  ({filteredProjects.length})
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Projects are created from signed proposals or manually. Each project links to a
              property and can have DOB applications, services, and more.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProjects.length === 0 && !searchQuery ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No projects yet</h3>
                <p className="text-muted-foreground mt-1 mb-4 max-w-sm">
                  Projects are created when proposals are signed. Create a proposal first, then sign it to generate a project.
                </p>
              </div>
            ) : groupBy === "none" ? (
              <ProjectTable
                projects={filteredProjects}
                onEdit={handleEdit}
                onView={handleView}
                onDelete={handleDelete}
                onSendRfi={handleSendRfi}
                isDeleting={deleteProject.isPending}
                isSendingRfi={createRfi.isPending}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleAll={toggleAll}
              />
            ) : (
              (() => {
                const groups = new Map<string, ProjectWithRelations[]>();
                filteredProjects.forEach((p) => {
                  const key =
                    groupBy === "client"
                      ? p.clients?.name || "— No client —"
                      : p.properties?.address || "— No address —";
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(p);
                });
                const sorted = Array.from(groups.entries()).sort(([a], [b]) =>
                  a.localeCompare(b)
                );
                return (
                  <div className="space-y-6">
                    {sorted.map(([key, list]) => {
                      const value = list.reduce(
                        (sum, p) => sum + Number(p.proposals?.total_amount || 0),
                        0
                      );
                      return (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="font-semibold text-base">
                              {key}
                              <span className="ml-2 text-sm font-normal text-muted-foreground">
                                ({list.length})
                              </span>
                            </h3>
                            <span className="text-sm text-muted-foreground">
                              {formatCurrency(value)}
                            </span>
                          </div>
                          <ProjectTable
                            projects={list}
                            onEdit={handleEdit}
                            onView={handleView}
                            onDelete={handleDelete}
                            onSendRfi={handleSendRfi}
                            isDeleting={deleteProject.isPending}
                            isSendingRfi={createRfi.isPending}
                            selectedIds={selectedIds}
                            onToggleSelect={toggleSelect}
                            onToggleAll={toggleAll}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </CardContent>
        </Card>
      </div>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        project={editingProject}
        isLoading={createProject.isPending || updateProject.isPending}
      />

      <BulkActionBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onSetStatus={(s) => runBulkUpdate({ status: s }, `Status → ${s}`)}
        onAssignPm={(id) => runBulkUpdate({ assigned_pm_id: id }, id ? "PM assigned" : "PM cleared")}
        isBusy={bulkBusy}
      />
    </AppLayout>
  );
}
