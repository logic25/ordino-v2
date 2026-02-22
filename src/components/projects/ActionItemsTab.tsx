import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertTriangle, CheckCircle2, Circle, Clock, Plus, XCircle, Paperclip,
} from "lucide-react";
import { useActionItems, type ActionItem } from "@/hooks/useActionItems";
import { NewActionItemDialog } from "./NewActionItemDialog";
import { CompleteActionItemDialog } from "./CompleteActionItemDialog";
import { ActionItemDetailSheet } from "./ActionItemDetailSheet";
import { format } from "date-fns";

interface ActionItemsTabProps {
  projectId: string;
}

const statusStyles: Record<string, { className: string; label: string }> = {
  open: { className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200", label: "Open" },
  done: { className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200", label: "Done" },
  cancelled: { className: "bg-muted text-muted-foreground", label: "Cancelled" },
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

export function ActionItemsTab({ projectId }: ActionItemsTabProps) {
  const { data: items = [], isLoading } = useActionItems(projectId);
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [completeItem, setCompleteItem] = useState<ActionItem | null>(null);
  const [detailItem, setDetailItem] = useState<ActionItem | null>(null);

  const filtered = items.filter((item) => {
    if (filter === "open") return item.status === "open";
    if (filter === "done") return item.status === "done";
    return true;
  });

  const openCount = items.filter((i) => i.status === "open").length;

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading action items...</div>;
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            {(["all", "open", "done"] as const).map((f) => (
              <button
                key={f}
                className={`px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                }`}
                onClick={() => setFilter(f)}
              >
                {f} {f === "open" && openCount > 0 ? `(${openCount})` : ""}
              </button>
            ))}
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New Action Item
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-primary/30 mb-2" />
          <p className="text-sm text-muted-foreground">
            {filter === "all" ? "No action items yet" : `No ${filter} items`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const style = statusStyles[item.status] || statusStyles.open;
            const attachmentCount = (item.attachment_ids as any[])?.length || 0;
            const isOverdue = item.status === "open" && item.due_date && new Date(item.due_date) < new Date();

            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent/5 hover:border-accent/50 ${
                  item.priority === "urgent" && item.status === "open" ? "border-l-4 border-l-destructive" : ""
                }`}
                onClick={() => setDetailItem(item)}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {item.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : item.status === "cancelled" ? (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Circle className="h-5 w-5 text-blue-500" />
                  )}
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

                {/* Status badge */}
                <Badge variant="outline" className={`text-[10px] px-2 py-0.5 shrink-0 ${style.className}`}>
                  {style.label}
                </Badge>

                {/* Mark done button */}
                {item.status === "open" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompleteItem(item);
                    }}
                  >
                    Mark Done
                  </Button>
                )}
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
