import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInboxUnreadCount } from "./useInboxUnreadCount";

/**
 * Returns unread indicators for Chat, Email, and Billing sidebar items.
 */
export function useUnreadIndicators() {
  // Inbox unread — shared single source of truth with the Inbox tab count.
  const { data: emailUnreadCount = 0 } = useInboxUnreadCount();

  // Count invoices in ready_to_send status (pending billing for admin review)
  const { data: pendingBillingCount = 0 } = useQuery({
    queryKey: ["billing-sidebar-badge"],
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
    refetchOnWindowFocus: true,
  });

  const chatHasUnread = false;

  return {
    chatHasUnread,
    emailHasUnread: emailUnreadCount > 0,
    emailUnreadCount,
    billingPendingCount: pendingBillingCount,
  };
}
