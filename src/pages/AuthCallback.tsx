import { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/routing/RouteGuards";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handledRef = useRef(false);
  const [timedOut, setTimedOut] = useState(false);

  const rawNext = searchParams.get("next") || "/dashboard";
  const nextPath = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  useEffect(() => {
    const finish = () => {
      if (handledRef.current) return;
      handledRef.current = true;
      navigate(nextPath, { replace: true });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (handledRef.current) return;

        if (event === "SIGNED_IN" && session) {
          finish();
        } else if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          if (session && !handledRef.current) {
            setTimeout(() => {
              finish();
            }, 2000);
          }
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish();
    });

    const safety = setTimeout(() => {
      if (!handledRef.current) {
        setTimedOut(true);
      }
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(safety);
    };
  }, [navigate, nextPath]);

  if (timedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md px-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold text-foreground">
            Sign-in is taking longer than expected
          </h2>
          <p className="text-sm text-muted-foreground">
            This can happen if the confirmation link expired or there was a network issue.
          </p>
          <Button asChild variant="default">
            <Link to={nextPath.startsWith("/portal") ? "/portal/auth" : "/auth"}>Try signing in again</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <LoadingScreen />;
}
