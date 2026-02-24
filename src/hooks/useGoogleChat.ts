import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    // Try to extract the actual error body from FunctionsHttpError
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

export function useGChatSpaces() {
  return useQuery({
    queryKey: ["gchat-spaces"],
    queryFn: async () => {
      const res = await chatApi("list_spaces");
      return (res.spaces || []) as GChatSpace[];
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
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
 * Resolves display names for DM and GROUP_CHAT spaces by fetching members.
 * Returns a Map<spaceId, displayName>.
 */
/**
 * DM names are now resolved server-side in the list_spaces edge function.
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
  return useMutation({
    mutationFn: async (userEmail: string) => {
      return chatApi("create_dm", { userEmail });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gchat-spaces"] });
    },
  });
}
