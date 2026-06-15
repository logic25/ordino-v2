import { useRef, useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, ChevronDown, ChevronRight, CornerDownRight, MessageSquareReply } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
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
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  if (!sources?.length) return null;

  const toggleSource = (i: number) => {
    setExpandedIndices(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

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
        <div className="mt-1 space-y-0.5 pl-4">
          {sources.map((s, i) => {
            const pct = Math.round(s.score * 100);
            const barColor = pct >= 85 ? "bg-[hsl(142,71%,45%)]" : pct >= 60 ? "bg-amber-500" : "bg-destructive";
            const isExpanded = expandedIndices.has(i);
            return (
              <div key={i}>
                <button
                  onClick={() => s.chunk_preview && toggleSource(i)}
                  className={cn(
                    "flex items-center gap-2 text-[10px] w-full text-left",
                    s.chunk_preview && "cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
                  )}
                >
                  {s.chunk_preview ? (
                    isExpanded ? <ChevronDown className="h-2.5 w-2.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <span className="w-2.5 shrink-0" />
                  )}
                  <span className="truncate max-w-[200px] text-foreground">{s.title}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                </button>
                {isExpanded && s.chunk_preview && (
                  <div className="ml-4 mt-0.5 mb-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1.5 leading-relaxed border border-border/50">
                    {s.chunk_preview}
                  </div>
                )}
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
  isWaitingForBeacon?: boolean;
  /** When provided, hovered messages get a "Reply in thread" affordance. */
  onReplyInThread?: (args: { threadKey: string; preview: string; senderName?: string }) => void;
  /** Currently active reply target (so we can highlight the parent thread). */
  activeReplyThreadKey?: string | null;
}

// Pull a usable threadKey from a message: prefer the explicit threadKey
// the bot sent with, fall back to the thread resource name's last segment
// (Google Chat's threads/<id>) so user-initiated threads also work.
function getThreadKey(msg: GChatMessage): string | null {
  const tk = msg.thread?.threadKey;
  if (tk) return tk;
  const tname = msg.thread?.name;
  if (tname && tname.includes("/threads/")) return tname.split("/threads/")[1] || null;
  return null;
}

export function ChatMessageList({ messages, isLoading, members = [], isWaitingForBeacon, onReplyInThread, activeReplyThreadKey }: Props) {
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

  // Count how many messages share each thread so we can show "3 in thread" affordances.
  const threadCounts = useMemo(() => {
    const m = new Map<string, number>();
    messages.forEach((msg) => {
      const tk = getThreadKey(msg);
      if (tk) m.set(tk, (m.get(tk) || 0) + 1);
    });
    return m;
  }, [messages]);

  // Track which message is the "thread root" (first occurrence per threadKey,
  // chronological). Subsequent messages with the same threadKey render indented.
  const threadRoots = useMemo(() => {
    const seen = new Set<string>();
    const roots = new Set<string>(); // message.name values
    messages.forEach((msg) => {
      const tk = getThreadKey(msg);
      if (!tk) return;
      if (!seen.has(tk)) {
        seen.add(tk);
        if (msg.name) roots.add(msg.name);
      }
    });
    return roots;
  }, [messages]);

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
        const threadKey = getThreadKey(msg);
        const isThreadRoot = msg.name ? threadRoots.has(msg.name) : false;
        const isThreadReply = !!threadKey && !isThreadRoot;
        const threadCount = threadKey ? threadCounts.get(threadKey) || 0 : 0;
        const isActiveThread = !!threadKey && threadKey === activeReplyThreadKey;
        const previewText = (msg.text || "").slice(0, 120).replace(/\s+/g, " ").trim();

        return (
          <div key={msg.name || idx}>
            {showDate && (
              <div className="flex justify-center my-3">
                <Badge variant="secondary" className="text-[10px] font-normal px-2">{msgDate}</Badge>
              </div>
            )}
            <div
              className={cn(
                "flex items-start gap-2.5 py-1.5 group relative rounded-md transition-colors",
                isThreadReply && "ml-7 pl-3 border-l-2 border-amber-500/30",
                isActiveThread && "bg-amber-500/5",
              )}
            >
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
                  {isThreadReply && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
                      <CornerDownRight className="h-2.5 w-2.5" /> in thread
                    </span>
                  )}
                  {isThreadRoot && threadCount > 1 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/30 text-amber-600 bg-amber-500/5">
                      {threadCount} in thread
                    </Badge>
                  )}
                  {isWidget && isBot && confidence != null && confidence > 0 && (
                    <ConfidencePill confidence={confidence} />
                  )}
                </div>
                {msg.text && isWidget && isBot ? (
                  <div className="prose prose-sm max-w-none mt-0.5 text-sm leading-relaxed [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-2 [&_p]:last:mb-0 [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:font-semibold [&_hr]:my-2 [&_hr]:border-border">
                    <ReactMarkdown>{msg.text.replace(/\n\n📚[\s\S]*$/, '').replace(/\n\nSources:[\s\S]*$/, '')}</ReactMarkdown>
                  </div>
                ) : msg.text ? (
                  <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{msg.text}</p>
                ) : null}
                {isWidget && isBot && widgetMeta?.sources?.length > 0 && (
                  <WidgetSources sources={widgetMeta.sources} />
                )}
                {hasCard && (
                  <div className="mt-1 border rounded-lg p-2 bg-muted/30 text-xs text-muted-foreground">
                    📋 Task Card
                  </div>
                )}
              </div>
              {onReplyInThread && threadKey && !isWidget && (
                <button
                  onClick={() => onReplyInThread({ threadKey, preview: previewText || "(no text)", senderName: displayName })}
                  className={cn(
                    "absolute top-1 right-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-background border shadow-sm transition-opacity",
                    isActiveThread
                      ? "opacity-100 border-amber-500/50 text-amber-700"
                      : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground",
                  )}
                  title="Reply in thread"
                >
                  <MessageSquareReply className="h-3 w-3" />
                  Reply in thread
                </button>
              )}
            </div>
          </div>
        );
      })}
      {isWaitingForBeacon && (
        <div className="flex items-start gap-2.5 py-1.5">
          <div className="h-7 w-7 mt-0.5 shrink-0 rounded-full bg-[#f59e0b]/15 flex items-center justify-center">
            <Brain className="h-3.5 w-3.5 text-[#f59e0b] animate-pulse" />
          </div>
          <div className="flex items-center gap-1 pt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
