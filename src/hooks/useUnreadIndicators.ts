import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns unread indicators for Chat, Email, and Billing sidebar items.
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

  // Count invoices in ready_to_send status (pending billing for admin review)
  const { data: pendingBillingCount = 0 } = useQuery({
    queryKey: ["billing-pending-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("status", "ready_to_send");
      if (error) throw error;
      return count ?? 0;
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
    billingPendingCount: pendingBillingCount,
  };
}
