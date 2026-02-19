import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderKanban, Search, Loader2, Users, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectTable } from "@/components/projects/ProjectTable";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
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
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  const { profile } = useAuth();
  const isAdmin = useIsAdmin();

  const { data: projects = [], isLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createRfi = useCreateRfiRequest();

  // Filter by PM assignment (non-admins see only their projects, admins can toggle)
  const myProjects = profile?.id
    ? projects.filter((p) => p.assigned_pm_id === profile.id || p.senior_pm_id === profile.id)
    : projects;
  const visibleProjects = (isAdmin && showAllProjects) ? projects : myProjects;

  const filteredProjects = visibleProjects.filter((p) => {
    // Status filter
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
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

  const totalValue = visibleProjects.reduce(
    (sum, p) => sum + Number(p.proposals?.total_amount || 0),
    0
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);

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

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in" data-tour="projects-page">
        <div className="flex items-center justify-between" data-tour="projects-header">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin && showAllProjects ? "All company projects" : "Your assigned projects"}
            </p>
          </div>
          {isAdmin && (
            <Button
              variant={showAllProjects ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setShowAllProjects(!showAllProjects)}
            >
              <Users className="h-4 w-4" />
              {showAllProjects ? "All Projects" : "My Projects"}
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-4" data-tour="projects-stats">
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
          <div className="flex items-center gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="all">All ({visibleProjects.length})</TabsTrigger>
              <TabsTrigger value="open">Open ({openCount})</TabsTrigger>
              <TabsTrigger value="on_hold">On Hold ({onHoldCount})</TabsTrigger>
              <TabsTrigger value="closed">Closed ({visibleProjects.filter(p => p.status === "closed").length})</TabsTrigger>
              <TabsTrigger value="paid">Paid ({visibleProjects.filter(p => p.status === "paid").length})</TabsTrigger>
            </TabsList>
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by project #, name, property, or client..."
                className="pl-9"
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
              All Projects
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
            ) : (
              <ProjectTable
                projects={filteredProjects}
                onEdit={handleEdit}
                onView={handleView}
                onDelete={handleDelete}
                onSendRfi={handleSendRfi}
                isDeleting={deleteProject.isPending}
                isSendingRfi={createRfi.isPending}
              />
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
    </AppLayout>
  );
}
