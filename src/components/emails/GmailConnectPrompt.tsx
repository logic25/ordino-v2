import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Mail, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGmailConnection, useGetGmailAuthUrl } from "@/hooks/useGmailConnection";

const DISMISS_KEY = "gmail-connect-banner-dismissed";

/**
 * Prompts a signed-in user to connect their Gmail. Self-gates: renders nothing
 * when Gmail is already connected, while the connection is loading, or on the
 * Emails page (which has its own connect screen). Users already authenticate via
 * Google sign-in, but the Gmail mailbox is a separate OAuth consent — this nudges
 * them to grant it during onboarding instead of discovering it later.
 *
 * variant="card"   — prominent onboarding card (Welcome page)
 * variant="banner" — slim, dismissible app-wide banner
 */
export function GmailConnectPrompt({ variant = "banner" }: { variant?: "banner" | "card" }) {
  const { data: connection, isLoading } = useGmailConnection();
  const getAuthUrl = useGetGmailAuthUrl();
  const { toast } = useToast();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");

  if (isLoading || connection) return null;
  if (location.pathname.startsWith("/emails")) return null;
  // The banner is suppressed on the onboarding page, which shows the card instead.
  if (variant === "banner" && (dismissed || location.pathname.startsWith("/welcome"))) return null;

  const connect = async () => {
    try {
      const result = await getAuthUrl.mutateAsync(`${window.location.origin}/emails`);
      if (result?.auth_url) window.location.href = result.auth_url;
    } catch {
      toast({
        title: "Gmail setup required",
        description: "Gmail isn't configured yet — contact your admin to finish Google Cloud setup.",
      });
    }
  };

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (variant === "card") {
    return (
      <Card className="border-accent/40 bg-accent/5">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="rounded-lg bg-accent/10 p-2"><Mail className="h-5 w-5 text-accent" /></div>
          <div className="flex-1">
            <h3 className="font-semibold">Connect your email</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Link your Gmail to send, receive, and log emails to the right projects — all inside Ordino.
            </p>
            <Button className="mt-3" onClick={connect} disabled={getAuthUrl.isPending}>
              {getAuthUrl.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Connect Gmail
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/5 px-4 py-2.5">
      <Mail className="h-4 w-4 text-accent shrink-0" />
      <p className="text-sm flex-1">Connect your Gmail to send, receive, and log emails to projects inside Ordino.</p>
      <Button size="sm" onClick={connect} disabled={getAuthUrl.isPending}>
        {getAuthUrl.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect Gmail"}
      </Button>
      <button onClick={dismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
