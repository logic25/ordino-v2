import { format, isToday, isThisYear } from "date-fns";
import { Paperclip, Tag, Mail, Reply, FolderOpen, Bell, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EmailWithTags } from "@/hooks/useEmails";
import { getTagColor } from "@/hooks/useQuickTags";
import { useAllPendingReminders } from "@/hooks/useEmailReminders";
import { decodeHtmlEntities } from "@/lib/decodeHtmlEntities";

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

// Group emails by thread_id and pick the newest message as the visible row.
// Returns a list of [representativeEmail, threadCount, anyUnread] tuples preserving the original order.
function collapseThreads(emails: EmailWithTags[]): Array<{ email: EmailWithTags; count: number; anyUnread: boolean }> {
  const seen = new Set<string>();
  const byThread = new Map<string, EmailWithTags[]>();
  emails.forEach((e) => {
    const key = e.thread_id || e.id;
    const arr = byThread.get(key) || [];
    arr.push(e);
    byThread.set(key, arr);
  });
  const out: Array<{ email: EmailWithTags; count: number; anyUnread: boolean }> = [];
  for (const e of emails) {
    const key = e.thread_id || e.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const group = byThread.get(key) || [e];
    // Pick newest message in the thread as the representative
    const sorted = [...group].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
    out.push({ email: sorted[0], count: group.length, anyUnread: group.some((g) => !g.is_read) });
  }
  return out;
}

export function EmailList({ emails, selectedId, highlightedIndex, onSelect }: EmailListProps) {
  const { data: allReminders = [] } = useAllPendingReminders();
  const reminderEmailIds = new Set(allReminders.map((r) => r.email_id));
  const threads = collapseThreads(emails);

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
      {threads.map(({ email, count, anyUnread }, index) => {
        const isSelected = selectedId === email.id;
        const isHighlighted = highlightedIndex === index;
        const tags = email.email_project_tags || [];
        const quickTags: string[] = (email as any).tags || [];
        const projectCount = tags.length;
        const urgent = isUrgent(email);
        const replied = !!(email as any).replied_at;
        const hasReminder = reminderEmailIds.has(email.id);
        const isThread = count > 1;
        const unread = anyUnread;

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
              !email.is_read && "bg-accent/5",
              unread && email.is_read && "bg-accent/[0.03]"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={cn("text-sm truncate", (unread || !email.is_read) && "font-semibold")}>
                    {email.from_name || email.from_email || "Unknown"}
                  </span>
                  {isThread && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                          <MessagesSquare className="h-3 w-3" />
                          {count}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top"><p>{count} messages in this thread</p></TooltipContent>
                    </Tooltip>
                  )}
                  {email.has_attachments && (
                    <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  )}
                </div>
                <p className={cn("text-sm truncate", (unread || !email.is_read) ? "font-medium text-foreground" : "text-foreground/80")}>
                  {decodeHtmlEntities(email.subject) || "(no subject)"}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {decodeHtmlEntities(email.snippet)}
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
