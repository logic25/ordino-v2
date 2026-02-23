import { useState, useMemo } from "react";
import { useGChatSpaces, useGChatMessages, useSendGChatMessage, useGChatMembers, isSpaceDM, isSpaceRoom } from "@/hooks/useGoogleChat";
import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SpacesList } from "./SpacesList";
import { ChatMessageList } from "./ChatMessageList";
import { ChatCompose } from "./ChatCompose";
import { cn } from "@/lib/utils";
import { Hash, ChevronLeft, MessageSquare, AlertCircle, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompanySettings } from "@/hooks/useCompanySettings";

interface Props {
  spaceId?: string;
  threadKey?: string;
  compact?: boolean;
  className?: string;
}

async function chatApi(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("google-chat-api", {
    body: { action, ...params },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function ChatPanel({ spaceId: fixedSpaceId, threadKey, compact, className }: Props) {
  const { data: company } = useCompanySettings();
  const gchatEnabled = company?.settings?.gchat_enabled;

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(fixedSpaceId || null);
  const [showSidebar, setShowSidebar] = useState(!fixedSpaceId && !compact);

  const { data: spaces = [], isLoading: spacesLoading, error: spacesError } = useGChatSpaces();
  const { data: messages = [], isLoading: msgsLoading } = useGChatMessages(selectedSpaceId);
  const sendMutation = useSendGChatMessage();

  // Fetch members for the currently selected space (used for sender name resolution)
  const { data: activeMembers = [] } = useGChatMembers(selectedSpaceId);

  // Build a map: userId (e.g. "users/123") → displayName from active space members
  const senderNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of activeMembers) {
      if (m.member?.type === "HUMAN" && m.member?.name && m.member?.displayName) {
        map[m.member.name] = m.member.displayName;
      }
    }
    return map;
  }, [activeMembers]);

  // Identify DM spaces that need member resolution for sidebar names
  const dmSpaces = useMemo(
    () => spaces.filter((s) => isSpaceDM(s)),
    [spaces]
  );

  // Fetch members for each DM space in parallel (for sidebar display names)
  const memberQueries = useQueries({
    queries: dmSpaces.map((space) => ({
      queryKey: ["gchat-members", space.name],
      queryFn: async () => {
        const res = await chatApi("list_members", { spaceId: space.name });
        return { spaceId: space.name, memberships: res.memberships || [] };
      },
      staleTime: 5 * 60 * 1000,
      enabled: true,
    })),
  });

  // Build a map: spaceId → display name for DMs
  const dmDisplayNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const q of memberQueries) {
      if (!q.data) continue;
      const { spaceId, memberships } = q.data;
      const humans = memberships.filter(
        (m: any) => m.member?.type === "HUMAN" && m.member?.displayName
      );
      if (humans.length === 1) {
        map[spaceId] = humans[0].member.displayName;
      } else if (humans.length > 1) {
        map[spaceId] = humans.map((h: any) => h.member.displayName).join(", ");
      }
    }
    return map;
  }, [memberQueries]);

  // Also build display names for spaces with empty displayName
  const spaceDisplayNames = useMemo(() => {
    const map: Record<string, string> = { ...dmDisplayNames };
    // For non-DM spaces, use displayName if available
    for (const s of spaces) {
      if (s.displayName && !map[s.name]) {
        map[s.name] = s.displayName;
      }
    }
    return map;
  }, [spaces, dmDisplayNames]);

  const activeSpace = spaces.find((s) => s.name === selectedSpaceId);
  const isActiveSpaceDM = activeSpace ? isSpaceDM(activeSpace) : false;
  const activeDisplayName = (selectedSpaceId && spaceDisplayNames[selectedSpaceId]) || activeSpace?.displayName || selectedSpaceId;

  if (!gchatEnabled) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center px-6 py-8">
          <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium mb-1">Google Chat not enabled</p>
          <p className="text-xs text-muted-foreground">
            Enable Google Chat integration in Settings → Company to use this feature.
          </p>
        </div>
      </div>
    );
  }

  const errorMessage = (spacesError as any)?.message || "";
  const isScopeMissing = errorMessage.includes("chat_scope_missing") || errorMessage.includes("chat_not_connected");

  if (isScopeMissing) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center px-6 py-8 max-w-sm">
          <LogOut className="h-10 w-10 mx-auto text-amber-500/70 mb-3" />
          <p className="text-sm font-medium mb-1">Chat permissions needed</p>
          <p className="text-xs text-muted-foreground mb-4">
            Sign out and sign back in to grant Google Chat access. Your conversations will then appear here.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Sign out & re-authenticate
          </Button>
        </div>
      </div>
    );
  }

  if (spacesError) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center px-6 py-8">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
          <p className="text-sm font-medium mb-1">Connection Error</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Could not connect to Google Chat. Please try again.
          </p>
        </div>
      </div>
    );
  }

  const handleSend = (text: string) => {
    if (!selectedSpaceId) return;
    sendMutation.mutate({ spaceId: selectedSpaceId, text, threadKey });
  };

  return (
    <div className={cn("flex h-full bg-background", className)}>
      {!fixedSpaceId && showSidebar && (
        <div className={cn("border-r flex flex-col shrink-0", compact ? "w-52" : "w-64")}>
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">Chats</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SpacesList
              spaces={spaces}
              isLoading={spacesLoading}
              selectedSpaceId={selectedSpaceId}
              dmDisplayNames={spaceDisplayNames}
              onSelect={(id) => {
                setSelectedSpaceId(id);
                if (compact) setShowSidebar(false);
              }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b flex items-center gap-2 px-4 shrink-0">
          {!fixedSpaceId && !showSidebar && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSidebar(true)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {isActiveSpaceDM ? (
            <User className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Hash className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium truncate">
            {activeDisplayName || "Select a conversation"}
          </span>
        </div>

        {selectedSpaceId ? (
          <>
            <ChatMessageList messages={messages} isLoading={msgsLoading} senderNameMap={senderNameMap} />
            <ChatCompose onSend={handleSend} isSending={sendMutation.isPending} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
