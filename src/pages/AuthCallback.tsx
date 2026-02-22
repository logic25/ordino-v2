import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/routing/RouteGuards";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        // Auto-store Gmail tokens if this is a Google login with provider_token
        if (session.provider_token && session.user.app_metadata?.provider === "google") {
          try {
            const { data, error } = await supabase.functions.invoke("gmail-auth", {
              body: {
                action: "store_provider_tokens",
                access_token: session.provider_token,
                refresh_token: session.provider_refresh_token ?? null,
              },
            });
            if (error || data?.error) {
              console.warn("Gmail auto-connect failed:", error?.message || data?.error);
            }
          } catch (e) {
            console.warn("Gmail auto-connect failed:", e);
          }
        }
        navigate("/dashboard", { replace: true });
      } else if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
        navigate("/auth", { replace: true });
      }
    });

    // Also check immediately in case session is already set
    // BUT only navigate if we DON'T have a provider_token to store
    // (the onAuthStateChange handler will handle Google logins with token storage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !(session.provider_token && session.user.app_metadata?.provider === "google")) {
        navigate("/dashboard", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return <LoadingScreen />;
}
