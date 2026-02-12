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
import { Tag, Paperclip, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailWithTags } from "@/hooks/useEmails";
import { useUntagEmail } from "@/hooks/useEmails";
import { EmailTagDialog } from "./EmailTagDialog";
import { useToast } from "@/hooks/use-toast";

interface EmailDetailSheetProps {
  email: EmailWithTags | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function EmailDetailSheet({ email, open, onOpenChange }: EmailDetailSheetProps) {
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const untagEmail = useUntagEmail();
  const { toast } = useToast();

  if (!email) return null;

  const tags = email.email_project_tags || [];
  const attachments = email.email_attachments || [];

  const handleUntag = async (tagId: string) => {
    try {
      await untagEmail.mutateAsync(tagId);
      toast({ title: "Tag removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4">
            <SheetTitle className="text-lg leading-tight pr-8">
              {email.subject || "(no subject)"}
            </SheetTitle>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-medium text-foreground">
                  {email.from_name || email.from_email}
                </span>
                {email.from_name && (
                  <span className="ml-1">&lt;{email.from_email}&gt;</span>
                )}
              </p>
              {email.date && (
                <p>{format(new Date(email.date), "EEEE, MMMM d, yyyy 'at' h:mm a")}</p>
              )}
            </div>
          </SheetHeader>

          <Separator />

          <ScrollArea className="flex-1">
            <div className="px-6 py-4 space-y-4">
              {/* Tags */}
              <div className="flex flex-wrap items-center gap-2">
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
                    <button
                      onClick={() => handleUntag(tag.id)}
                      className="ml-0.5 hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setTagDialogOpen(true)}
                >
                  <Tag className="h-3 w-3 mr-1" />
                  Tag to Project
                </Button>
              </div>

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Attachments ({attachments.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-muted/30 text-sm"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{att.filename}</span>
                        {att.size_bytes && (
                          <span className="text-xs text-muted-foreground">
                            {(att.size_bytes / 1024).toFixed(0)}KB
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Email Body */}
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
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <EmailTagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        emailId={email.id}
        emailSubject={email.subject || undefined}
      />
    </>
  );
}
