import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Clock, ClipboardList, ArrowRight } from "lucide-react";
import { useMyActionItems } from "@/hooks/useActionItems";
import { format } from "date-fns";

export function MyActionItemsCard() {
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useMyActionItems();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          My Tasks
          {items.length > 0 && (
            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          [1, 2].map((i) => (
            <div key={i} className="p-3 rounded-lg border space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-primary/30 mb-2" />
            <p className="text-sm text-muted-foreground">No open tasks</p>
          </div>
        ) : (
          <>
            {items.slice(0, 5).map((item) => {
              const isOverdue = item.due_date && new Date(item.due_date) < new Date();
              const proj = (item as any).projects;

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer ${
                    item.priority === "urgent" ? "border-l-4 border-l-destructive" : ""
                  }`}
                  onClick={() => navigate(`/projects/${item.project_id}`)}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    {item.priority === "urgent" && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                    <span className="text-sm font-medium truncate">{item.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    {proj && (
                      <span>{proj.project_number ? `#${proj.project_number}` : proj.name || "Project"}</span>
                    )}
                    {item.due_date && (
                      <>
                        <span>·</span>
                        <span className={isOverdue ? "text-destructive font-medium" : ""}>
                          {isOverdue && <Clock className="h-3 w-3 inline mr-0.5" />}
                          Due {format(new Date(item.due_date), "MMM d")}
                        </span>
                      </>
                    )}
                    {item.assigner && (
                      <>
                        <span>·</span>
                        <span>from {item.assigner.display_name || item.assigner.first_name}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {items.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{items.length - 5} more tasks
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
