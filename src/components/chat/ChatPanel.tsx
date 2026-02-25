import { useState, useMemo } from "react";
import { useGChatSpaces, useGChatMessages, useSendGChatMessage, useGChatMembers, useGChatDmNames, useSearchPeople, useCreateDm, isSpaceDM, isSpaceRoom } from "@/hooks/useGoogleChat";
import { useHiddenSpaces } from "@/hooks/useHiddenSpaces";
import { usePinnedSpaces } from "@/hooks/usePinnedSpaces";
import { useChatNicknames } from "@/hooks/useChatNicknames";
import { useMergedBeaconMessages } from "@/hooks/useWidgetMessages";
import { SpacesList } from "./SpacesList";
import { ChatMessageList } from "./ChatMessageList";
import { ChatCompose } from "./ChatCompose";
import { cn } from "@/lib/utils";
import { Hash, ChevronLeft, MessageSquare, AlertCircle, LogOut, User, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  spaceId?: string;
  threadKey?: string;
  compact?: boolean;
  className?: string;
}

export function ChatPanel({ spaceId: fixedSpaceId, threadKey, compact, className }: Props) {
  const { data: company } = useCompanySettings();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const gchatEnabled = company?.settings?.gchat_enabled;

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(fixedSpaceId || null);
  const [showSidebar, setShowSidebar] = useState(!fixedSpaceId && !compact);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [beaconSending, setBeaconSending] = useState(false);

  const { data: spaces = [], isLoading: spacesLoading, error: spacesError, hasNextPage, isFetchingNextPage, fetchNextPage } = useGChatSpaces();
  const { data: messages = [], isLoading: msgsLoading } = useGChatMessages(selectedSpaceId);
  const sendMutation = useSendGChatMessage();
  const { hiddenIds, hide, unhide } = useHiddenSpaces();
  const { pinnedIds, pin, unpin } = usePinnedSpaces();
  const { nicknames, setNickname } = useChatNicknames();
  const searchPeople = useSearchPeople();
  const createDm = useCreateDm();

  const dmNames = useGChatDmNames(spaces);
  const { data: activeMembers = [] } = useGChatMembers(selectedSpaceId);

  const activeSpace = spaces.find((s) => s.name === selectedSpaceId);
  const isActiveSpaceDM = activeSpace ? isSpaceDM(activeSpace) : false;
  const isBeaconBotDm = isActiveSpaceDM && 
    (activeSpace?.displayName?.toLowerCase().includes("beacon") || false);

  // Merge widget messages when viewing Beacon bot DM
  const { data: mergedMessages } = useMergedBeaconMessages(messages, isBeaconBotDm);
  const activeDisplayName =
    (selectedSpaceId ? nicknames.get(selectedSpaceId) : null) ||
    activeSpace?.displayName ||
    (selectedSpaceId ? dmNames.get(selectedSpaceId) : null) ||
    selectedSpaceId;

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
            Sign out and sign back in to grant Google Chat access.
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

  const sendBeaconDirectMessage = async (text: string) => {
    const email = user?.email;
    if (!email) return;

    setBeaconSending(true);
    try {
      // Save user message to widget_messages
      await supabase.from("widget_messages" as any).insert({
        user_email: email,
        role: "user",
        content: text,
        metadata: {},
      });

      // Call Beacon's /api/chat endpoint
      const displayName = profile?.display_name || profile?.first_name || user?.user_metadata?.full_name || "User";
      const res = await fetch("https://beaconrag.up.railway.app/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          user_id: email,
          user_name: displayName,
          space_id: "ordino-chat",
        }),
      });

      const data = await res.json();

      // Save bot response to widget_messages
      if (data.response) {
        await supabase.from("widget_messages" as any).insert({
          user_email: email,
          role: "assistant",
          content: data.response,
          metadata: {
            confidence: data.confidence,
            sources: data.sources,
            flow_type: data.flow_type,
          },
        });
      }

      // Invalidate widget messages query to refresh the chat
      queryClient.invalidateQueries({ queryKey: ["widget-messages"] });
    } catch (err) {
      console.error("Beacon direct message error:", err);
    } finally {
      setBeaconSending(false);
    }
  };

  const handleSend = async (text: string) => {
    if (!selectedSpaceId) return;

    if (isBeaconBotDm) {
      await sendBeaconDirectMessage(text);
      return;
    }

    sendMutation.mutate({ spaceId: selectedSpaceId, text, threadKey });
  };

  const handleNewChat = async (email: string) => {
    try {
      const result = await createDm.mutateAsync(email);
      const spaceName = result?.space?.name || result?.name;
      if (spaceName) {
        setSelectedSpaceId(spaceName);
      }
      setNewChatOpen(false);
      setPeopleQuery("");
    } catch {
      // error handled by mutation
    }
  };

  const searchResults = searchPeople.data?.people || [];

  return (
    <div className={cn("flex h-full bg-background", className)}>
      {!fixedSpaceId && showSidebar && (
        <div className={cn("border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-white dark:bg-[hsl(220,18%,12%)]", compact ? "w-52" : "w-64")}>
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <h3 className="text-sm font-bold tracking-tight text-foreground">Chats</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SpacesList
              spaces={spaces}
              isLoading={spacesLoading}
              selectedSpaceId={selectedSpaceId}
              dmNames={dmNames}
              nicknames={nicknames}
              hiddenIds={hiddenIds}
              pinnedIds={pinnedIds}
              onHide={hide}
              onUnhide={unhide}
              onPin={pin}
              onUnpin={unpin}
              onRename={setNickname}
              onNewChat={() => setNewChatOpen(true)}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={() => fetchNextPage()}
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
            <ChatMessageList messages={mergedMessages} isLoading={msgsLoading} members={activeMembers} />
            <ChatCompose onSend={handleSend} isSending={isBeaconBotDm ? beaconSending : sendMutation.isPending} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a conversation to start chatting
          </div>
        )}
      </div>

      {/* New Chat Dialog */}
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={peopleQuery}
                onChange={(e) => {
                  setPeopleQuery(e.target.value);
                  if (e.target.value.length >= 2) {
                    searchPeople.mutate(e.target.value);
                  }
                }}
                placeholder="Search people in your organization..."
                className="w-full pl-10 pr-3 py-2 text-sm bg-muted/50 border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            </div>
            {searchPeople.isPending && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {searchResults.map((person: any, i: number) => {
                  const name = person.names?.[0]?.displayName || "Unknown";
                  const email = person.emailAddresses?.[0]?.value;
                  const photo = person.photos?.[0]?.url;
                  return (
                    <button
                      key={i}
                      onClick={() => email && handleNewChat(email)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left text-sm transition-colors"
                      disabled={createDm.isPending}
                    >
                      {photo ? (
                        <img src={photo} alt="" className="h-8 w-8 rounded-full" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{name}</p>
                        {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {peopleQuery.length >= 2 && !searchPeople.isPending && searchResults.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No people found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
