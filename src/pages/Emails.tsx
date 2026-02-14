import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, HelpCircle, Globe, Loader2, Plus, Clock, Trash2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GmailConnectButton } from "@/components/emails/GmailConnectButton";
import { EmailList } from "@/components/emails/EmailList";
import { EmailDetailSheet } from "@/components/emails/EmailDetailSheet";
import { EmailFilterTabs, getFilteredEmails, getTabCounts, type EmailFilterTab } from "@/components/emails/EmailFilterTabs";
import { KeyboardShortcutsDialog } from "@/components/emails/KeyboardShortcutsDialog";
import { ComposeEmailDialog } from "@/components/emails/ComposeEmailDialog";
import { useEmails, type EmailWithTags, type EmailFilters } from "@/hooks/useEmails";
import { useScheduledEmails, useCancelScheduledEmail } from "@/hooks/useScheduledEmails";
import { useEmailKeyboardShortcuts } from "@/hooks/useEmailKeyboardShortcuts";
import { useConnectGmail } from "@/hooks/useGmailConnection";
import { useNewEmailNotifications } from "@/hooks/useNewEmailNotifications";
import { useGmailSearch } from "@/hooks/useGmailSearch";
import { useToast } from "@/hooks/use-toast";

export default function Emails() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEmail, setSelectedEmail] = useState<EmailWithTags | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<EmailFilterTab>("inbox");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const connectGmail = useConnectGmail();
  const { data: scheduledEmails = [] } = useScheduledEmails();
  const cancelScheduled = useCancelScheduledEmail();
  const { results: gmailResults, isSearching: isGmailSearching, hasSearched: hasGmailSearched, search: searchGmail, clearSearch: clearGmailSearch } = useGmailSearch();

  // Real-time notifications
  useNewEmailNotifications();

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

  // Keep selectedEmail in sync with fresh data
  useEffect(() => {
    if (selectedEmail && allEmails.length > 0) {
      const fresh = allEmails.find((e) => e.id === selectedEmail.id);
      if (fresh && fresh !== selectedEmail) {
        setSelectedEmail(fresh);
      }
    }
  }, [allEmails]);

  // Apply client-side tab filtering
  const filteredEmails = useMemo(
    () => getFilteredEmails(allEmails, activeTab),
    [allEmails, activeTab]
  );

  const tabCounts = useMemo(() => getTabCounts(allEmails, scheduledEmails.length), [allEmails, scheduledEmails.length]);

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
    if (selectedEmail) {
      setTagDialogOpen(true);
    }
  }, [selectedEmail]);

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
              size="sm"
              onClick={() => setComposeOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Compose
            </Button>
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
              onChange={(e) => {
                setSearch(e.target.value);
                if (!e.target.value) clearGmailSearch();
              }}
              className="pl-9"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); clearGmailSearch(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          {search && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => searchGmail(search)}
              disabled={isGmailSearching}
            >
              {isGmailSearching ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Globe className="h-4 w-4 mr-1.5" />
              )}
              Search all Gmail
            </Button>
          )}
        </div>

        {/* Gmail Search Results */}
        {hasGmailSearched && (
          <div className="border rounded-lg bg-card mb-3 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">
                Gmail Search Results
                <Badge variant="secondary" className="ml-2">{gmailResults.length}</Badge>
              </p>
              <Button variant="ghost" size="sm" onClick={clearGmailSearch}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {isGmailSearching ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Searching Gmail...
              </div>
            ) : gmailResults.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No results found in Gmail.</p>
            ) : (
              <div className="divide-y max-h-60 overflow-y-auto">
                {gmailResults.map((r, i) => (
                  <div
                    key={r.gmail_message_id || i}
                    className="py-2 px-1 flex items-start justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{r.from_name || r.from_email}</span>
                        {r.source === "synced" ? (
                          <Badge variant="outline" className="text-[10px] px-1.5">Synced</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5">Gmail only</Badge>
                        )}
                      </div>
                      <p className="truncate text-foreground">{r.subject}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.snippet}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {r.date ? new Date(r.date).toLocaleDateString() : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
          ) : activeTab === "scheduled" ? (
            <div className="p-4 space-y-2">
              {scheduledEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Clock className="h-12 w-12 mb-3 opacity-40" />
                  <p className="text-sm font-medium">No scheduled emails</p>
                  <p className="text-xs mt-1">Use "Send Later" when composing to schedule emails</p>
                </div>
              ) : (
                scheduledEmails.map((se) => {
                  const draft = se.email_draft;
                  return (
                    <div
                      key={se.id}
                      className="border rounded-lg p-3 flex items-start justify-between gap-3 bg-card"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          To: {draft.to}
                        </p>
                        <p className="text-sm text-foreground/80 truncate">
                          {draft.subject}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Sends {formatDistanceToNow(new Date(se.scheduled_send_time), { addSuffix: true })}
                            {" · "}
                            {format(new Date(se.scheduled_send_time), "MMM d, h:mm a")}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          try {
                            await cancelScheduled.mutateAsync(se.id);
                            toast({ title: "Scheduled email cancelled" });
                          } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                          }
                        }}
                        disabled={cancelScheduled.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
              )}
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
        tagDialogOpen={tagDialogOpen}
        onTagDialogOpenChange={setTagDialogOpen}
      />

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />

      <ComposeEmailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
      />
    </AppLayout>
  );
}
