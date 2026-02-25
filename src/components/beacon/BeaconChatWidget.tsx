import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Brain, FileText, Zap, X, ChevronDown, ChevronUp, ExternalLink, MessageSquarePlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { useAuth } from "@/hooks/useAuth";
import { askBeacon, checkBeaconHealth, type BeaconSource } from "@/services/beaconApi";
import { supabase } from "@/integrations/supabase/client";
import { useRef, useEffect, useCallback } from "react";

const quickQuestions = [
  "Alt-1 vs Alt-2?",
  "How to file NB?",
  "Look up address",
  "Energy code?",
];

interface ChatMessage {
  role: "user" | "beacon";
  text: string;
  confidence?: number;
  sources?: BeaconSource[];
  responseTime?: number;
  flowType?: string;
  isHistory?: boolean;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 85 ? "bg-[hsl(142,71%,45%)]" : pct >= 60 ? "bg-yellow-500" : "bg-destructive";
  const label = pct >= 85 ? "high" : pct >= 60 ? "medium" : "low";
  return (
    <Badge className={cn("text-[9px] text-white px-1.5 py-0", color)}>
      {label} ({pct}%)
    </Badge>
  );
}

function formatSourceTitle(raw: string): string {
  return raw
    .replace(/\.md$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function RelevanceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "bg-[hsl(142,71%,45%)]" : pct >= 60 ? "bg-[#f59e0b]" : "bg-destructive";
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">{pct}%</span>
    </div>
  );
}

