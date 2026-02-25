import { useMemo, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useGChatSpaces } from "@/hooks/useGoogleChat";
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

  // Chat: check if any spaces have recent activity
  const { data: spaces = [] } = useGChatSpaces();

  const chatHasUnread = useMemo(() => {
    if (location.pathname === "/chat") return false;
    const lastVisited = getStoredTimestamp(CHAT_LAST_VISITED_KEY);
    if (!lastVisited || spaces.length === 0) return false;
    // If spaces exist but user has never visited chat, show dot
    if (lastVisited === 0 && spaces.length > 0) return true;
    // We don't have per-space lastActiveTime from the API cache,
    // so show dot if spaces were refreshed after last visit
    // (conservative: only show if user hasn't visited recently)
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    return lastVisited < fiveMinAgo;
  }, [spaces, location.pathname]);

  // Email: check for unread emails
  const { data: emails = [] } = useEmails({});

  const emailHasUnread = useMemo(() => {
    if (location.pathname === "/emails") return false;
    const lastVisited = getStoredTimestamp(EMAIL_LAST_VISITED_KEY);
    if (emails.length === 0) return false;
    // Check if any email arrived after last visit
    return emails.some((e: any) => {
      const emailTime = new Date(e.received_at || e.created_at).getTime();
      return emailTime > lastVisited;
    });
  }, [emails, location.pathname]);

  return { chatHasUnread, emailHasUnread };
}
