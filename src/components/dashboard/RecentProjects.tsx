import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban } from "lucide-react";
import { useRecentApplications, useMyAssignedApplications } from "@/hooks/useDashboard";
import { APPLICATION_STATUSES } from "@/hooks/useApplications";

interface RecentProjectsProps {
  showOnlyMine?: boolean;
}

export function RecentProjects({ showOnlyMine = false }: RecentProjectsProps) {
  const navigate = useNavigate();
  const { data: allProjects, isLoading: allLoading } = useRecentApplications();
  const { data: myProjects, isLoading: myLoading } = useMyAssignedApplications();

  const projects = showOnlyMine ? myProjects : allProjects;
  const isLoading = showOnlyMine ? myLoading : allLoading;

  const getStatusBadge = (status: string | null) => {
    const statusConfig = APPLICATION_STATUSES.find((s) => s.value === status);
    if (!statusConfig) return null;
    return (
      <Badge className={statusConfig.color}>
        {statusConfig.label}
      </Badge>
    );
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>
          {showOnlyMine ? "My Assigned Projects" : "Recent Projects"}
        </CardTitle>
        <CardDescription>
          {showOnlyMine
            ? "Projects currently assigned to you"
            : "Most recently updated DOB applications"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </>
        ) : !projects || projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FolderKanban className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              {showOnlyMine
                ? "No projects assigned to you yet"
                : "No projects yet"}
            </p>
          </div>
        ) : (
          <>
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer"
                onClick={() => navigate("/projects")}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">
                      {project.properties?.address || "Unknown Address"}
                      {project.application_type && ` - ${project.application_type}`}
                    </h3>
                    {getStatusBadge(project.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {project.job_number && `Job #${project.job_number} • `}
                    {project.description || "No description"}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatTimeAgo(project.updated_at)}
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/projects")}
            >
              View All Projects
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