function SourcesList({ sources }: { sources: BeaconSource[] }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());
  const navigate = useNavigate();
  if (!sources.length) return null;

  const toggleSource = (idx: number) => {
    setExpandedIdx((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <FileText className="h-2.5 w-2.5" />
        {sources.length} source{sources.length !== 1 ? "s" : ""}
        {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1">
          {sources.map((s, i) => {
            const isOpen = expandedIdx.has(i);
            const title = formatSourceTitle(s.title);
            return (
              <div key={i} className="bg-muted/50 rounded p-1.5 text-[10px]">
                <button
                  onClick={() => toggleSource(i)}
                  className="w-full flex items-center justify-between gap-1"
                >
                  <span className="font-medium truncate text-left">{title}</span>
                  <RelevanceBar score={s.score} />
                </button>
                {isOpen && (
                  <div className="mt-1 space-y-1">
                    {s.chunk_preview && (
                      <div className="max-h-[120px] overflow-y-auto bg-background rounded p-1.5 text-muted-foreground">
                        {s.chunk_preview}
                      </div>
                    )}
                    <button
                      onClick={() => navigate(`/documents?search=${encodeURIComponent(title)}`)}
                      className="flex items-center gap-0.5 text-[#f59e0b] hover:underline"
                    >
                      <ExternalLink className="h-2.5 w-2.5" /> View Document
                    </button>
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

export function BeaconChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAdmin = useIsAdmin();
  const { user, profile } = useAuth();
  const [showDebug, setShowDebug] = useState(false);
  const [beaconOnline, setBeaconOnline] = useState(true);

  useEffect(() => {
    const check = () => checkBeaconHealth().then(setBeaconOnline);
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load history when widget opens
  useEffect(() => {
    if (!open || historyLoaded || !user?.email) return;

    (async () => {
      try {
        const { data } = await supabase
          .from("widget_messages" as any)
          .select("role, content, metadata, created_at")
          .eq("user_email", user.email!)
          .order("created_at", { ascending: true })
          .limit(20);

        if (data && data.length > 0) {
          const history: ChatMessage[] = (data as any[]).map((row) => ({
            role: row.role === "user" ? "user" : "beacon",
            text: row.content,
            confidence: row.metadata?.confidence,
            sources: row.metadata?.sources || [],
            flowType: row.metadata?.flow_type,
            isHistory: true,
          }));
          setMessages(history);
          setHistoryCount(history.length);
        }
      } catch (err) {
        console.error("Failed to load Beacon history:", err);
      } finally {
        setHistoryLoaded(true);
      }
    })();
  }, [open, historyLoaded, user?.email]);

  // Scroll to bottom on history load or new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  }, [messages]);

  const userId = user?.email || user?.id || "anonymous";
  const userName = profile?.display_name || profile?.first_name || user?.user_metadata?.full_name || "User";

  const handleSend = async (text?: string) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setLoading(true);

    try {
      // Save user message to widget_messages
      const userEmail = user?.email;
      if (userEmail) {
        await supabase.from("widget_messages" as any).insert({
          user_email: userEmail,
          role: "user",
          content: q,
          metadata: {},
        });
      }

      const res = await askBeacon(q, userId, userName);
      setMessages((prev) => [
        ...prev,
        {
          role: "beacon",
          text: res.response,
          confidence: res.confidence,
          sources: res.sources || [],
          responseTime: res.response_time_ms,
          flowType: res.flow_type,
        },
      ]);

      // Save bot response to widget_messages
      if (userEmail && res.response) {
        await supabase.from("widget_messages" as any).insert({
          user_email: userEmail,
          role: "assistant",
          content: res.response,
          metadata: {
            confidence: res.confidence,
            sources: res.sources,
            flow_type: res.flow_type,
          },
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "beacon",
          text: "Beacon is temporarily unavailable. Please try again.",
          confidence: 0,
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setHistoryCount(0);
  };

  const lastBeaconMsg = messages.filter((m) => m.role === "beacon").at(-1);

  if (!open) {
    return createPortal(
      <button
        onClick={() => setOpen(true)}
        className={`w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 ${beaconOnline ? "bg-[#f59e0b] hover:bg-[#d97706]" : "bg-gray-400 hover:bg-gray-500"}`}
        style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}
        title={beaconOnline ? "Ask Beacon" : "Beacon is offline"}
      >
        <Brain className="h-6 w-6" style={loading ? { animation: 'beacon-pulse 1.2s ease-in-out infinite' } : undefined} />
        {!beaconOnline && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-destructive rounded-full border-2 border-background" />
        )}
      </button>,
      document.body
    );
  }

  return createPortal(
    <div className="w-[420px] h-[560px] flex flex-col bg-background border rounded-xl shadow-2xl overflow-hidden" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b text-white",
        beaconOnline ? "bg-[#f59e0b]" : "bg-gray-400"
      )}>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          <span className="font-semibold text-sm">Beacon{!beaconOnline && " · Offline"}</span>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
              onClick={() => setShowDebug(!showDebug)}
              title="Toggle RAG debug"
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
          )}
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
              onClick={handleNewChat}
              title="New conversation"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && historyLoaded && (
          <div className="text-center py-4">
            <Brain className="h-8 w-8 mx-auto text-[#f59e0b]/40 mb-2" />
            <p className="text-xs text-muted-foreground mb-3">Ask Beacon anything about NYC construction & expediting</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full border hover:bg-muted transition-colors"
                >
                  <Zap className="h-3 w-3 inline mr-0.5" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          // Show divider between history and new messages
          const showDivider = historyCount > 0 && i === historyCount;

          return (
            <div key={i}>
              {showDivider && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground font-medium px-2">New messages</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <div className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "")}>
                {msg.role === "beacon" && (
                  <div className="w-6 h-6 rounded-full bg-[#f59e0b] flex items-center justify-center shrink-0 mt-1">
                    <Brain className="h-3 w-3 text-white" />
                  </div>
                )}
                <div className={cn("max-w-[85%]", msg.role === "user" ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2" : "")}>
                  {msg.role === "beacon" ? (
                    <div className="space-y-1.5">
                      <div className="prose prose-sm max-w-none text-[13px] leading-relaxed [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:font-semibold">
                        <ReactMarkdown>{msg.text.replace(/\n\n📚[\s\S]*$/, '').replace(/\n\nSources:[\s\S]*$/, '')}</ReactMarkdown>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {msg.confidence != null && msg.confidence > 0 && (
                          <ConfidenceBadge confidence={msg.confidence} />
                        )}
                        {msg.responseTime != null && (
                          <span className="text-[9px] text-muted-foreground">
                            {(msg.responseTime / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                      {msg.sources && <SourcesList sources={msg.sources} />}
                    </div>
                  ) : (
                    <p className="text-sm">{msg.text}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-[#f59e0b] flex items-center justify-center shrink-0">
              <Brain className="h-3 w-3 text-white" style={{ animation: 'beacon-pulse 1.2s ease-in-out infinite' }} />
            </div>
            <span className="text-xs text-muted-foreground mt-1.5">Beacon is thinking<span className="animate-pulse">...</span></span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Debug panel */}
      {showDebug && lastBeaconMsg && (
        <div className="border-t bg-muted/30 px-3 py-2 max-h-32 overflow-y-auto">
          <p className="text-[10px] font-semibold mb-1">RAG Debug</p>
          <div className="space-y-1 text-[10px]">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Confidence:</span>
              {lastBeaconMsg.confidence != null && lastBeaconMsg.confidence > 0 && (
                <ConfidenceBadge confidence={lastBeaconMsg.confidence} />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Flow:</span>
              <span>{lastBeaconMsg.flowType || "unknown"}</span>
            </div>
            {lastBeaconMsg.sources?.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="truncate flex items-center gap-1"><FileText className="h-2.5 w-2.5" />{formatSourceTitle(s.title)}</span>
                <RelevanceBar score={s.score} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-3">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Beacon..."
            className="flex-1 h-9 text-sm"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={!input.trim() || loading}
            size="icon"
            className="h-9 w-9 bg-[#f59e0b] hover:bg-[#d97706] text-white shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>,
    document.body
  );
}
