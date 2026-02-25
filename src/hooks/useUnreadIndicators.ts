import { useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useEmails } from "@/hooks/useEmails";

/**
 * Returns unread indicators for Chat and Email sidebar items.
 * Email: counts emails where is_read === false.
 * Chat: no reliable unread detection available.
 */
export function useUnreadIndicators() {
  const location = useLocation();

  // Email: count truly unread emails via is_read field
  const { data: emails = [] } = useEmails({});

  const emailUnreadCount = useMemo(() => {
    return emails.filter((e: any) => e.is_read === false).length;
  }, [emails]);

  const chatHasUnread = false;

  return {
    chatHasUnread,
    emailHasUnread: emailUnreadCount > 0,
    emailUnreadCount,
  };
}
