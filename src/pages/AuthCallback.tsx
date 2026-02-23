import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/routing/RouteGuards";

export default function AuthCallback() {
  const navigate = useNavigate();
  const handledRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (handledRef.current) return;

        if (event === "SIGNED_IN" && session) {
          handledRef.current = true;
          navigate("/dashboard", { replace: true });
        } else if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          if (session && !handledRef.current) {
            setTimeout(() => {
              if (!handledRef.current) {
                handledRef.current = true;
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
