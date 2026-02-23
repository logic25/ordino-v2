import { useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { GChatMessage } from "@/hooks/useGoogleChat";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  messages: GChatMessage[];
  isLoading: boolean;
  /** Map of user resource name (e.g. "users/123") → display name */
  senderNameMap?: Record<string, string>;
}

export function ChatMessageList({ messages, isLoading, senderNameMap = {} }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        No messages yet
      </div>
    );
  }

  // Group messages by date
  let lastDate = "";

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {messages.map((msg, idx) => {
        const msgDate = formatDate(msg.createTime);
        const showDate = msgDate !== lastDate;
        lastDate = msgDate;
        const isBot = msg.sender?.type === "BOT";
        // Resolve display name: try sender.displayName first, then look up from members map
        const displayName =
          msg.sender?.displayName ||
          (msg.sender?.name && senderNameMap[msg.sender.name]) ||
          "Unknown";
        const hasCard = msg.cardsV2?.length || msg.cards?.length;

        return (
          <div key={msg.name || idx}>
            {showDate && (
              <div className="flex justify-center my-3">
                <Badge variant="secondary" className="text-[10px] font-normal px-2">{msgDate}</Badge>
              </div>
            )}
            <div className="flex items-start gap-2.5 py-1.5 group">
              <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                {msg.sender?.avatarUrl && <AvatarImage src={msg.sender.avatarUrl} />}
                <AvatarFallback className="text-[10px]">{isBot ? "🤖" : getInitials(displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{displayName}</span>
                  {isBot && <Badge variant="outline" className="text-[9px] px-1 py-0">Bot</Badge>}
                  <span className="text-[10px] text-muted-foreground">{formatTime(msg.createTime)}</span>
                </div>
                {msg.text && (
                  <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{msg.text}</p>
                )}
                {hasCard && (
                  <div className="mt-1 border rounded-lg p-2 bg-muted/30 text-xs text-muted-foreground">
                    📋 Action Item Card
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
