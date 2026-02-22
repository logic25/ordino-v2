import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/routing/RouteGuards";

export default function AuthCallback() {
  const navigate = useNavigate();
  const handledRef = useRef(false);

  useEffect(() => {
    // Listen for the auth state change which reliably provides provider tokens
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (handledRef.current) return;

        console.log("AuthCallback: onAuthStateChange event:", event, "has session:", !!session);

        if (event === "SIGNED_IN" && session) {
          handledRef.current = true;

          console.log(
            "AuthCallback: provider_token present:",
            !!session.provider_token,
            "provider_refresh_token present:",
            !!session.provider_refresh_token,
            "provider:",
            session.user.app_metadata?.provider
          );

          // Store Google provider tokens for Gmail/Chat access
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
        } else if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          // If we get INITIAL_SESSION with a valid session but no SIGNED_IN event,
          // it means the user was already logged in. Just navigate.
          if (session && !handledRef.current) {
            // Give a brief window for SIGNED_IN to fire first
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

    // Safety timeout — if nothing happens in 10s, redirect to auth
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
