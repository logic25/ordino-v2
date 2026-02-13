import { useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, HelpCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GmailConnectButton } from "@/components/emails/GmailConnectButton";
import { EmailList } from "@/components/emails/EmailList";
import { EmailDetailSheet } from "@/components/emails/EmailDetailSheet";
import { EmailFilterTabs, getFilteredEmails, getTabCounts, type EmailFilterTab } from "@/components/emails/EmailFilterTabs";
import { KeyboardShortcutsDialog } from "@/components/emails/KeyboardShortcutsDialog";
import { useEmails, type EmailWithTags, type EmailFilters } from "@/hooks/useEmails";
import { useEmailKeyboardShortcuts } from "@/hooks/useEmailKeyboardShortcuts";
import { useConnectGmail } from "@/hooks/useGmailConnection";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function Emails() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEmail, setSelectedEmail] = useState<EmailWithTags | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<EmailFilterTab>("all");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const connectGmail = useConnectGmail();

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      const redirectUri = `${window.location.origin}/emails`;
      connectGmail
        .mutateAsync({ code, redirect_uri: redirectUri })
        .then(() => {
          toast({ title: "Gmail Connected", description: "You can now sync your emails." });
          setSearchParams({});
        })
        .catch((err) => {
          toast({ title: "Connection Failed", description: err.message, variant: "destructive" });
          setSearchParams({});
        });
    }
  }, []);

  const filters: EmailFilters = {
    search: search || undefined,
    includeArchived: activeTab === "archived",
    includeSnoozed: activeTab === "snoozed",
  };

  const { data: allEmails = [], isLoading } = useEmails(filters);

  // Apply client-side tab filtering
  const filteredEmails = useMemo(
    () => getFilteredEmails(allEmails, activeTab),
    [allEmails, activeTab]
  );

  const tabCounts = useMemo(() => getTabCounts(allEmails), [allEmails]);

  // Auto-scroll highlighted email into view
  useEffect(() => {
    if (highlightedIndex >= 0) {
      const el = document.querySelector(`[data-email-index="${highlightedIndex}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleOpenEmail = useCallback(
    (index: number) => {
      if (index >= 0 && index < filteredEmails.length) {
        setSelectedEmail(filteredEmails[index]);
      }
    },
    [filteredEmails]
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedEmail(null);
  }, []);

  const handleArchiveShortcut = useCallback(() => {
    // Archive is handled inside the detail sheet
  }, []);

  const handleOpenTagDialog = useCallback(() => {
    // Tag dialog opens from detail sheet
  }, []);

  const handleFocusReply = useCallback(() => {
    const textarea = document.querySelector("[data-reply-textarea]") as HTMLTextAreaElement;
    textarea?.focus();
  }, []);

  useEmailKeyboardShortcuts({
    emails: filteredEmails,
    highlightedIndex,
    setHighlightedIndex,
    onOpenEmail: handleOpenEmail,
    onCloseDetail: handleCloseDetail,
    onArchive: handleArchiveShortcut,
    onOpenTagDialog: handleOpenTagDialog,
    onFocusReply: handleFocusReply,
    onShowShortcuts: () => setShortcutsOpen(true),
    searchInputRef,
    detailOpen: !!selectedEmail,
  });

  // Reset highlight when tab or search changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [activeTab, search]);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-theme(spacing.16))]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Email</h1>
            <p className="text-sm text-muted-foreground">
              Sync and tag emails to projects
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShortcutsOpen(true)}
              title="Keyboard shortcuts (?)"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <GmailConnectButton />
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search emails..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs + Email List */}
        <div className="border rounded-lg bg-card overflow-hidden flex-1 min-h-0 flex flex-col">
          <EmailFilterTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={tabCounts}
          />
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading emails...
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              <EmailList
                emails={filteredEmails}
                selectedId={selectedEmail?.id}
                highlightedIndex={highlightedIndex}
                onSelect={(email) => {
                  setSelectedEmail(email);
                  setHighlightedIndex(filteredEmails.indexOf(email));
                }}
              />
            </div>
          )}
        </div>
      </div>

      <EmailDetailSheet
        email={selectedEmail}
        open={!!selectedEmail}
        onOpenChange={(open) => !open && setSelectedEmail(null)}
        onArchived={() => setSelectedEmail(null)}
      />

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </AppLayout>
  );
}
