import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ContentNotificationCandidate {
  id: string;
  title: string;
  priority: string | null;
  content_type: string | null;
  team_questions_count: number | null;
  created_at: string;
}

const EPOCH = "1970-01-01T00:00:00Z";

function priorityRank(p?: string | null) {
  switch ((p || "").toLowerCase()) {
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
    default: return 0;
  }
}

export function useContentNotifications() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  const queryKey = ["content-notifications", userId] as const;

  const query = useQuery({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      // Read last-seen (fall back to epoch on first use — don't insert here to avoid
      // races; the mark-as-read upsert creates the row when needed).
      const { data: readRow } = await supabase
        .from("content_notification_reads")
        .select("last_seen_at")
        .eq("user_id", userId!)
        .maybeSingle();

      const lastSeenAt = readRow?.last_seen_at ?? EPOCH;

      const { data: pending, error } = await supabase
        .from("content_candidates")
        .select("id, title, priority, content_type, team_questions_count, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;

      return {
        lastSeenAt,
        pending: (pending || []) as ContentNotificationCandidate[],
      };
    },
    // Poll for updates. Realtime `postgres_changes` on content_candidates
    // broadcasts row payloads to every subscriber regardless of RLS, which
    // leaked other companies' candidate rows. Polling keeps the fetch path
    // subject to RLS so cross-company data can't reach the browser.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("content_notification_reads")
        .upsert(
          { user_id: userId, last_seen_at: now },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const { newCandidates, highestPriority } = useMemo(() => {
    const lastSeen = query.data?.lastSeenAt ?? EPOCH;
    const list = (query.data?.pending || []).filter(
      (c) => c.created_at > lastSeen
    );
    const top = list.reduce(
      (acc, c) => Math.max(acc, priorityRank(c.priority)),
      0
    );
    const highest =
      top === 3 ? "high" : top === 2 ? "medium" : top === 1 ? "low" : null;
    return { newCandidates: list, highestPriority: highest };
  }, [query.data]);

  return {
    isLoading: query.isLoading,
    allPending: query.data?.pending || [],
    newCandidates,
    newCount: newCandidates.length,
    highestPriority,
    markAllRead: () => markAllRead.mutate(),
    isMarking: markAllRead.isPending,
  };
}
