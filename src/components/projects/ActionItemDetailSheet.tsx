import { useState, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle, CheckCircle2, Clock, XCircle, Paperclip,
  PlayCircle, Ban, Circle, ChevronDown, Send, Loader2, MessageSquare,
} from "lucide-react";
import {
  useCancelActionItem, useUpdateActionItemStatus, useActionItemComments, useAddActionItemComment,
  type ActionItem, type ActionItemStatus, type ActionItemComment,
} from "@/hooks/useActionItems";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  item: ActionItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkDone: () => void;
}

const statusConfig: Record<string, { className: string; label: string; icon: typeof Circle }> = {
  open: { className: "bg-amber-500/10 text-amber-700 border-amber-200", label: "Pending", icon: Circle },
  in_progress: { className: "bg-blue-500/10 text-blue-700 border-blue-200", label: "In Progress", icon: PlayCircle },
  done: { className: "bg-green-500/10 text-green-700 border-green-200", label: "Completed", icon: CheckCircle2 },
  blocked: { className: "bg-destructive/10 text-destructive border-destructive/20", label: "Blocked", icon: Ban },
  cancelled: { className: "bg-muted text-muted-foreground", label: "Cancelled", icon: XCircle },
};

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

function CommentItem({ comment }: { comment: ActionItemComment }) {
  const name = comment.profile
    ? (comment.profile.display_name || `${comment.profile.first_name || ""} ${comment.profile.last_name || ""}`.trim() || "Unknown")
    : "Unknown";
  const initials = comment.profile?.first_name && comment.profile?.last_name
    ? `${comment.profile.first_name[0]}${comment.profile.last_name[0]}`
    : name.slice(0, 2).toUpperCase();

  return (
    <div className="flex gap-2 py-2">
      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
        <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{name}</span>
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(comment.created_at), "MMM d 'at' h:mm a")}
          </span>
        </div>
        {comment.content && (
          <p className="text-sm mt-0.5 whitespace-pre-line">{comment.content}</p>
        )}
      </div>
    </div>
  );
}

export function ActionItemDetailSheet({ item, open, onOpenChange, onMarkDone }: Props) {
  const cancelMutation = useCancelActionItem();
  const updateStatus = useUpdateActionItemStatus();
  const { data: comments = [], isLoading: commentsLoading } = useActionItemComments(item.id);
  const addComment = useAddActionItemComment();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const completionAttachments = (item.completion_attachments as { name: string; storage_path: string }[]) || [];

  const currentStatus = statusConfig[item.status] || statusConfig.open;

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync({ id: item.id, project_id: item.project_id });
      toast({ title: "Action item cancelled" });
      onOpenChange(false);
    } catch {
      toast({ title: "Error cancelling", variant: "destructive" });
    }
  };

  const handleStatusChange = async (newStatus: ActionItemStatus) => {
    if (newStatus === item.status) return;
    if (newStatus === "done") {
      onMarkDone();
      return;
    }
    try {
      await updateStatus.mutateAsync({ id: item.id, project_id: item.project_id, status: newStatus });
      toast({ title: `Status changed to ${statusConfig[newStatus]?.label || newStatus}` });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleDownload = async (att: { name: string; storage_path: string }) => {
    const { data } = await supabase.storage.from("action-item-attachments").createSignedUrl(att.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleAddComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    try {
      await addComment.mutateAsync({ action_item_id: item.id, content: text });
      setCommentText("");
    } catch {
      toast({ title: "Failed to add comment", variant: "destructive" });
    }
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
          {/* Status dropdown */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors hover:opacity-80",
                  currentStatus.className
                )}>
                  <currentStatus.icon className="h-3.5 w-3.5" />
                  {currentStatus.label}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 bg-popover z-50">
                {(["open", "in_progress", "done", "blocked"] as ActionItemStatus[]).map((s) => {
                  const cfg = statusConfig[s];
                  return (
                    <DropdownMenuItem key={s} className="gap-2 text-xs" onClick={() => handleStatusChange(s)}>
                      <cfg.icon className="h-3.5 w-3.5" />
                      {cfg.label}
                      {s === item.status && <span className="ml-auto text-muted-foreground">✓</span>}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
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

          {/* Comments section */}
          <Separator />
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Comments {comments.length > 0 && `(${comments.length})`}
            </h4>

            {commentsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length > 0 ? (
              <div className="divide-y">
                {comments.map((c) => <CommentItem key={c.id} comment={c} />)}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-2">No comments yet</p>
            )}

            {/* Add comment */}
            <div className="flex gap-2 mt-2">
              <Textarea
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="min-h-[60px] text-sm resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
              />
            </div>
            <div className="flex justify-end mt-1.5">
              <Button
                size="sm"
                className="gap-1.5 h-7 text-xs"
                disabled={!commentText.trim() || addComment.isPending}
                onClick={handleAddComment}
              >
                {addComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Comment
              </Button>
            </div>
          </div>

          {/* Timestamps */}
          <Separator />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Created {format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
            <p>Updated {format(new Date(item.updated_at), "MMM d, yyyy 'at' h:mm a")}</p>
          </div>

          {/* Actions */}
          {item.status !== "done" && item.status !== "cancelled" && (
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
