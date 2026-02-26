import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function Setup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, refreshProfile } = useAuth();
  const calledRef = useRef(false);

  useEffect(() => {
    if (!user || calledRef.current) return;
    calledRef.current = true;

    const meta = user.user_metadata ?? {};
    const firstName =
      meta.given_name ??
      meta.full_name?.split(" ")[0] ??
      user.email?.split("@")[0] ??
      "Team";
    const lastName =
      meta.family_name ??
      meta.full_name?.split(" ").slice(1).join(" ") ??
      "Member";

    (async () => {
      try {
        const { error } = await supabase.rpc("auto_join_existing_company", {
          first_name: firstName,
          last_name: lastName,
        });

        if (error) throw error;

        await refreshProfile();
        navigate("/dashboard", { replace: true });
      } catch (err: any) {
        console.error("Auto-join failed:", err);
        toast({
          title: "Setup failed",
          description: err.message || "Could not join the company.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
      }
    })();
  }, [user, refreshProfile, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center animate-pulse">
          <span className="text-accent-foreground font-bold text-lg">O</span>
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Setting up your account...</p>
        </div>
      </div>
    </div>
  );
}
