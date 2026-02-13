import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Filter, X } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GmailConnectButton } from "@/components/emails/GmailConnectButton";
import { EmailList } from "@/components/emails/EmailList";
import { EmailDetailSheet } from "@/components/emails/EmailDetailSheet";
import { useEmails, type EmailWithTags, type EmailFilters } from "@/hooks/useEmails";
import { useConnectGmail } from "@/hooks/useGmailConnection";
import { useToast } from "@/hooks/use-toast";

export default function Emails() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEmail, setSelectedEmail] = useState<EmailWithTags | null>(null);
  const [search, setSearch] = useState("");
  const [untaggedOnly, setUntaggedOnly] = useState(false);
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
    untaggedOnly,
  };

  const { data: emails = [], isLoading } = useEmails(filters);

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
          <GmailConnectButton />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
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
          <div className="flex items-center gap-2">
            <Switch
              id="untagged"
              checked={untaggedOnly}
              onCheckedChange={setUntaggedOnly}
            />
            <Label htmlFor="untagged" className="text-sm cursor-pointer">
              Untagged only
            </Label>
          </div>
        </div>

        {/* Email List - scrollable */}
        <div className="border rounded-lg bg-card overflow-hidden flex-1 min-h-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading emails...
            </div>
          ) : (
            <div className="overflow-y-auto h-full">
              <EmailList
                emails={emails}
                selectedId={selectedEmail?.id}
                onSelect={setSelectedEmail}
              />
            </div>
          )}
        </div>
      </div>

      <EmailDetailSheet
        email={selectedEmail}
        open={!!selectedEmail}
        onOpenChange={(open) => !open && setSelectedEmail(null)}
      />
    </AppLayout>
  );
}
