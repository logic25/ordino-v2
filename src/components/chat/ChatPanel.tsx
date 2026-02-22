import { useState } from "react";
import { useGChatSpaces, useGChatMessages, useSendGChatMessage } from "@/hooks/useGoogleChat";
import { SpacesList } from "./SpacesList";
import { ChatMessageList } from "./ChatMessageList";
import { ChatCompose } from "./ChatCompose";
import { cn } from "@/lib/utils";
import { Hash, ChevronLeft, MessageSquare, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompanySettings } from "@/hooks/useCompanySettings";

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
  const configuredSpaceId = company?.settings?.gchat_space_id;

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(fixedSpaceId || null);
  const [showSidebar, setShowSidebar] = useState(!fixedSpaceId && !compact);

  const { data: spaces = [], isLoading: spacesLoading, error: spacesError } = useGChatSpaces();
  const { data: messages = [], isLoading: msgsLoading } = useGChatMessages(selectedSpaceId);
  const sendMutation = useSendGChatMessage();

  const activeSpace = spaces.find((s) => s.name === selectedSpaceId);

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

  if (spacesError) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center px-6 py-8">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
          <p className="text-sm font-medium mb-1">Connection Error</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Could not connect to Google Chat. Make sure the service account key is configured.
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
            <h3 className="text-sm font-semibold">Spaces</h3>
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
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate">
            {activeSpace?.displayName || selectedSpaceId || "Select a space"}
          </span>
        </div>

        {selectedSpaceId ? (
          <>
            <ChatMessageList messages={messages} isLoading={msgsLoading} />
            <ChatCompose onSend={handleSend} isSending={sendMutation.isPending} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a space to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
