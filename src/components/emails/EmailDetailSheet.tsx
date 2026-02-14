import { useState } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tag, Paperclip, X, Reply, Send, Loader2, ChevronDown, ChevronUp, MessageSquare, Download, Eye, Archive, ArchiveRestore, Forward } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailWithTags } from "@/hooks/useEmails";
import { useUntagEmail, useThreadEmails, useArchiveEmail, useSnoozeEmail } from "@/hooks/useEmails";
import { useSendEmail } from "@/hooks/useGmailConnection";
import { useAttachmentDownload } from "@/hooks/useAttachmentDownload";
import { AttachmentPreviewModal } from "./AttachmentPreviewModal";
import { useProjects } from "@/hooks/useProjects";
import { useProjectSuggestions } from "@/hooks/useProjectSuggestions";
import { useUpdateQuickTags, detectAutoTags } from "@/hooks/useQuickTags";
import { EmailTagDialog } from "./EmailTagDialog";
import { QuickTagSection } from "./QuickTagSection";
import { SnoozeMenu } from "./SnoozeMenu";
import { useToast } from "@/hooks/use-toast";

interface EmailDetailSheetProps {
  email: EmailWithTags | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived?: () => void;
  tagDialogOpen?: boolean;
  onTagDialogOpenChange?: (open: boolean) => void;
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

function ThreadMessage({
  email,
  isExpanded,
  onToggle,
  isLatest,
  onDownloadAttachment,
  downloadingId,
}: {
  email: EmailWithTags;
  isExpanded: boolean;
  onToggle: () => void;
  isLatest: boolean;
  onDownloadAttachment: (att: any, gmailMessageId: string) => void;
  downloadingId: string | null;
}) {
  const attachments = email.email_attachments || [];

  const isPreviewable = (mimeType: string | null) =>
    /^(image\/(png|jpeg|gif|webp|svg)|application\/pdf)$/i.test(mimeType || "");

  return (
    <div className={cn(
      "border rounded-lg transition-colors",
      isLatest ? "border-primary/30 bg-primary/5" : "border-border"
    )}>
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-2 hover:bg-muted/30 rounded-t-lg"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {email.from_name || email.from_email || "Unknown"}
            </span>
            {attachments.length > 0 && (
              <Paperclip className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
            )}
          </div>
          {!isExpanded && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {email.snippet}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {email.date ? format(new Date(email.date), "MMM d, h:mm a") : ""}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-xs text-muted-foreground">
            <span>From: {email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email}</span>
            {email.to_emails && Array.isArray(email.to_emails) && (
              <div>To: {(email.to_emails as string[]).join(", ")}</div>
            )}
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => (
                <button
                  key={att.id}
                  onClick={() => onDownloadAttachment(att, email.gmail_message_id)}
                  disabled={downloadingId === att.id}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 border rounded text-xs transition-colors",
                    "hover:bg-primary/10 hover:border-primary/30 cursor-pointer",
                    downloadingId === att.id && "opacity-50 cursor-wait"
                  )}
                >
                  {downloadingId === att.id ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  ) : isPreviewable(att.mime_type) ? (
                    <Eye className="h-3 w-3 text-primary" />
                  ) : (
                    <Download className="h-3 w-3 text-primary" />
                  )}
                  <span className="truncate max-w-[180px]">{att.filename}</span>
                  {att.size_bytes && (
                    <span className="text-muted-foreground">
                      {(att.size_bytes / 1024).toFixed(0)}KB
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <Separator />

          <div className="email-content">
            {email.body_html ? (
              <div
                className="prose prose-sm max-w-none text-foreground
                  [&_a]:text-accent [&_img]:max-w-full [&_table]:text-sm"
                dangerouslySetInnerHTML={{ __html: email.body_html }}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm font-sans text-foreground">
                {email.body_text || email.snippet || "No content"}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function EmailDetailSheet({ email, open, onOpenChange, onArchived, tagDialogOpen: externalTagDialogOpen, onTagDialogOpenChange }: EmailDetailSheetProps) {
  const [internalTagDialogOpen, setInternalTagDialogOpen] = useState(false);
  const tagDialogOpen = externalTagDialogOpen ?? internalTagDialogOpen;
  const setTagDialogOpen = onTagDialogOpenChange ?? setInternalTagDialogOpen;
  const [replyMode, setReplyMode] = useState<"reply" | "forward" | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [forwardTo, setForwardTo] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const untagEmail = useUntagEmail();
  const archiveEmail = useArchiveEmail();
  const snoozeEmail = useSnoozeEmail();
  const updateQuickTags = useUpdateQuickTags();
  const sendEmail = useSendEmail();
  const { downloadAttachment, downloadingId, preview, closePreview } = useAttachmentDownload();
  const { toast } = useToast();

  const { data: projects = [] } = useProjects();
  const suggestions = useProjectSuggestions(email, projects);
  const { data: threadEmails = [] } = useThreadEmails(email?.thread_id);

  const hasThread = threadEmails.length > 1;
  const displayEmails = hasThread ? threadEmails : email ? [email] : [];
  const latestEmail = displayEmails[displayEmails.length - 1];

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isExpanded = (id: string) => {
    if (latestEmail && id === latestEmail.id) return !expandedIds.has(id);
    return expandedIds.has(id);
  };

  if (!email) return null;

  const tags = email.email_project_tags || [];
  const quickTags: string[] = (email as any).tags || [];
  const isArchived = !!(email as any).archived_at;

  const handleUntag = async (tagId: string) => {
    try {
      await untagEmail.mutateAsync(tagId);
      toast({ title: "Tag removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleArchive = async () => {
    try {
      await archiveEmail.mutateAsync({ emailId: email.id, archive: !isArchived });
      toast({ title: isArchived ? "Email unarchived" : "Email archived" });
      if (!isArchived) {
        onOpenChange(false);
        onArchived?.();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSnooze = async (until: Date) => {
    try {
      await snoozeEmail.mutateAsync({ emailId: email.id, until });
      toast({ title: "Email snoozed", description: `Returns ${format(until, "MMM d, h:mm a")}` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleQuickTag = async (tag: string) => {
    const newTags = quickTags.includes(tag)
      ? quickTags.filter((t) => t !== tag)
      : [...quickTags, tag];
    try {
      await updateQuickTags.mutateAsync({ emailId: email.id, tags: newTags });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const replyToEmail = latestEmail || email;

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    try {
      const isForward = replyMode === "forward";
      const toAddr = isForward ? forwardTo : (replyToEmail.from_email || "");
      const subject = isForward
        ? (replyToEmail.subject?.startsWith("Fwd:") ? replyToEmail.subject : `Fwd: ${replyToEmail.subject || "(no subject)"}`)
        : (replyToEmail.subject?.startsWith("Re:") ? replyToEmail.subject : `Re: ${replyToEmail.subject || "(no subject)"}`);

      const forwardBody = isForward
        ? `<div>${replyBody.replace(/\n/g, "<br/>")}</div><br/><hr/><p><strong>---------- Forwarded message ----------</strong><br/>From: ${replyToEmail.from_name || replyToEmail.from_email}<br/>Subject: ${replyToEmail.subject || ""}<br/></p>${replyToEmail.body_html || replyToEmail.body_text || ""}`
        : `<div>${replyBody.replace(/\n/g, "<br/>")}</div>`;

      await sendEmail.mutateAsync({
        to: toAddr,
        subject,
        html_body: forwardBody,
        reply_to_email_id: isForward ? undefined : replyToEmail.id,
      });

      toast({ title: isForward ? "Forwarded" : "Reply Sent", description: `Sent to ${toAddr}` });
      setReplyBody("");
      setForwardTo("");
      setReplyMode(null);
    } catch (err: any) {
      toast({ title: "Send Failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => {
        if (!o) {
          setReplyMode(null);
          setReplyBody("");
          setExpandedIds(new Set());
        }
        onOpenChange(o);
      }}>
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4">
            <SheetTitle className="text-lg leading-tight pr-8">
              {email.subject || "(no subject)"}
            </SheetTitle>
            {hasThread && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{displayEmails.length} messages in thread</span>
              </div>
            )}
          </SheetHeader>

          <Separator />

          {/* Action bar */}
          <div className="px-6 py-2 flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleArchive}
              disabled={archiveEmail.isPending}
            >
              {isArchived ? (
                <><ArchiveRestore className="h-4 w-4 mr-1.5" /> Unarchive</>
              ) : (
                <><Archive className="h-4 w-4 mr-1.5" /> Archive</>
              )}
            </Button>
            <SnoozeMenu onSnooze={handleSnooze} disabled={snoozeEmail.isPending} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTagDialogOpen(true)}
            >
              <Tag className="h-4 w-4 mr-1.5" />
              Tag
            </Button>
          </div>

          <Separator />

          {/* Quick Tags */}
          <div className="px-6 py-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Quick Tags</p>
            <QuickTagSection
              activeTags={quickTags}
              onToggle={handleToggleQuickTag}
              disabled={updateQuickTags.isPending}
            />
          </div>

          {/* Project Tags */}
          <div className="px-6 pb-3 flex flex-wrap items-center gap-2">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className={cn(
                  "text-xs gap-1",
                  categoryColors[tag.category] || categoryColors.other
                )}
              >
                {tag.projects?.project_number || tag.projects?.name || "Project"}
                {" · "}
                {categoryLabels[tag.category] || tag.category}
                <button onClick={() => handleUntag(tag.id)} className="ml-0.5 hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          {/* Auto-suggest */}
          {suggestions.length > 0 && tags.length === 0 && (
            <div className="px-6 pb-2">
              <p className="text-xs text-muted-foreground mb-1.5">💡 Suggested projects:</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.slice(0, 3).map((p) => (
                  <Badge
                    key={p.id}
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors"
                    onClick={() => setTagDialogOpen(true)}
                  >
                    <span className="font-mono mr-1">{p.project_number}</span>
                    {p.name || p.properties?.address || ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <ScrollArea className="flex-1">
            <div className="px-6 py-4 space-y-3">
              {displayEmails.map((threadEmail) => (
                <ThreadMessage
                  key={threadEmail.id}
                  email={threadEmail}
                  isExpanded={isExpanded(threadEmail.id)}
                  onToggle={() => toggleExpanded(threadEmail.id)}
                  isLatest={threadEmail.id === latestEmail?.id}
                  onDownloadAttachment={downloadAttachment}
                  downloadingId={downloadingId}
                />
              ))}
            </div>
          </ScrollArea>

          {/* Reply / Forward Section */}
          <div className="border-t px-6 py-3 space-y-3">
            {!replyMode ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReplyMode("reply")}
                  className="flex-1"
                >
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReplyMode("forward")}
                  className="flex-1"
                >
                  <Forward className="h-4 w-4 mr-2" />
                  Forward
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {replyMode === "forward" ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Forward to:</p>
                    <input
                      type="email"
                      placeholder="recipient@example.com"
                      value={forwardTo}
                      onChange={(e) => setForwardTo(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border rounded-md bg-background"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Reply to <span className="font-medium text-foreground">{replyToEmail.from_email}</span>
                  </p>
                )}
                <Textarea
                  placeholder={replyMode === "forward" ? "Add a message..." : "Type your reply..."}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={4}
                  className="resize-none text-sm"
                  data-reply-textarea
                />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setReplyMode(null); setReplyBody(""); setForwardTo(""); }}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleReply}
                    disabled={!replyBody.trim() || (replyMode === "forward" && !forwardTo.trim()) || sendEmail.isPending}
                  >
                    {sendEmail.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : replyMode === "forward" ? (
                      <Forward className="h-4 w-4 mr-1" />
                    ) : (
                      <Send className="h-4 w-4 mr-1" />
                    )}
                    {replyMode === "forward" ? "Forward" : "Send Reply"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AttachmentPreviewModal
        open={!!preview}
        onOpenChange={(open) => { if (!open) closePreview(); }}
        url={preview?.url ?? null}
        filename={preview?.filename ?? ""}
        mimeType={preview?.mimeType ?? ""}
      />

      <EmailTagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        emailId={email.id}
        emailSubject={email.subject || undefined}
        emailForMatching={email}
      />
    </>
  );
}
