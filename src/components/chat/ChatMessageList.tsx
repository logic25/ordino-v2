import { useRef, useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
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

function ConfidencePill({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 85 ? "bg-[hsl(142,71%,45%)]/15 text-[hsl(142,71%,35%)]" : pct >= 60 ? "bg-amber-500/15 text-amber-700" : "bg-destructive/15 text-destructive";
  return (
    <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full", color)}>
      {pct}% confident
    </span>
  );
}

function WidgetSources({ sources }: { sources: Array<{ title: string; score: number; chunk_preview?: string }> }) {
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;
  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {sources.length} source{sources.length !== 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-1 space-y-1 pl-4">
          {sources.map((s, i) => {
            const pct = Math.round(s.score * 100);
            const barColor = pct >= 85 ? "bg-[hsl(142,71%,45%)]" : pct >= 60 ? "bg-amber-500" : "bg-destructive";
            return (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className="truncate max-w-[200px] text-foreground">{s.title}</span>
                <div className="flex items-center gap-1">
                  <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Props {
  messages: (GChatMessage & { source?: string; widgetMetadata?: any })[];
  isLoading: boolean;
  members?: Array<{ member?: { name?: string; displayName?: string; type?: string } }>;
}

export function ChatMessageList({ messages, isLoading, members = [] }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastMsgKey = messages.length > 0
    ? `${messages[messages.length - 1]?.name}-${messages[messages.length - 1]?.createTime}`
    : "";

  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [lastMsgKey]);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.member?.name, m.member?.displayName])),
    [members]
  );

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

  let lastDate = "";

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {messages.map((msg, idx) => {
        const msgDate = formatDate(msg.createTime);
        const showDate = msgDate !== lastDate;
        lastDate = msgDate;
        const isBot = msg.sender?.type === "BOT";
        const isWidget = (msg as any).source === "widget";
        const displayName =
          msg.sender?.displayName ||
          memberMap.get(msg.sender?.name) ||
          "Unknown";
        const hasCard = msg.cardsV2?.length || msg.cards?.length;
        const widgetMeta = (msg as any).widgetMetadata;
        const confidence = widgetMeta?.confidence;

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
                <AvatarFallback className={cn("text-[10px]", isWidget && isBot && "bg-[#f59e0b]/15")}>
                  {isWidget && isBot ? <Brain className="h-3.5 w-3.5 text-[#f59e0b]" /> : isBot ? "🤖" : getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold">{displayName}</span>
                  {isBot && !isWidget && <Badge variant="outline" className="text-[9px] px-1 py-0">Bot</Badge>}
                  {isWidget && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-[#f59e0b]/30 text-[#f59e0b] bg-[#f59e0b]/5">
                      Widget
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">{formatTime(msg.createTime)}</span>
                  {isWidget && isBot && confidence != null && confidence > 0 && (
                    <ConfidencePill confidence={confidence} />
                  )}
                </div>
                {msg.text && (
                  <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{msg.text}</p>
                )}
                {isWidget && isBot && widgetMeta?.sources?.length > 0 && (
                  <WidgetSources sources={widgetMeta.sources} />
                )}
                {hasCard && (
                  <div className="mt-1 border rounded-lg p-2 bg-muted/30 text-xs text-muted-foreground">
                    📋 Task Card
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
