import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShieldCheck, Loader2 } from "lucide-react";

// Minimal typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthAPI = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: any; error: { message: string } | null }>;
};
const authOauth = (supabase.auth as any).oauth as OAuthAPI | undefined;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id.");
        setLoading(false);
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Preserve the full consent URL so the auth route returns here.
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      setUserEmail(sess.session.user.email ?? null);
      if (!authOauth) {
        setError(
          "This project's Supabase client doesn't expose the OAuth authorization API. Contact support.",
        );
        setLoading(false);
        return;
      }
      const { data, error } = await authOauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    if (!authOauth) return;
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await authOauth.approveAuthorization(authorizationId)
      : await authOauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("The authorization server did not return a redirect URL.");
      return;
    }
    window.location.href = target;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Could not load this authorization</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/dashboard">Back to Ordino</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an app";
  const redirectUri =
    details?.client?.redirect_uri ??
    (Array.isArray(details?.client?.redirect_uris) ? details.client.redirect_uris[0] : null);
  const scopeList: string[] = (details?.scope ?? details?.requested_scopes ?? "openid email profile")
    .toString()
    .split(/\s+/)
    .filter(Boolean);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle>Connect {clientName} to Ordino</CardTitle>
          </div>
          <CardDescription>
            {clientName} will be able to call Ordino's read-only tools while you are signed in as{" "}
            <span className="font-medium text-foreground">{userEmail}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-2">
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
                Requested permissions
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {scopeList.includes("openid") && <li>Verify your Ordino identity</li>}
                {scopeList.includes("email") && <li>Read your email address</li>}
                {scopeList.includes("profile") && <li>Read your basic profile</li>}
                <li>Call Ordino read-only tools on your behalf (subject to your access)</li>
              </ul>
            </div>
            {redirectUri && (
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
                  Redirect URI
                </div>
                <code className="text-xs break-all">{redirectUri}</code>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-2">
              This does not bypass Ordino's row-level security. The app can only see the same data
              you can. Every call is written to the MCP audit log.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => decide(true)} disabled={busy} className="flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
            </Button>
            <Button
              onClick={() => decide(false)}
              disabled={busy}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
