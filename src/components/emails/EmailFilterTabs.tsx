import { cn } from "@/lib/utils";
import type { EmailWithTags } from "@/hooks/useEmails";

export type EmailFilterTab =
  | "inbox"
  | "sent"
  | "agencies"
  | "clients"
  | "urgent"
  | "untagged"
  | "snoozed"
  | "archived"
  | "scheduled";

const AGENCY_DOMAINS = [
  "@nyc.gov",
  "@buildings.nyc.gov",
  "@fdny.nyc.gov",
  "@dep.nyc.gov",
  "@lpc.nyc.gov",
  "@planning.nyc.gov",
];

const URGENT_KEYWORDS = [
  "objection", "disapproved", "violation", "deadline",
  "final", "expires", "required", "immediately", "asap",
  "c of o", "certificate of occupancy",
];

function isSentEmail(email: EmailWithTags): boolean {
  const labels = email.labels as string[] | null;
  return Array.isArray(labels) && labels.some((l: string) => l === "SENT");
}

function isAgencyEmail(email: EmailWithTags): boolean {
  const from = (email.from_email || "").toLowerCase();
  return AGENCY_DOMAINS.some((d) => from.includes(d));
}

function isUrgentEmail(email: EmailWithTags): boolean {
  const text = `${email.subject || ""} ${email.snippet || ""}`.toLowerCase();
  return URGENT_KEYWORDS.some((kw) => text.includes(kw));
}

export function getFilteredEmails(
  emails: EmailWithTags[],
  tab: EmailFilterTab
): EmailWithTags[] {
  switch (tab) {
    case "inbox": {
      // Exclude sent-only, archived, snoozed — then sort unread first
      const inbox = emails.filter((e) => {
        if ((e as any).archived_at) return false;
        if ((e as any).snoozed_until && new Date((e as any).snoozed_until) > new Date()) return false;
        return true;
      });
      return inbox.sort((a, b) => {
        if (!a.is_read && b.is_read) return -1;
        if (a.is_read && !b.is_read) return 1;
        return 0; // preserve existing date order within each group
      });
    }
    case "sent":
      return emails.filter(isSentEmail);
    case "agencies":
      return emails.filter(isAgencyEmail);
    case "clients":
      return emails.filter(
        (e) => e.email_project_tags && e.email_project_tags.length > 0
      );
    case "urgent":
      return emails.filter(isUrgentEmail);
    case "untagged":
      return emails.filter(
        (e) => !e.email_project_tags || e.email_project_tags.length === 0
      );
    case "snoozed":
      return emails.filter(
        (e) => (e as any).snoozed_until && new Date((e as any).snoozed_until) > new Date()
      );
    case "archived":
      return emails.filter((e) => !!(e as any).archived_at);
    default:
      return emails;
  }
}

export function getTabCounts(
  emails: EmailWithTags[],
  scheduledCount?: number
): Record<EmailFilterTab, number> {
  const inboxEmails = emails.filter((e) => {
    if ((e as any).archived_at) return false;
    if ((e as any).snoozed_until && new Date((e as any).snoozed_until) > new Date()) return false;
    return true;
  });
  const unreadCount = inboxEmails.filter((e: EmailWithTags) => !e.is_read).length;
  return {
    inbox: unreadCount || inboxEmails.length,
    sent: emails.filter(isSentEmail).length,
    agencies: emails.filter(isAgencyEmail).length,
    clients: emails.filter(
      (e) => e.email_project_tags && e.email_project_tags.length > 0
    ).length,
    urgent: emails.filter(isUrgentEmail).length,
    untagged: emails.filter(
      (e) => !e.email_project_tags || e.email_project_tags.length === 0
    ).length,
    snoozed: emails.filter(
      (e) => (e as any).snoozed_until && new Date((e as any).snoozed_until) > new Date()
    ).length,
    scheduled: scheduledCount ?? 0,
    archived: emails.filter((e) => !!(e as any).archived_at).length,
  };
}

const TAB_CONFIG: { key: EmailFilterTab; label: string }[] = [
  { key: "inbox", label: "Inbox" },
  { key: "sent", label: "Sent" },
  { key: "agencies", label: "Agencies" },
  { key: "clients", label: "Clients" },
  { key: "urgent", label: "Urgent" },
  { key: "untagged", label: "Untagged" },
  { key: "snoozed", label: "Snoozed" },
  { key: "scheduled", label: "Scheduled" },
  { key: "archived", label: "Archived" },
];

interface EmailFilterTabsProps {
  activeTab: EmailFilterTab;
  onTabChange: (tab: EmailFilterTab) => void;
  counts: Record<EmailFilterTab, number>;
}

export function EmailFilterTabs({ activeTab, onTabChange, counts }: EmailFilterTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-card rounded-t-lg px-2 overflow-x-auto scrollbar-hide">
      {TAB_CONFIG.map(({ key, label }) => {
        const isActive = activeTab === key;
        const count = counts[key];
        return (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={cn(
              "px-3 py-2 text-sm whitespace-nowrap transition-colors relative",
              "hover:text-foreground",
              isActive
                ? "text-foreground font-semibold"
                : "text-muted-foreground"
            )}
          >
            {label}
            {count > 0 && (
              <span className={cn(
                "ml-1.5 text-xs tabular-nums",
                isActive ? "text-foreground" : "text-muted-foreground/60"
              )}>
                {count}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
