import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/routing/RouteGuards";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for Supabase to pick up the session from the URL hash/params
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        navigate("/dashboard", { replace: true });
      } else if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
        navigate("/auth", { replace: true });
      }
    });

    // Also check immediately in case session is already set
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return <LoadingScreen />;
}
