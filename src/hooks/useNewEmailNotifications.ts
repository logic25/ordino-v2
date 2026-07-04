import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Listens for the `gmail-sync:<profile_id>` broadcast emitted at the end of
 * the gmail-sync edge function and invalidates the email caches so the inbox
 * list and unread badge refresh the instant a sync completes.
 *
 * Realtime on the `emails` table itself is intentionally OFF (cross-tenant
 * leak risk) — broadcasts are scoped per-user.
 */
export function useNewEmailNotifications() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`gmail-sync:${profile.id}`)
      .on("broadcast", { event: "sync_complete" }, () => {
        queryClient.invalidateQueries({ queryKey: ["emails"] });
        queryClient.invalidateQueries({ queryKey: ["email-unread-count"] });
        queryClient.invalidateQueries({ queryKey: ["project-emails"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, queryClient]);
}
