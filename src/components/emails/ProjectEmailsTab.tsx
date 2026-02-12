import { useState } from "react";
import { format } from "date-fns";
import { Mail, Paperclip, X, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useProjectEmails, useUntagEmail } from "@/hooks/useEmails";
import { EmailDetailSheet } from "./EmailDetailSheet";
import { useToast } from "@/hooks/use-toast";
import type { EmailWithTags } from "@/hooks/useEmails";

interface ProjectEmailsTabProps {
  projectId: string;
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

export function ProjectEmailsTab({ projectId }: ProjectEmailsTabProps) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedEmail, setSelectedEmail] = useState<EmailWithTags | null>(null);
  const { data: taggedEmails = [], isLoading } = useProjectEmails(projectId);
  const untagEmail = useUntagEmail();
  const { toast } = useToast();

  const filtered =
    categoryFilter === "all"
      ? taggedEmails
      : taggedEmails.filter((t: any) => t.category === categoryFilter);

  const handleUntag = async (tagId: string) => {
    try {
      await untagEmail.mutateAsync(tagId);
      toast({ title: "Tag removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4">Loading emails...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Emails ({taggedEmails.length})
        </h3>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="objection">🚨 Objection</SelectItem>
            <SelectItem value="agency">📋 Agency</SelectItem>
            <SelectItem value="client">👤 Client</SelectItem>
            <SelectItem value="submission">📄 Submission</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <Mail className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No emails tagged to this project</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tag: any) => {
            const email = tag.emails;
            if (!email) return null;

            return (
              <div
                key={tag.id}
                className="border rounded-lg p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() =>
                      setSelectedEmail({
                        ...email,
                        email_project_tags: [],
                        email_attachments: email.email_attachments || [],
                      })
                    }
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">
                        {email.from_name || email.from_email}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          categoryColors[tag.category] || categoryColors.other
                        )}
                      >
                        {categoryLabels[tag.category] || tag.category}
                      </Badge>
                      {email.has_attachments && (
                        <Paperclip className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm truncate">{email.subject || "(no subject)"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {email.snippet}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {email.date ? format(new Date(email.date), "MMM d") : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleUntag(tag.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EmailDetailSheet
        email={selectedEmail}
        open={!!selectedEmail}
        onOpenChange={(open) => !open && setSelectedEmail(null)}
      />
    </div>
  );
}
