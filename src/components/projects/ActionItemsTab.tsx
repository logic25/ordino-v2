import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle, CheckCircle2, Circle, Clock, Plus, XCircle, Paperclip,
  PlayCircle, Ban, ChevronDown,
} from "lucide-react";
import { useActionItems, useUpdateActionItemStatus, type ActionItem, type ActionItemStatus } from "@/hooks/useActionItems";
import { NewActionItemDialog } from "./NewActionItemDialog";
import { CompleteActionItemDialog } from "./CompleteActionItemDialog";
import { ActionItemDetailSheet } from "./ActionItemDetailSheet";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ActionItemsTabProps {
  projectId: string;
}

const statusConfig: Record<string, { className: string; label: string; icon: typeof Circle }> = {
  open: { className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200", label: "Pending", icon: Circle },
  in_progress: { className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200", label: "In Progress", icon: PlayCircle },
  done: { className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200", label: "Completed", icon: CheckCircle2 },
  blocked: { className: "bg-destructive/10 text-destructive border-destructive/20", label: "Blocked", icon: Ban },
  cancelled: { className: "bg-muted text-muted-foreground", label: "Cancelled", icon: XCircle },
};

function getInitials(profile: ActionItem["assignee"]) {
  if (!profile) return "?";
  if (profile.first_name && profile.last_name) return `${profile.first_name[0]}${profile.last_name[0]}`;
  if (profile.display_name) return profile.display_name.slice(0, 2).toUpperCase();
  return "?";
}

function getName(profile: ActionItem["assignee"]) {
  if (!profile) return "Unassigned";
  return profile.display_name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown";
}

function StatusDropdown({ item }: { item: ActionItem }) {
  const updateStatus = useUpdateActionItemStatus();
  const { toast } = useToast();
  const current = statusConfig[item.status] || statusConfig.open;

  const handleChange = async (newStatus: ActionItemStatus) => {
    if (newStatus === item.status) return;
    try {
      await updateStatus.mutateAsync({ id: item.id, project_id: item.project_id, status: newStatus });
      toast({ title: `Status changed to ${statusConfig[newStatus]?.label || newStatus}` });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors hover:opacity-80",
            current.className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <current.icon className="h-3 w-3" />
          {current.label}
          <ChevronDown className="h-2.5 w-2.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 bg-popover z-50" onClick={(e) => e.stopPropagation()}>
        {(["open", "in_progress", "done", "blocked"] as ActionItemStatus[]).map((s) => {
          const cfg = statusConfig[s];
          return (
            <DropdownMenuItem
              key={s}
              className="gap-2 text-xs"
              onClick={() => handleChange(s)}
            >
              <cfg.icon className="h-3.5 w-3.5" />
              {cfg.label}
              {s === item.status && <span className="ml-auto text-muted-foreground">✓</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ActionItemsTab({ projectId }: ActionItemsTabProps) {
  const { data: items = [], isLoading } = useActionItems(projectId);
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [completeItem, setCompleteItem] = useState<ActionItem | null>(null);
  const [detailItem, setDetailItem] = useState<ActionItem | null>(null);

  const filtered = items.filter((item) => {
    if (filter === "active") return ["open", "in_progress", "blocked"].includes(item.status);
    if (filter === "done") return item.status === "done";
    return true;
  });

  const activeCount = items.filter((i) => ["open", "in_progress", "blocked"].includes(i.status)).length;

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading tasks...</div>;
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            {(["all", "active", "done"] as const).map((f) => (
              <button
                key={f}
                className={`px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                }`}
                onClick={() => setFilter(f)}
              >
                {f} {f === "active" && activeCount > 0 ? `(${activeCount})` : ""}
              </button>
            ))}
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New Task
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-primary/30 mb-2" />
          <p className="text-sm text-muted-foreground">
            {filter === "all" ? "No tasks yet" : `No ${filter} tasks`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const style = statusConfig[item.status] || statusConfig.open;
            const attachmentCount = (item.attachment_ids as any[])?.length || 0;
            const isOverdue = ["open", "in_progress"].includes(item.status) && item.due_date && new Date(item.due_date) < new Date();

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent/5 hover:border-accent/50",
                  item.priority === "urgent" && item.status !== "done" ? "border-l-4 border-l-destructive" : ""
                )}
                onClick={() => setDetailItem(item)}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  <style.icon className={cn("h-5 w-5", style.className.includes("green") ? "text-green-600" : style.className.includes("blue") ? "text-blue-500" : style.className.includes("amber") ? "text-amber-500" : style.className.includes("destructive") ? "text-destructive" : "text-muted-foreground")} />
                </div>

                {/* Assignee avatar */}
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px]">{getInitials(item.assignee)}</AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{item.title}</span>
                    {item.priority === "urgent" && (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{getName(item.assignee)}</span>
                    {item.due_date && (
                      <>
                        <span>·</span>
                        <span className={isOverdue ? "text-destructive font-medium" : ""}>
                          {isOverdue && <Clock className="h-3 w-3 inline mr-0.5" />}
                          Due {format(new Date(item.due_date), "MMM d")}
                        </span>
                      </>
                    )}
                    {attachmentCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Paperclip className="h-3 w-3" /> {attachmentCount}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status dropdown */}
                <StatusDropdown item={item} />
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <NewActionItemDialog
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      {completeItem && (
        <CompleteActionItemDialog
          item={completeItem}
          open={!!completeItem}
          onOpenChange={(open) => !open && setCompleteItem(null)}
        />
      )}
      {detailItem && (
        <ActionItemDetailSheet
          item={detailItem}
          open={!!detailItem}
          onOpenChange={(open) => !open && setDetailItem(null)}
          onMarkDone={() => {
            setCompleteItem(detailItem);
            setDetailItem(null);
          }}
        />
      )}
    </div>
  );
}
