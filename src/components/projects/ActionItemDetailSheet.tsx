import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertTriangle, CheckCircle2, Clock, XCircle, Paperclip } from "lucide-react";
import { useCancelActionItem, type ActionItem } from "@/hooks/useActionItems";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  item: ActionItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkDone: () => void;
}

function getName(profile: ActionItem["assignee"]) {
  if (!profile) return "Unassigned";
  return profile.display_name || `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown";
}

function getInitials(profile: ActionItem["assignee"]) {
  if (!profile) return "?";
  if (profile.first_name && profile.last_name) return `${profile.first_name[0]}${profile.last_name[0]}`;
  if (profile.display_name) return profile.display_name.slice(0, 2).toUpperCase();
  return "?";
}

export function ActionItemDetailSheet({ item, open, onOpenChange, onMarkDone }: Props) {
  const cancelMutation = useCancelActionItem();
  const { toast } = useToast();
  const completionAttachments = (item.completion_attachments as { name: string; storage_path: string }[]) || [];

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync({ id: item.id, project_id: item.project_id });
      toast({ title: "Action item cancelled" });
      onOpenChange(false);
    } catch {
      toast({ title: "Error cancelling", variant: "destructive" });
    }
  };

  const handleDownload = async (att: { name: string; storage_path: string }) => {
    const { data } = await supabase.storage.from("action-item-attachments").createSignedUrl(att.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-left">
            {item.priority === "urgent" && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
            {item.title}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge variant={item.status === "done" ? "default" : item.status === "cancelled" ? "secondary" : "outline"}>
              {item.status === "done" && <CheckCircle2 className="h-3 w-3 mr-1" />}
              {item.status === "cancelled" && <XCircle className="h-3 w-3 mr-1" />}
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Badge>
            {item.priority === "urgent" && (
              <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
            )}
          </div>

          {/* Assignee */}
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">{getInitials(item.assignee)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-medium">{getName(item.assignee)}</div>
              <div className="text-xs text-muted-foreground">Assigned by {getName(item.assigner)}</div>
            </div>
          </div>

          {/* Due date */}
          {item.due_date && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Due {format(new Date(item.due_date), "MMM d, yyyy")}
            </div>
          )}

          {/* Description */}
          {item.description && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</h4>
                <p className="text-sm whitespace-pre-line">{item.description}</p>
              </div>
            </>
          )}

          {/* Completion info */}
          {item.status === "done" && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Completion</h4>
                {item.completed_at && (
                  <p className="text-xs text-muted-foreground mb-1">
                    Completed {format(new Date(item.completed_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
                {item.completion_note && (
                  <p className="text-sm whitespace-pre-line mb-2">{item.completion_note}</p>
                )}
                {completionAttachments.length > 0 && (
                  <div className="space-y-1">
                    {completionAttachments.map((att, i) => (
                      <button
                        key={i}
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                        onClick={() => handleDownload(att)}
                      >
                        <Paperclip className="h-3 w-3" /> {att.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Timestamps */}
          <Separator />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Created {format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
            <p>Updated {format(new Date(item.updated_at), "MMM d, yyyy 'at' h:mm a")}</p>
          </div>

          {/* Actions */}
          {item.status === "open" && (
            <>
              <Separator />
              <div className="flex gap-2">
                <Button size="sm" onClick={onMarkDone}>Mark Done</Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={handleCancel} disabled={cancelMutation.isPending}>
                  Cancel Item
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
