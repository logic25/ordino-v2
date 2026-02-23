import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/routing/RouteGuards";

async function storeProviderTokens(accessToken: string, refreshToken: string | null) {
  console.log("AuthCallback: storing provider tokens, has refresh:", !!refreshToken);
  try {
    const { data, error: fnError } = await supabase.functions.invoke("gmail-auth", {
      body: {
        action: "store_provider_tokens",
        access_token: accessToken,
        refresh_token: refreshToken,
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

export default function AuthCallback() {
  const navigate = useNavigate();
  const handledRef = useRef(false);

  useEffect(() => {
    // Try to extract tokens from the URL hash directly (most reliable method)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const providerTokenFromHash = hashParams.get("provider_token");
    const providerRefreshFromHash = hashParams.get("provider_refresh_token");
    
    console.log(
      "AuthCallback: URL hash has provider_token:", !!providerTokenFromHash,
      "provider_refresh_token:", !!providerRefreshFromHash
    );

    // Listen for the auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (handledRef.current) return;

        console.log(
          "AuthCallback: onAuthStateChange event:", event,
          "has session:", !!session,
          "provider_token:", !!session?.provider_token,
          "provider_refresh_token:", !!session?.provider_refresh_token,
          "provider:", session?.user?.app_metadata?.provider
        );

        if (event === "SIGNED_IN" && session) {
          handledRef.current = true;

          // Try provider tokens from session first, then from URL hash
          const accessToken = session.provider_token || providerTokenFromHash;
          const refreshToken = session.provider_refresh_token || providerRefreshFromHash;

          if (accessToken && session.user.app_metadata?.provider === "google") {
            await storeProviderTokens(accessToken, refreshToken);
          } else {
            console.warn(
              "AuthCallback: no provider tokens available.",
              "session.provider_token:", !!session.provider_token,
              "hashToken:", !!providerTokenFromHash,
              "provider:", session.user.app_metadata?.provider
            );
          }

          navigate("/dashboard", { replace: true });
        } else if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          if (session && !handledRef.current) {
            setTimeout(() => {
              if (!handledRef.current) {
                handledRef.current = true;
                console.log("AuthCallback: fallback navigation via", event);
                navigate("/dashboard", { replace: true });
              }
            }, 2000);
          }
        }
      }
    );

    // Safety timeout
    const safety = setTimeout(() => {
      if (!handledRef.current) {
        handledRef.current = true;
        console.warn("AuthCallback: timed out, redirecting to /auth");
        navigate("/auth", { replace: true });
      }
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(safety);
    };
  }, [navigate]);

  return <LoadingScreen />;
}
