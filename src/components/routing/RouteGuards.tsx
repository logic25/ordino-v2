import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Loading spinner component
export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center animate-pulse-soft">
          <span className="text-accent-foreground font-bold text-lg">O</span>
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// Protected route wrapper - requires auth AND profile
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileLoading, hasProfile, signingOut } = useAuth();
  const location = useLocation();

  if (loading || signingOut) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to={location.pathname.startsWith("/portal") ? "/portal/auth" : "/auth"} replace />;
  }

  // Wait for profile fetch to settle before deciding setup vs dashboard,
  // otherwise existing users briefly bounce to /setup.
  if (profileLoading) {
    return <LoadingScreen />;
  }

  // If authenticated but no profile, redirect to setup
  if (!hasProfile) {
    return <Navigate to="/setup" replace />;
  }

  // Client portal users are confined to /portal/*
  if (
    profile?.portal_role === "client" &&
    !location.pathname.startsWith("/portal")
  ) {
    return <Navigate to="/portal" replace />;
  }

  return <RouteErrorBoundary>{children}</RouteErrorBoundary>;
}

function getPortalNameParts(user: NonNullable<ReturnType<typeof useAuth>["user"]>) {
  const meta = user.user_metadata ?? {};
  const fallback = user.email?.split("@")[0] ?? "Client";
  const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  const firstName =
    (typeof meta.given_name === "string" && meta.given_name.trim()) ||
    fullName.split(/\s+/)[0] ||
    fallback;
  const lastName =
    (typeof meta.family_name === "string" && meta.family_name.trim()) ||
    fullName.split(/\s+/).slice(1).join(" ") ||
    "User";

  return { firstName, lastName };
}

function PortalSetupScreen({ message = "Setting up your portal..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center animate-pulse-soft">
          <span className="text-accent-foreground font-bold text-lg">O</span>
        </div>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function PortalInviteError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-3">
        <div className="mx-auto w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
          <span className="text-accent-foreground font-bold text-lg">O</span>
        </div>
        <h1 className="text-lg font-semibold text-foreground">Portal invite could not be opened</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// Portal route wrapper - accepts client invites in-place instead of bouncing through /setup.
export function PortalRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileLoading, hasProfile, signingOut, refreshProfile } = useAuth();
  const [setupError, setSetupError] = useState<string | null>(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || signingOut || profileLoading || !user || hasProfile) return;
    if (attemptedRef.current === user.id) return;

    attemptedRef.current = user.id;
    setAcceptingInvite(true);
    setSetupError(null);

    const { firstName, lastName } = getPortalNameParts(user);

    (async () => {
      const { error } = await supabase.rpc("accept_client_portal_invite", {
        first_name: firstName,
        last_name: lastName,
      });

      if (error) throw error;

      const updated = await refreshProfile();
      if (!updated) {
        throw new Error("Your invite was accepted, but your portal profile could not be loaded yet. Refresh the page to try again.");
      }
    })()
      .catch((err: any) => {
        const rawMessage = err?.message ?? "This link may be expired, already used, or tied to a different email address.";
        const friendlyMessage = rawMessage.includes("No pending client portal invite")
          ? "This link does not match an active invite for the signed-in email. Open the invite from the email address it was sent to, or ask your project manager to resend it."
          : rawMessage;
        setSetupError(friendlyMessage);
      })
      .finally(() => setAcceptingInvite(false));
  }, [loading, signingOut, profileLoading, user, hasProfile, refreshProfile]);

  if (loading || signingOut || profileLoading || acceptingInvite) {
    return <PortalSetupScreen />;
  }

  if (!user) {
    return <Navigate to="/portal/auth" replace />;
  }

  if (!hasProfile) {
    if (setupError) return <PortalInviteError message={setupError} />;
    return <PortalSetupScreen />;
  }

  return <RouteErrorBoundary>{children}</RouteErrorBoundary>;
}

// Setup route wrapper - requires auth but NO profile yet
export function SetupRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileLoading, hasProfile } = useAuth();

  if (loading || profileLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If they already have a profile, redirect based on portal_role
  if (hasProfile) {
    return (
      <Navigate to={profile?.portal_role === "client" ? "/portal" : "/dashboard"} replace />
    );
  }

  return <>{children}</>;
}

// Public route wrapper (redirects to dashboard if already logged in with profile)
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileLoading, hasProfile } = useAuth();
  const [searchParams] = useSearchParams();

  // Check if this is a password reset flow - don't redirect
  const isPasswordReset = searchParams.get("reset") === "true";

  if (loading) {
    return <LoadingScreen />;
  }

  // Allow access to auth page during password reset flow
  if (isPasswordReset) {
    return <>{children}</>;
  }

  if (user) {
    if (profileLoading) {
      return <LoadingScreen />;
    }
    // If logged in but no profile, go to setup
    if (!hasProfile) {
      return <Navigate to="/setup" replace />;
    }
    // Client users → /portal, everyone else → /dashboard
    return (
      <Navigate to={profile?.portal_role === "client" ? "/portal" : "/dashboard"} replace />
    );
  }

  return <>{children}</>;
}
