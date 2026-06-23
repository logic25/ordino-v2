import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for the inbox unread count.
 * Used by BOTH the sidebar "Email" badge and the Inbox tab count
 * so they can never drift.
 *
 * Criteria: not archived, INBOX label present, not currently snoozed, is_read=false.
 */
export const INBOX_UNREAD_QUERY_KEY = ["email-unread-count"] as const;

export function useInboxUnreadCount() {
  return useQuery({
    queryKey: INBOX_UNREAD_QUERY_KEY,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { count, error } = await supabase
        .from("emails")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false)
        .is("archived_at", null)
        .filter("labels", "cs", '["INBOX"]')
        .or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}
