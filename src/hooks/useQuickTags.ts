import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EmailWithTags } from "@/hooks/useEmails";

export const QUICK_TAGS = [
  { name: "DOB", color: "bg-info/15 text-info border-info/30" },
  { name: "FDNY", color: "bg-destructive/15 text-destructive border-destructive/30" },
  { name: "DEP", color: "bg-success/15 text-success border-success/30" },
  { name: "LPC", color: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700" },
  { name: "OBJECTION", color: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700" },
  { name: "APPROVAL", color: "bg-success/15 text-success border-success/30" },
  { name: "INSPECTION", color: "bg-warning/15 text-warning border-warning/30" },
  { name: "FILING", color: "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700" },
  { name: "CLIENT", color: "bg-muted text-muted-foreground border-border" },
] as const;

export type QuickTagName = typeof QUICK_TAGS[number]["name"];

export function getTagColor(tag: string): string {
  return QUICK_TAGS.find((t) => t.name === tag)?.color || "bg-muted text-muted-foreground border-border";
}

export function detectAutoTags(email: EmailWithTags): string[] {
  const tags: Set<string> = new Set();
  const from = (email.from_email || "").toLowerCase();
  const to = Array.isArray(email.to_emails)
    ? (email.to_emails as string[]).join(" ").toLowerCase()
    : "";
  const subject = (email.subject || "").toLowerCase();
  const snippet = (email.snippet || "").toLowerCase();
  const text = `${subject} ${snippet}`;

  // Agency detection
  if (from.includes("@buildings.nyc.gov") || to.includes("@buildings.nyc.gov") ||
      ((from.includes("@nyc.gov") || to.includes("@nyc.gov")) && text.includes("dob"))) {
    tags.add("DOB");
  }
  if (from.includes("@fdny.nyc.gov") || to.includes("@fdny.nyc.gov")) {
    tags.add("FDNY");
  }
  if (from.includes("@dep.nyc.gov") || to.includes("@dep.nyc.gov")) {
    tags.add("DEP");
  }
  if (from.includes("@lpc.nyc.gov") || to.includes("@lpc.nyc.gov")) {
    tags.add("LPC");
  }

  // Content detection
  if (/objection|disapproved/.test(text)) tags.add("OBJECTION");
  if (/\bapproved\b|approval/.test(text)) tags.add("APPROVAL");
  if (/inspection|inspect/.test(text)) tags.add("INSPECTION");
  if (/filing|filed/.test(text)) tags.add("FILING");

  // Client detection
  if (email.email_project_tags && email.email_project_tags.length > 0) {
    tags.add("CLIENT");
  }

  return Array.from(tags);
}

export function useUpdateQuickTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ emailId, tags }: { emailId: string; tags: string[] }) => {
      const { error } = await supabase
        .from("emails")
        .update({ tags } as any)
        .eq("id", emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}
