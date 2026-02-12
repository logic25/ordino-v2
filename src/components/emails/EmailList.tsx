import { format } from "date-fns";
import { Paperclip, Tag, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { EmailWithTags } from "@/hooks/useEmails";

interface EmailListProps {
  emails: EmailWithTags[];
  selectedId?: string;
  onSelect: (email: EmailWithTags) => void;
}

const categoryColors: Record<string, string> = {
  objection: "bg-destructive/15 text-destructive border-destructive/30",
  agency: "bg-info/15 text-info border-info/30",
  client: "bg-accent/15 text-accent-foreground border-accent/30",
  submission: "bg-success/15 text-success border-success/30",
  other: "bg-muted text-muted-foreground border-border",
};

export function EmailList({ emails, selectedId, onSelect }: EmailListProps) {
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
      {emails.map((email) => {
        const isSelected = selectedId === email.id;
        const tags = email.email_project_tags || [];
        const isTagged = tags.length > 0;

        return (
          <button
            key={email.id}
            onClick={() => onSelect(email)}
            className={cn(
              "w-full text-left px-4 py-3 transition-colors hover:bg-muted/50",
              isSelected && "bg-muted",
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
                {isTagged && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          categoryColors[tag.category] || categoryColors.other
                        )}
                      >
                        {tag.projects?.project_number || tag.projects?.name || "Project"}
                        {tag.category !== "other" && ` · ${tag.category}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {email.date ? format(new Date(email.date), "MMM d") : ""}
                </span>
                {!isTagged && (
                  <Tag className="h-3 w-3 text-muted-foreground/40" />
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
