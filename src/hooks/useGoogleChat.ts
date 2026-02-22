import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GChatSpace {
  name: string;
  displayName: string;
  type: string;
  spaceThreadingState?: string;
  singleUserBotDm?: boolean;
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
  if (error) throw error;
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
