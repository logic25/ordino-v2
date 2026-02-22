import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

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
  const { user, loading, hasProfile } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If authenticated but no profile, redirect to setup
  if (!hasProfile) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

// Setup route wrapper - requires auth but NO profile yet
export function SetupRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, hasProfile } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If they already have a profile, redirect to dashboard
  if (hasProfile) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Public route wrapper (redirects to dashboard if already logged in with profile)
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, hasProfile } = useAuth();
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
    // If logged in but no profile, go to setup
    if (!hasProfile) {
      return <Navigate to="/setup" replace />;
    }
    // Otherwise go to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
