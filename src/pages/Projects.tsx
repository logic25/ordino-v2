import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Search, Loader2, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApplicationTable } from "@/components/applications/ApplicationTable";
import {
  useApplications,
  useUpdateApplication,
  useDeleteApplication,
  ApplicationWithProperty,
  ApplicationFormInput,
} from "@/hooks/useApplications";
import { ApplicationDialog } from "@/components/applications/ApplicationDialog";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingApplication, setEditingApplication] = useState<ApplicationWithProperty | null>(null);
  const { toast } = useToast();

  const { data: applications = [], isLoading } = useApplications();
  const updateApplication = useUpdateApplication();
  const deleteApplication = useDeleteApplication();

  const filteredApplications = applications.filter((app) => {
    const query = searchQuery.toLowerCase();
    return (
      app.properties?.address?.toLowerCase().includes(query) ||
      app.job_number?.toLowerCase().includes(query) ||
      app.application_type?.toLowerCase().includes(query) ||
      app.description?.toLowerCase().includes(query)
    );
  });

  const handleEdit = (application: ApplicationWithProperty) => {
    setEditingApplication(application);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: ApplicationFormInput) => {
    try {
      if (editingApplication) {
        await updateApplication.mutateAsync({ id: editingApplication.id, ...data });
        toast({
          title: "Project updated",
          description: "The project has been updated.",
        });
        setDialogOpen(false);
        setEditingApplication(null);
      }
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
      await deleteApplication.mutateAsync(id);
      toast({
        title: "Project deleted",
        description: "The project has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete project.",
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
              View and manage your DOB applications and permits
            </p>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Projects are created automatically when a proposal is signed by both parties. 
            <Link to="/proposals" className="font-medium underline underline-offset-4 ml-1">
              Create a proposal
            </Link>{" "}
            to start a new project.
          </AlertDescription>
        </Alert>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by address, job number, or type..."
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
                  ({filteredApplications.length})
                </span>
              )}
            </CardTitle>
            <CardDescription>
              View and manage all your active DOB applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredApplications.length === 0 && !searchQuery ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No projects yet</h3>
                <p className="text-muted-foreground mt-1 mb-4 max-w-sm">
                  Projects are created when proposals are signed. Start by creating a proposal for a property.
                </p>
                <Button
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  asChild
                >
                  <Link to="/proposals">Go to Proposals</Link>
                </Button>
              </div>
            ) : (
              <ApplicationTable
                applications={filteredApplications}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isDeleting={deleteApplication.isPending}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ApplicationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        application={editingApplication}
        isLoading={updateApplication.isPending}
      />
    </AppLayout>
  );
}
