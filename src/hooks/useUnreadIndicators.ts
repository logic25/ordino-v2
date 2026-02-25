import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns unread indicators for Chat and Email sidebar items.
 * Uses a lightweight query to count unread emails without pulling full email data.
 */
export function useUnreadIndicators() {
  // Lightweight query: only fetch id + is_read for unread count
  const { data: unreadEmails = [] } = useQuery({
    queryKey: ["email-unread-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emails")
        .select("id")
        .eq("is_read", false)
        .is("archived_at", null);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const emailUnreadCount = unreadEmails.length;
  const chatHasUnread = false;

  return {
    chatHasUnread,
    emailHasUnread: emailUnreadCount > 0,
    emailUnreadCount,
  };
}
