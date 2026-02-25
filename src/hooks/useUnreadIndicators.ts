import { useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useEmails } from "@/hooks/useEmails";

const CHAT_LAST_VISITED_KEY = "chat_last_visited";
const EMAIL_LAST_VISITED_KEY = "email_last_visited";

function getStoredTimestamp(key: string): number {
  const stored = localStorage.getItem(key);
  return stored ? parseInt(stored, 10) : 0;
}

function setStoredTimestamp(key: string) {
  localStorage.setItem(key, Date.now().toString());
}

/**
 * Returns unread dot indicators for Chat and Email sidebar items.
 * Uses localStorage timestamps to track last visit.
 */
export function useUnreadIndicators() {
  const location = useLocation();

  // Update timestamps on page visits
  useEffect(() => {
    if (location.pathname === "/chat") {
      setStoredTimestamp(CHAT_LAST_VISITED_KEY);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === "/emails") {
      setStoredTimestamp(EMAIL_LAST_VISITED_KEY);
    }
  }, [location.pathname]);

  // Email: count emails newer than last visit
  const { data: emails = [] } = useEmails({});

  const emailUnreadCount = useMemo(() => {
    if (location.pathname === "/emails") return 0;
    const lastVisited = getStoredTimestamp(EMAIL_LAST_VISITED_KEY);
    if (emails.length === 0) return 0;
    return emails.filter((e: any) => {
      const emailTime = new Date(e.received_at || e.created_at).getTime();
      return emailTime > lastVisited;
    }).length;
  }, [emails, location.pathname]);

  // Chat: we don't have per-message read state so just show a dot
  // Show dot = emailUnreadCount > 0 pattern but boolean for chat
  const chatHasUnread = false; // No reliable unread detection for Google Chat

  return {
    chatHasUnread,
    emailHasUnread: emailUnreadCount > 0,
    emailUnreadCount,
  };
}
