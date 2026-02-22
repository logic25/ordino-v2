import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/routing/RouteGuards";

export default function AuthCallback() {
  const navigate = useNavigate();
  const handledRef = useRef(false);

  useEffect(() => {
    // Process the OAuth callback: store tokens, then navigate
    async function handleCallback() {
      if (handledRef.current) return;
      handledRef.current = true;

      try {
        // Wait for Supabase to process the URL hash and establish session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          console.warn("AuthCallback: no session found, redirecting to /auth", error);
          navigate("/auth", { replace: true });
          return;
        }

        // If this is a Google login with provider tokens, store them BEFORE navigating
        if (session.provider_token && session.user.app_metadata?.provider === "google") {
          console.log("AuthCallback: storing Google provider tokens...");
          try {
            const { data, error: fnError } = await supabase.functions.invoke("gmail-auth", {
              body: {
                action: "store_provider_tokens",
                access_token: session.provider_token,
                refresh_token: session.provider_refresh_token ?? null,
              },
            });
            if (fnError) {
              console.warn("AuthCallback: gmail-auth failed:", fnError.message);
            } else {
              console.log("AuthCallback: tokens stored successfully", data);
            }
          } catch (e) {
            console.warn("AuthCallback: gmail-auth exception:", e);
          }
        }

        navigate("/dashboard", { replace: true });
      } catch (e) {
        console.error("AuthCallback: unexpected error", e);
        navigate("/auth", { replace: true });
      }
    }

    // Small delay to let Supabase client process the URL hash
    const timer = setTimeout(handleCallback, 100);
    return () => clearTimeout(timer);
  }, [navigate]);

  return <LoadingScreen />;
}
