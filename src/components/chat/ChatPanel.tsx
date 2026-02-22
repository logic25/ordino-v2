import { useState } from "react";
import { useGChatSpaces, useGChatMessages, useSendGChatMessage } from "@/hooks/useGoogleChat";
import { SpacesList } from "./SpacesList";
import { ChatMessageList } from "./ChatMessageList";
import { ChatCompose } from "./ChatCompose";
import { cn } from "@/lib/utils";
import { Hash, ChevronLeft, MessageSquare, AlertCircle, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  /** If provided, locks to a specific space and hides the sidebar */
  spaceId?: string;
  /** Optional thread key to filter to */
  threadKey?: string;
  /** Compact mode for project tab / slide-out */
  compact?: boolean;
  className?: string;
}

export function ChatPanel({ spaceId: fixedSpaceId, threadKey, compact, className }: Props) {
  const { data: company } = useCompanySettings();
  const gchatEnabled = company?.settings?.gchat_enabled;

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(fixedSpaceId || null);
  const [showSidebar, setShowSidebar] = useState(!fixedSpaceId && !compact);

  const { data: spaces = [], isLoading: spacesLoading, error: spacesError } = useGChatSpaces();
  const { data: messages = [], isLoading: msgsLoading } = useGChatMessages(selectedSpaceId);
  const sendMutation = useSendGChatMessage();

  const activeSpace = spaces.find((s) => s.name === selectedSpaceId);

  // Determine the icon for the active space
  const isActiveSpaceDM = activeSpace?.type === "DIRECT_MESSAGE" || activeSpace?.singleUserBotDm;

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

  // Handle chat-specific errors (missing scopes, not connected)
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
      {/* Space sidebar */}
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
              onSelect={(id) => {
                setSelectedSpaceId(id);
                if (compact) setShowSidebar(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
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
            {activeSpace?.displayName || selectedSpaceId || "Select a conversation"}
          </span>
        </div>

        {selectedSpaceId ? (
          <>
            <ChatMessageList messages={messages} isLoading={msgsLoading} />
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
