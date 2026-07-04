import { useState } from "react";
import { format } from "date-fns";
import { Mail, Paperclip, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EmailDetailSheet } from "./EmailDetailSheet";
import type { EmailWithTags } from "@/hooks/useEmails";

interface RecordEmailsSectionProps {
  /** Tagged emails returned by useProposalEmails / useChangeOrderEmails / useInvoiceEmails. */
  taggedEmails: any[];
  isLoading?: boolean;
  /** What kind of record this is for — purely for the empty-state copy. */
  recordLabel?: string;
}

const categoryColors: Record<string, string> = {
  objection: "bg-destructive/15 text-destructive border-destructive/30",
  agency: "bg-info/15 text-info border-info/30",
  client: "bg-accent/15 text-accent-foreground border-accent/30",
  submission: "bg-success/15 text-success border-success/30",
  other: "bg-muted text-muted-foreground border-border",
};

const categoryLabels: Record<string, string> = {
  objection: "🚨 Objection",
  agency: "📋 Agency",
  client: "👤 Client",
  submission: "📄 Submission",
  other: "Other",
};

/**
 * Compact email-thread section for proposal / change order / invoice detail views.
 * Click a row → opens EmailDetailSheet which shows the full thread (all replies)
 * via useThreadEmails. New replies auto-appear because gmail-sync stores them
 * with the same thread_id.
 */
export function RecordEmailsSection({
  taggedEmails,
  isLoading,
  recordLabel = "record",
}: RecordEmailsSectionProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailWithTags | null>(null);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-3">Loading emails…</div>;
  }

  if (!taggedEmails || taggedEmails.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-muted-foreground border rounded-lg bg-muted/20">
        <Mail className="h-6 w-6 mb-1.5 opacity-40" />
        <p className="text-xs">No emails yet for this {recordLabel}</p>
        <p className="text-[11px] mt-0.5 opacity-70">
          Once you send it, the thread and any client replies show up here automatically.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        <span>Email thread{taggedEmails.length > 1 ? "s" : ""} ({taggedEmails.length})</span>
      </div>
      <div className="space-y-1.5">
        {taggedEmails.map((tag: any) => {
          const email = tag.emails;
          if (!email) return null;
          return (
            <div
              key={tag.id}
              className="border rounded-lg p-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() =>
                setSelectedEmail({
                  ...email,
                  email_project_tags: [],
                  email_attachments: email.email_attachments || [],
                })
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium truncate">
                      {email.from_name || email.from_email}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] px-1 py-0",
                        categoryColors[tag.category] || categoryColors.other
                      )}
                    >
                      {categoryLabels[tag.category] || tag.category}
                    </Badge>
                    {email.has_attachments && (
                      <Paperclip className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs truncate">{email.subject || "(no subject)"}</p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {email.snippet}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0">
                  {email.date ? format(new Date(email.date), "MMM d") : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <EmailDetailSheet
        email={selectedEmail}
        open={!!selectedEmail}
        onOpenChange={(open) => !open && setSelectedEmail(null)}
      />
    </>
  );
}
