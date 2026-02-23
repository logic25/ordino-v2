import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/routing/RouteGuards";

// Extract tokens from URL hash IMMEDIATELY at module load, before supabase-js can consume them
const rawHash = window.location.hash;
const hashParams = new URLSearchParams(rawHash.substring(1));
const capturedProviderToken = hashParams.get("provider_token");
const capturedProviderRefresh = hashParams.get("provider_refresh_token");
console.log(
  "AuthCallback MODULE LOAD: provider_token:", !!capturedProviderToken,
  "provider_refresh_token:", !!capturedProviderRefresh,
  "hash length:", rawHash.length
);

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (handledRef.current) return;

        console.log(
          "AuthCallback: event:", event,
          "session:", !!session,
          "session.provider_token:", !!session?.provider_token,
          "capturedProviderToken:", !!capturedProviderToken,
          "provider:", session?.user?.app_metadata?.provider
        );

        if (event === "SIGNED_IN" && session) {
          handledRef.current = true;

          const accessToken = session.provider_token || capturedProviderToken;
          const refreshToken = session.provider_refresh_token || capturedProviderRefresh;

          if (accessToken && session.user.app_metadata?.provider === "google") {
            await storeProviderTokens(accessToken, refreshToken);
          } else {
            console.warn("AuthCallback: no provider tokens available");
          }

          navigate("/dashboard", { replace: true });
        } else if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          if (session && !handledRef.current) {
            setTimeout(() => {
              if (!handledRef.current) {
                handledRef.current = true;
                console.log("AuthCallback: fallback nav via", event);
                navigate("/dashboard", { replace: true });
              }
            }, 2000);
          }
        }
      }
    );

    const safety = setTimeout(() => {
      if (!handledRef.current) {
        handledRef.current = true;
        console.warn("AuthCallback: timed out");
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
