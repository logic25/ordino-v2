import { format, isToday, isThisYear } from "date-fns";
import { Paperclip, Tag, Mail, Reply, FolderOpen, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EmailWithTags } from "@/hooks/useEmails";
import { getTagColor } from "@/hooks/useQuickTags";
import { useAllPendingReminders } from "@/hooks/useEmailReminders";

interface EmailListProps {
  emails: EmailWithTags[];
  selectedId?: string;
  highlightedIndex?: number;
  onSelect: (email: EmailWithTags) => void;
}

const URGENT_KEYWORDS = [
  "objection", "disapproved", "violation", "deadline",
  "final", "expires", "required", "immediately", "asap",
  "c of o", "certificate of occupancy",
];

function isUrgent(email: EmailWithTags): boolean {
  const text = `${email.subject || ""} ${email.snippet || ""}`.toLowerCase();
  return URGENT_KEYWORDS.some((kw) => text.includes(kw));
}

export function EmailList({ emails, selectedId, highlightedIndex, onSelect }: EmailListProps) {
  const { data: allReminders = [] } = useAllPendingReminders();
  const reminderEmailIds = new Set(allReminders.map((r) => r.email_id));

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Mail className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-sm font-medium">No emails found</p>
        <p className="text-xs mt-1">Connect Gmail and sync to see emails here</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {emails.map((email, index) => {
        const isSelected = selectedId === email.id;
        const isHighlighted = highlightedIndex === index;
        const tags = email.email_project_tags || [];
        const quickTags: string[] = (email as any).tags || [];
        const projectCount = tags.length;
        const urgent = isUrgent(email);
        const replied = !!(email as any).replied_at;
        const hasReminder = reminderEmailIds.has(email.id);

        return (
          <button
            key={email.id}
            data-email-index={index}
            onClick={() => onSelect(email)}
            className={cn(
              "w-full text-left px-4 py-3 transition-colors hover:bg-muted/50",
              isSelected && "bg-muted",
              isHighlighted && !isSelected && "bg-accent/10 border-l-4 border-l-primary",
              !isHighlighted && "border-l-4 border-l-transparent",
              !email.is_read && "bg-accent/5"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn("text-sm truncate", !email.is_read && "font-semibold")}>
                    {email.from_name || email.from_email || "Unknown"}
                  </span>
                  {email.has_attachments && (
                    <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  )}
                </div>
                <p className={cn("text-sm truncate", !email.is_read ? "font-medium text-foreground" : "text-foreground/80")}>
                  {email.subject || "(no subject)"}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {email.snippet}
                </p>
                {/* Quick tags */}
                {quickTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {quickTags.slice(0, 3).map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className={cn("text-[10px] px-1.5 py-0", getTagColor(t))}
                      >
                        {t}
                      </Badge>
                    ))}
                    {quickTags.length > 3 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        +{quickTags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {email.date
                    ? isToday(new Date(email.date))
                      ? format(new Date(email.date), "h:mm a")
                      : isThisYear(new Date(email.date))
                        ? format(new Date(email.date), "MMM d, h:mm a")
                        : format(new Date(email.date), "MMM d, yyyy")
                    : ""}
                </span>
                {/* Status indicators */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {!email.is_read && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-info/10 text-info border-info/30">
                      New
                    </Badge>
                  )}
                  {urgent && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-destructive/10 text-destructive border-destructive/30">
                      Urgent
                    </Badge>
                  )}
                  {projectCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-0.5">
                          <FolderOpen className="h-3 w-3 text-info" />
                          <span className="text-[10px] font-medium text-info">{projectCount}</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left"><p>Tagged to {projectCount} project(s)</p></TooltipContent>
                    </Tooltip>
                  )}
                  {hasReminder && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Bell className="h-3 w-3 text-warning fill-warning" />
                      </TooltipTrigger>
                      <TooltipContent side="left"><p>Reminder set</p></TooltipContent>
                    </Tooltip>
                  )}
                  {replied && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Reply className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent side="left"><p>Replied</p></TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
