import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemo } from "react";
import type { GChatMessage } from "@/hooks/useGoogleChat";

interface WidgetMessageRow {
  role: string;
  content: string;
  metadata: any;
  created_at: string;
}

/**
 * Fetches widget_messages for the current user and converts them
 * into GChatMessage-compatible objects with `source: 'widget'`.
 * Only enabled when `enabled` is true (i.e. Beacon bot DM is selected).
 */
export function useWidgetMessages(enabled: boolean) {
  const { user, profile } = useAuth();
  const email = user?.email;
  const displayName = profile?.display_name || profile?.first_name || "You";

  const query = useQuery({
    queryKey: ["widget-messages", email],
    enabled: !!email && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("widget_messages" as any)
        .select("role, content, metadata, created_at")
        .eq("user_email", email!)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as WidgetMessageRow[];
    },
    staleTime: 30_000,
  });

  const messages: GChatMessage[] = useMemo(() => {
    if (!query.data) return [];
    return query.data.map((row, i) => {
      const isUser = row.role === "user";
      return {
        name: `widget-msg-${i}-${row.created_at}`,
        sender: {
          name: isUser ? "user" : "beacon-bot",
          displayName: isUser ? displayName : "Beacon",
          type: isUser ? "HUMAN" : "BOT",
        },
        createTime: row.created_at,
        text: row.content,
        source: "widget" as const,
        widgetMetadata: !isUser ? row.metadata : undefined,
      } as GChatMessage & { source: string; widgetMetadata?: any };
    });
  }, [query.data, displayName]);

  return {
    data: messages,
    isLoading: query.isLoading,
  };
}

/**
 * Merges Google Chat messages with widget messages, sorted by createTime.
 */
export function useMergedBeaconMessages(
  gchatMessages: GChatMessage[],
  isBeaconDm: boolean
) {
  const { data: widgetMessages, isLoading: widgetLoading } = useWidgetMessages(isBeaconDm);

  const merged = useMemo(() => {
    if (!isBeaconDm || widgetMessages.length === 0) return gchatMessages;
    const all = [...gchatMessages, ...widgetMessages];
    all.sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime());
    return all;
  }, [gchatMessages, widgetMessages, isBeaconDm]);

  return { data: merged, isWidgetLoading: widgetLoading };
}
