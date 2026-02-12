import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderKanban, Search, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useCreateRfiRequest, useRfiTemplates, DEFAULT_PIS_SECTIONS } from "@/hooks/useRfi";
import { useToast } from "@/hooks/use-toast";

export default function Projects() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithRelations | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: projects = [], isLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createRfi = useCreateRfiRequest();
  const { data: rfiTemplates } = useRfiTemplates();

  const filteredProjects = projects.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.properties?.address?.toLowerCase().includes(query) ||
      p.project_number?.toLowerCase().includes(query) ||
      p.name?.toLowerCase().includes(query) ||
      p.clients?.name?.toLowerCase().includes(query) ||
      p.proposals?.title?.toLowerCase().includes(query)
    );
  });

  // Stats
  const openCount = projects.filter((p) => p.status === "open").length;
  const onHoldCount = projects.filter((p) => p.status === "on_hold").length;
  const closedCount = projects.filter((p) => ["closed", "paid"].includes(p.status)).length;

  const totalValue = projects.reduce(
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
      // Use default template or first available
      const defaultTemplate = rfiTemplates?.find((t) => t.is_default) || rfiTemplates?.[0];
      const sections = defaultTemplate?.sections || DEFAULT_PIS_SECTIONS;

      const rfi = await createRfi.mutateAsync({
        project_id: project.id,
        property_id: project.property_id,
        title: `PIS — ${project.properties?.address || project.name || "Project"}`,
        sections,
        template_id: defaultTemplate?.id,
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
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-1">
              Manage active projects converted from proposals
            </p>
          </div>
          <Button
            size="sm"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={handleOpenCreate}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
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

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by project #, name, property, or client..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

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
                  Projects are created when proposals are signed, or you can create one manually.
                </p>
                <Button
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={handleOpenCreate}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
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
