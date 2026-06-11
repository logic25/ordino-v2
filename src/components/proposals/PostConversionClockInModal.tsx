import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectTimer } from "@/hooks/useProjectTimer";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  projectName: string;
}

interface ServiceRow {
  id: string;
  name: string;
  total_amount: number | null;
  application_id: string | null;
}

export function PostConversionClockInModal({ open, onOpenChange, projectId, projectName }: Props) {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const projectTimer = useProjectTimer();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    supabase
      .from("services")
      .select("id, name, total_amount, application_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const rows = (data as ServiceRow[]) || [];
        setServices(rows);
        setSelected(new Set(rows.map((r) => r.id)));
        setLoading(false);
      });
  }, [open, projectId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startTimer = () => {
    if (!projectId) return;
    const first = services.find((s) => selected.has(s.id));
    projectTimer.start(projectId, projectName, first?.application_id || undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Project created — start working?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{projectName}</span> is
            ready. Select the deliverables you'll work on now and start a timer,
            or skip and clock in later from the project page.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
          {loading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          ) : services.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              No services were created for this project.
            </p>
          ) : (
            services.map((s) => (
              <label key={s.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40">
                <Checkbox
                  checked={selected.has(s.id)}
                  onCheckedChange={() => toggle(s.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  {s.total_amount != null && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      ${Number(s.total_amount).toLocaleString()}
                    </p>
                  )}
                </div>
              </label>
            ))
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              if (projectId) navigate(`/projects/${projectId}`);
              onOpenChange(false);
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open project
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Skip
            </Button>
            <Button
              onClick={startTimer}
              disabled={selected.size === 0 || projectTimer.isRunning}
              title={projectTimer.isRunning ? "Stop the existing timer first" : undefined}
            >
              <Play className="h-4 w-4 mr-2" />
              Start timer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
