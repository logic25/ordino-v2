import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface GChatSpace {
  name: string;
  displayName: string;
  type: string;
  spaceType?: string;
  spaceThreadingState?: string;
  singleUserBotDm?: boolean;
}

/** Determine if a space is a DM (direct message or bot DM) */
export function isSpaceDM(s: GChatSpace): boolean {
  return s.spaceType === "DIRECT_MESSAGE" || s.type === "DIRECT_MESSAGE" || !!s.singleUserBotDm;
}

/** Determine if a space is a group chat */
export function isSpaceGroup(s: GChatSpace): boolean {
  return s.spaceType === "GROUP_CHAT" || s.type === "GROUP_CHAT";
}

/** Determine if a space is a named space/room */
export function isSpaceRoom(s: GChatSpace): boolean {
  return s.spaceType === "SPACE" || s.type === "SPACE" || s.type === "ROOM";
}

export interface GChatMessage {
  name: string;
  sender: { name: string; displayName: string; type: string; avatarUrl?: string };
  createTime: string;
  text?: string;
  thread?: { name: string; threadKey?: string };
  cards?: any[];
  cardsV2?: any[];
  formattedText?: string;
}

async function chatApi(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("google-chat-api", {
    body: { action, ...params },
  });
  if (error) {
    let errorMessage = error.message;
    try {
      if (typeof (error as any).context?.json === "function") {
        const body = await (error as any).context.json();
        if (body?.error) errorMessage = body.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(errorMessage);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

const SPACES_PAGE_SIZE = 25;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Read cached spaces directly from the database for instant loading.
 * Returns { spaces, cachedAt } or null if no cache exists.
 */
async function readCachedSpaces(profileId: string): Promise<{ spaces: GChatSpace[]; cachedAt: Date } | null> {
  const cacheKey = `spaces_${profileId}_ps${SPACES_PAGE_SIZE}_ptfirst`;
  const { data, error } = await supabase
    .from("gchat_spaces_cache" as any)
    .select("payload, cached_at")
    .eq("user_id", profileId)
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as any;
  return {
    spaces: row.payload?.spaces || [],
    cachedAt: new Date(row.cached_at),
  };
}

/**
 * Stale-while-revalidate spaces hook.
 * 1. Instantly loads cached spaces from the database
 * 2. Background-refreshes via edge function if cache is stale (> 5 min)
 */
export function useGChatSpaces() {
  const { profile } = useAuth();
  const profileId = (profile as any)?.id as string | undefined;
  const qc = useQueryClient();
  const refreshingRef = useRef(false);

  // Primary query: read from DB cache (instant)
  const cacheQuery = useQuery({
    queryKey: ["gchat-spaces-cache", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const cached = await readCachedSpaces(profileId!);
      return cached;
    },
    staleTime: CACHE_TTL_MS,
    retry: false,
  });

  // Background refresh: fire edge function if cache is stale or missing
  useEffect(() => {
    if (!profileId || refreshingRef.current) return;
    if (cacheQuery.isLoading) return;

    const cached = cacheQuery.data;
    const isStale = !cached || (Date.now() - cached.cachedAt.getTime()) > CACHE_TTL_MS;

    if (!isStale) return;

    refreshingRef.current = true;
    chatApi("list_spaces", { pageSize: SPACES_PAGE_SIZE })
      .then((res) => {
        // Edge function already updated the DB cache; refresh our local query
        qc.invalidateQueries({ queryKey: ["gchat-spaces-cache", profileId] });
      })
      .catch((err) => {
        console.error("Background spaces refresh failed:", err);
      })
      .finally(() => {
        refreshingRef.current = false;
      });
  }, [profileId, cacheQuery.isLoading, cacheQuery.data, qc]);

  // Fallback infinite query for "load more" pages (beyond the first page)
  const infiniteQuery = useInfiniteQuery({
    queryKey: ["gchat-spaces-more"],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const res = await chatApi("list_spaces", {
        pageSize: SPACES_PAGE_SIZE,
        pageToken: pageParam || undefined,
      });
      return {
        spaces: (res.spaces || []) as GChatSpace[],
        nextPageToken: res.nextPageToken as string | null,
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextPageToken,
    enabled: false, // Only triggered manually via fetchNextPage
    retry: false,
    staleTime: CACHE_TTL_MS,
  });

  // Merge: first page from cache, additional pages from infinite query
  const allSpaces = useMemo(() => {
    const firstPage = cacheQuery.data?.spaces ?? [];
    const morePages = infiniteQuery.data?.pages.flatMap((p) => p.spaces) ?? [];
    // Deduplicate by space name
    const seen = new Set(firstPage.map(s => s.name));
    const extra = morePages.filter(s => !seen.has(s.name));
    return [...firstPage, ...extra];
  }, [cacheQuery.data, infiniteQuery.data]);

  return {
    data: allSpaces,
    isLoading: cacheQuery.isLoading,
    error: cacheQuery.error,
    hasNextPage: infiniteQuery.hasNextPage ?? (cacheQuery.data?.spaces?.length === SPACES_PAGE_SIZE),
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    fetchNextPage: infiniteQuery.fetchNextPage,
  };
}

export function useGChatMessages(spaceId: string | null) {
  return useQuery({
    queryKey: ["gchat-messages", spaceId],
    enabled: !!spaceId,
    queryFn: async () => {
      const res = await chatApi("list_messages", { spaceId });
      return ((res.messages || []) as GChatMessage[]).reverse(); // chronological
    },
    refetchInterval: 15_000,
  });
}

export function useGChatMembers(spaceId: string | null) {
  return useQuery({
    queryKey: ["gchat-members", spaceId],
    enabled: !!spaceId,
    queryFn: async () => {
      const res = await chatApi("list_members", { spaceId });
      return res.memberships || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * DM names are now resolved server-side in the edge function.
 * This hook is kept for backward compatibility but simply returns an empty map.
 */
export function useGChatDmNames(_spaces: GChatSpace[]) {
  return useMemo(() => new Map<string, string>(), []);
}

export function useSendGChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ spaceId, text, threadKey }: { spaceId: string; text: string; threadKey?: string }) => {
      return chatApi("send_message", { spaceId, text, threadKey });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["gchat-messages", vars.spaceId] });
    },
  });
}

export function useSearchPeople() {
  return useMutation({
    mutationFn: async (query: string) => {
      return chatApi("search_people", { query });
    },
  });
}

export function useCreateDm() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const profileId = (profile as any)?.id as string | undefined;
  return useMutation({
    mutationFn: async (userEmail: string) => {
      return chatApi("create_dm", { userEmail });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gchat-spaces-cache", profileId] });
      qc.invalidateQueries({ queryKey: ["gchat-spaces-more"] });
    },
  });
}
