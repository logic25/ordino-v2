import { useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Brain, FileText, Zap, X, ChevronDown, ChevronUp, ExternalLink, MessageSquarePlus, Bug, History, Trash2, Settings as SettingsIcon } from "lucide-react";
import { useIsAdmin } from "@/hooks/useUserRoles";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { askBeacon, checkBeaconHealth, type BeaconSource, type BeaconProjectContext } from "@/services/beaconApi";
import { captureSnapshot, looksLikeBug, type BeaconSnapshot } from "@/lib/beaconCapture";
import { lazy, Suspense } from "react";
const BeaconDocumentModal = lazy(() => import("../documents/BeaconDocumentModal").then(m => ({ default: m.BeaconDocumentModal })));
import { supabase } from "@/integrations/supabase/client";
import { useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";

const quickQuestions = [
  "Alt-1 vs Alt-2?",
  "How to file NB?",
  "Look up address",
  "Energy code?",
];

const PAGE_NAME_MAP: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/projects": "Projects",
  "/properties": "Properties",
  "/proposals": "Proposals",
  "/invoices": "Invoices",
  "/emails": "Email",
  "/calendar": "Calendar",
  "/documents": "Documents",
  "/clients": "Clients",
  "/rfps": "RFPs",
  "/rfp-library": "RFP Library",
  "/rfp-discovery": "RFP Discovery",
  "/reports": "Reports",
  "/settings": "Settings",
  "/help": "Help Center",
  "/time": "Time Tracking",
  "/chat": "Chat",
};

function getPageName(pathname: string): string {
  if (PAGE_NAME_MAP[pathname]) return PAGE_NAME_MAP[pathname];
  for (const [prefix, name] of Object.entries(PAGE_NAME_MAP)) {
    if (prefix !== "/" && pathname.startsWith(prefix)) return name;
  }
  return "Unknown";
}

interface ChatMessage {
  role: "user" | "beacon";
  text: string;
  confidence?: number;
  sources?: BeaconSource[];
  responseTime?: number;
  flowType?: string;
  isHistory?: boolean;
  isBugReport?: boolean;
  bugLogged?: boolean;
  timestamp?: string;
}

interface SessionPreview {
  session_id: string;
  first_message: string;
  created_at: string;
  message_count: number;
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

function SourcesList({ sources, onViewDocument }: { sources: BeaconSource[]; onViewDocument: (title: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());
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
                      onClick={() => onViewDocument(s.title)}
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

function BeaconChatHistory({ 
  sessions, 
  loading, 
  onSelect, 
  onBack,
  onDelete,
  onClearAll,
}: { 
  sessions: SessionPreview[]; 
  loading: boolean; 
  onSelect: (sessionId: string) => void; 
  onBack: () => void;
  onDelete: (sessionId: string) => void;
  onClearAll: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Brain className="h-5 w-5 text-[#f59e0b]/40 animate-pulse" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <History className="h-6 w-6 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground">No previous chats</p>
        <button onClick={onBack} className="text-xs text-[#f59e0b] hover:underline mt-2">
          Back to chat
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-[#f59e0b] hover:underline">
          ← Back to chat
        </button>
        {confirmClearAll ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-destructive">Delete all?</span>
            <button
              onClick={() => { onClearAll(); setConfirmClearAll(false); }}
              className="text-[10px] text-destructive font-medium hover:underline"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmClearAll(false)}
              className="text-[10px] text-muted-foreground hover:underline"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClearAll(true)}
            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear All
          </button>
        )}
      </div>
      <div className="divide-y">
        {sessions.map((s) => {
          const date = new Date(s.created_at);
          const today = new Date();
          const isToday = date.toDateString() === today.toDateString();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const isYesterday = date.toDateString() === yesterday.toDateString();
          const dateStr = isToday ? "Today" : isYesterday ? "Yesterday" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          const isConfirming = confirmId === s.session_id;

          return (
            <div
              key={s.session_id}
              className="group w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors flex items-center gap-2"
            >
              <button
                onClick={() => onSelect(s.session_id)}
                className="flex-1 text-left min-w-0"
              >
                <p className="text-xs font-medium truncate">{s.first_message}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{dateStr} {timeStr}</span>
                  <span className="text-[10px] text-muted-foreground">· {s.message_count} messages</span>
                </div>
              </button>
              {isConfirming ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(s.session_id); setConfirmId(null); }}
                  className="text-[10px] text-destructive font-medium hover:underline shrink-0"
                >
                  Delete?
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmId(s.session_id); }}
                  className="opacity-70 hover:opacity-100 transition-opacity shrink-0 p-1 hover:bg-destructive/10 rounded"
                  title="Delete chat"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface BeaconChatWidgetProps {
  projectContext?: BeaconProjectContext;
}

export function BeaconChatWidget({ projectContext: externalContext }: BeaconChatWidgetProps = {}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const processingRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  const [contextCleared, setContextCleared] = useState(false);

  // Session management
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [showHistory, setShowHistory] = useState(false);
  const [historySessions, setHistorySessions] = useState<SessionPreview[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Allow user to clear project context; reset when context changes
  const activeContext = contextCleared ? undefined : externalContext;
  useEffect(() => { setContextCleared(false); }, [externalContext?.projectId]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const lastBotRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const { user, profile } = useAuth();
  const [beaconOnline, setBeaconOnline] = useState(true);
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const currentPage = getPageName(location.pathname);

  // Capture last 3 console errors for bug context
  const recentErrorsRef = useRef<string[]>([]);
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const msg = `${event.message} at ${event.filename}:${event.lineno}`;
      recentErrorsRef.current = [...recentErrorsRef.current.slice(-2), msg];
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = `Unhandled rejection: ${event.reason?.message || event.reason}`;
      recentErrorsRef.current = [...recentErrorsRef.current.slice(-2), msg];
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  useEffect(() => {
    const check = () => checkBeaconHealth().then(setBeaconOnline);
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  // Always open as a fresh new chat. Past chats are available via the History button.
  useEffect(() => {
    if (!open || historyLoaded) return;
    setHistoryLoaded(true);
  }, [open, historyLoaded]);


  // Scroll to the top of the latest bot response, or bottom for user messages
  useEffect(() => {
    if (messages.length === 0) return;
    const newCount = messages.length;
    const lastMsg = messages[newCount - 1];
    if (newCount > prevCountRef.current && lastMsg?.role === "beacon" && lastBotRef.current) {
      setTimeout(() => {
        lastBotRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } else if (newCount > prevCountRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
    prevCountRef.current = newCount;
  }, [messages]);

  const userId = user?.email || user?.id || "anonymous";
  const userName = profile?.display_name || profile?.first_name || user?.user_metadata?.full_name || "User";

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;
    setLoading(true);

    while (queueRef.current.length > 0) {
      const q = queueRef.current.shift()!;

      // Add user message
      setMessages((prev) => [...prev, { role: "user", text: q, timestamp: new Date().toISOString() }]);

      try {
        // Save user message to widget_messages with session_id
        const userEmail = user?.email;
        if (userEmail) {
          await supabase.from("widget_messages" as any).insert({
            user_email: userEmail,
            role: "user",
            content: q,
            metadata: {},
            session_id: sessionId,
            company_id: profile?.company_id || null,
          });
        }

        // ---- Project status intercept ----
        // Detects status-style questions and routes to our internal summarize-project
        // function. Resolves the project from either active context OR a project
        // number / name mentioned inline in the question.
        const statusRegex = /\b(status|what(?:'?s| is)? (?:going on|happening|the status|up)|where (?:are we|do we stand)|update|summary|summarize|recap|catch me up|going on with)\b/i;
        // When a project is in active context, prefer beacon-qa (tool-calling over
        // live tables) over the generic summarize-project blurb. Only use the
        // status intercept when no project is active and the user is asking about
        // one by number/name inline.
        if (statusRegex.test(q) && !activeContext?.projectId) {
          let resolvedProjectId: string | null = activeContext?.projectId || null;
          let resolvedLabel: string | null = null;

          if (!resolvedProjectId && profile?.company_id) {
            // Try project number like 0737-2026
            const numMatch = q.match(/\b(\d{2,4}-\d{2,4})\b/);
            if (numMatch) {
              const { data: pj } = await supabase
                .from("projects")
                .select("id, project_number, name")
                .eq("company_id", profile.company_id)
                .eq("project_number", numMatch[1])
                .maybeSingle();
              if (pj) {
                resolvedProjectId = pj.id;
                resolvedLabel = `${pj.project_number} — ${pj.name}`;
              }
            }

            // Fuzzy name match
            if (!resolvedProjectId) {
              const nameMatch = q.match(/(?:project|with|for|on)\s+(?:the\s+)?([A-Za-z0-9][A-Za-z0-9 &'\-\.]{2,60})/i);
              const term = nameMatch?.[1]?.trim().replace(/[?.!,]+$/, "");
              if (term && term.length >= 3) {
                const { data: pjs } = await supabase
                  .from("projects")
                  .select("id, project_number, name")
                  .eq("company_id", profile.company_id)
                  .ilike("name", `%${term}%`)
                  .limit(3);
                if (pjs && pjs.length === 1) {
                  resolvedProjectId = pjs[0].id;
                  resolvedLabel = `${pjs[0].project_number} — ${pjs[0].name}`;
                } else if (pjs && pjs.length > 1) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "beacon",
                      text: `I found multiple projects matching "${term}":\n\n${pjs.map(p => `• ${p.project_number} — ${p.name}`).join("\n")}\n\nWhich one? (paste the project number)`,
                      confidence: 1,
                      sources: [],
                      timestamp: new Date().toISOString(),
                    },
                  ]);
                  continue;
                }
              }
            }
          }

          if (resolvedProjectId) {
            try {
              const { data, error } = await supabase.functions.invoke("summarize-project", {
                body: { projectId: resolvedProjectId, persist: true, source: "ai_on_demand" },
              });
              if (error) throw error;
              const summary: string = data?.summary || "No summary returned.";
              const header = resolvedLabel ? `**${resolvedLabel}**\n\n` : "";
              setMessages((prev) => [
                ...prev,
                {
                  role: "beacon",
                  text: header + summary + "\n\n_Saved to project notes._",
                  confidence: 1,
                  sources: [],
                  flowType: "project_summary",
                  timestamp: new Date().toISOString(),
                },
              ]);
              if (userEmail) {
                await supabase.from("widget_messages" as any).insert({
                  user_email: userEmail,
                  role: "assistant",
                  content: summary,
                  metadata: { flow_type: "project_summary", project_id: resolvedProjectId },
                  session_id: sessionId,
                  company_id: profile?.company_id || null,
                });
              }
              continue;
            } catch (e: any) {
              console.error("summarize-project failed:", e);
              setMessages((prev) => [
                ...prev,
                {
                  role: "beacon",
                  text: `Couldn't pull that project's status: ${e?.message || "unknown error"}`,
                  confidence: 0,
                  sources: [],
                  timestamp: new Date().toISOString(),
                },
              ]);
              continue;
            }
          }
        }

        // NOTE: project Q&A intercept removed — all questions now route to
        // /api/chat (Railway Beacon) for one unified brain. beacon-qa function
        // remains deployed but is no longer referenced from the widget.





        // Prepend project context as system context when active
        let enrichedQuery = q;
        // Always prepend current page so Beacon knows where the user is
        if (currentPage && !activeContext?.projectAddress) {
          enrichedQuery = `[Page: ${currentPage}]\n${q}`;
        }
        if (activeContext?.projectAddress) {
          const ctxParts = [`Project: ${activeContext.projectAddress}`];
          if (activeContext.projectNumber) ctxParts.push(`Project #: ${activeContext.projectNumber}`);
          if (activeContext.projectName) ctxParts.push(`Name: ${activeContext.projectName}`);
          if (activeContext.clientName) ctxParts.push(`Client: ${activeContext.clientName}`);
          if (activeContext.filingType) ctxParts.push(`Filing Type: ${activeContext.filingType}`);
          if (activeContext.borough) ctxParts.push(`Borough: ${activeContext.borough}`);
          if (activeContext.block && activeContext.lot) ctxParts.push(`Block/Lot: ${activeContext.block}/${activeContext.lot}`);
          if (activeContext.scopeOfWork) ctxParts.push(`Scope: ${activeContext.scopeOfWork}`);
          if (activeContext.contractValue != null) ctxParts.push(`Contract Value: $${activeContext.contractValue.toLocaleString()}`);
          if (activeContext.billedAmount != null) ctxParts.push(`Billed: $${activeContext.billedAmount.toLocaleString()}`);
          if (activeContext.serviceDetails?.length) ctxParts.push(`Services: ${activeContext.serviceDetails.join("; ")}`);
          if (activeContext.dobApplications?.length) ctxParts.push(`DOB Applications: ${activeContext.dobApplications.join("; ")}`);

          if (activeContext.lastActivity) {
            ctxParts.push(`Last Activity: ${activeContext.lastActivity.userName} — ${activeContext.lastActivity.action} (${activeContext.lastActivity.timestamp})`);
          }
          if (activeContext.daysSinceLastActivity != null) {
            ctxParts.push(`Days Since Last Activity: ${activeContext.daysSinceLastActivity}`);
          }
          if (activeContext.openActionItems) {
            ctxParts.push(`Open Action Items (${activeContext.openActionItems.count}): ${activeContext.openActionItems.items.map(ai => `${ai.title} [${ai.assignee}, ${ai.priority}]`).join("; ")}`);
          }
          if (activeContext.financials) {
            const f = activeContext.financials;
            ctxParts.push(`Financials: Invoiced $${f.totalInvoiced.toLocaleString()}, Paid $${f.totalPaid.toLocaleString()}, Outstanding $${f.outstanding.toLocaleString()}, Proposal: ${f.proposalStatus}`);
          }
          if (activeContext.servicesStatus) {
            const ss = activeContext.servicesStatus;
            if (ss.notStarted.length) ctxParts.push(`Not Started: ${ss.notStarted.join(", ")}`);
            if (ss.inProgress.length) ctxParts.push(`In Progress: ${ss.inProgress.join(", ")}`);
            if (ss.completed.length) ctxParts.push(`Completed: ${ss.completed.join(", ")}`);
          }

          const sysInstruction = `[INSTRUCTIONS: Respond conversationally like a knowledgeable colleague. Lead with what needs attention — stale projects, overdue items, open action items. Mention team activity naturally (e.g., "Maria last updated this 12 days ago"). Only include property/zoning/filing details if specifically asked. Keep it to 3-4 short paragraphs max. End with one practical next step, not a list of questions. No big headings or report formatting.]`;
          enrichedQuery = `${sysInstruction}\n[Context: ${ctxParts.join(" | ")}]\n\n${q}`;
        }

        // Inject page & error context for bug detection
        const contextWithPage: BeaconProjectContext = {
          ...activeContext,
          currentPage,
          recentErrors: recentErrorsRef.current.length > 0 ? recentErrorsRef.current : undefined,
        };

        // Client-side bug pre-check: if the user's message looks like a bug report,
        // capture evidence BEFORE sending so the screenshot reflects the broken state.
        let pendingSnapshot: BeaconSnapshot | null = null;
        if (looksLikeBug(q)) {
          try {
            pendingSnapshot = await captureSnapshot();
          } catch (e) {
            console.warn("[beacon] snapshot failed", e);
          }
        }

        // Use current messages state for conversation history
        const currentMessages = await new Promise<ChatMessage[]>(resolve => {
          setMessages(prev => { resolve(prev); return prev; });
        });
        const conversationHistory = currentMessages.slice(-5).map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text,
        }));

        // Jurisdiction: default "NYC". If a project/property context is present, prefer its city-derived jurisdiction.
        // Today the only city we operate in is NYC (borough presence implies NYC), so this resolves to "NYC".
        const ctxJurisdiction = activeContext?.borough ? "NYC" : null;
        const res = await askBeacon(enrichedQuery, userId, userName, contextWithPage, conversationHistory, {
          companyId: profile?.company_id ?? null,
          jurisdiction: ctxJurisdiction ?? "NYC",
        });
        setMessages((prev) => [
          ...prev,
          {
            role: "beacon",
            text: res.response,
            confidence: res.confidence,
            sources: res.sources || [],
            responseTime: res.response_time_ms,
            flowType: res.flow_type,
            isBugReport: res.is_bug_report,
            bugLogged: res.bug_auto_logged === true,
            timestamp: new Date().toISOString(),
          },
        ]);

        // Save bot response to widget_messages with session_id
        const emailForSave = user?.email;
        if (emailForSave && res.response) {
          await supabase.from("widget_messages" as any).insert({
            user_email: emailForSave,
            role: "assistant",
            content: res.response,
            metadata: {
              confidence: res.confidence,
              sources: res.sources,
              flow_type: res.flow_type,
            },
            session_id: sessionId,
            company_id: profile?.company_id || null,
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
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    }

    processingRef.current = false;
    setLoading(false);
  }, [activeContext, currentPage, userId, userName, user?.email, sessionId]);

  const handleSend = useCallback((text?: string) => {
    const q = text || input.trim();
    if (!q) return;
    setInput("");
    queueRef.current.push(q);
    processQueue();
  }, [input, processQueue]);

  const handleNewChat = () => {
    setMessages([]);
    setHistoryCount(0);
    setHistoryLoaded(true);
    setSessionId(crypto.randomUUID() as string);
    setShowHistory(false);
  };

  const handleShowHistory = async () => {
    setShowHistory(true);
    setHistoryLoading(true);

    try {
      const userEmail = user?.email;
      if (!userEmail) return;

      // Query distinct sessions with first user message
      const { data } = await supabase
        .from("widget_messages" as any)
        .select("session_id, role, content, created_at")
        .eq("user_email", userEmail)
        .eq("role", "user")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        // Group by session_id, get first message and count
        const sessionMap = new Map<string, { first_message: string; created_at: string; count: number }>();
        for (const row of data as any[]) {
          const sid = row.session_id;
          if (!sid) continue;
          if (!sessionMap.has(sid)) {
            sessionMap.set(sid, { first_message: row.content, created_at: row.created_at, count: 1 });
          } else {
            sessionMap.get(sid)!.count++;
          }
        }

        const sessions: SessionPreview[] = Array.from(sessionMap.entries())
          .map(([sid, info]) => ({
            session_id: sid,
            first_message: info.first_message,
            created_at: info.created_at,
            message_count: info.count,
          }))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setHistorySessions(sessions);
      } else {
        setHistorySessions([]);
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
      setHistorySessions([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectSession = async (selectedSessionId: string) => {
    setSessionId(selectedSessionId);
    setShowHistory(false);
    setMessages([]);
    setHistoryCount(0);

    try {
      const userEmail = user?.email;
      if (!userEmail) return;

      const { data } = await supabase
        .from("widget_messages" as any)
        .select("role, content, metadata, created_at")
        .eq("user_email", userEmail)
        .eq("session_id", selectedSessionId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(50);

      if (data && data.length > 0) {
        const history: ChatMessage[] = (data as any[]).map((row) => ({
          role: row.role === "user" ? "user" : "beacon",
          text: row.content,
          confidence: row.metadata?.confidence,
          sources: row.metadata?.sources || [],
          flowType: row.metadata?.flow_type,
          isHistory: true,
          timestamp: row.created_at,
        }));
        setMessages(history);
        setHistoryCount(history.length);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const handleDeleteSession = async (targetSessionId: string) => {
    try {
      const userEmail = user?.email;
      if (!userEmail) return;
      const { error } = await supabase
        .from("widget_messages" as any)
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("user_email", userEmail)
        .eq("session_id", targetSessionId)
        .is("deleted_at", null);
      if (error) throw error;
      setHistorySessions((prev) => prev.filter((s) => s.session_id !== targetSessionId));
      if (sessionId === targetSessionId) {
        handleNewChat();
      }
      toast.success("Chat deleted");
    } catch (err: any) {
      console.error("Failed to delete session:", err);
      toast.error(err?.message || "Failed to delete chat");
    }
  };

  const handleClearAllSessions = async () => {
    try {
      const userEmail = user?.email;
      if (!userEmail) return;
      const { error } = await supabase
        .from("widget_messages" as any)
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("user_email", userEmail)
        .is("deleted_at", null);
      if (error) throw error;
      setHistorySessions([]);
      handleNewChat();
      toast.success("All chats cleared");
    } catch (err: any) {
      console.error("Failed to clear all sessions:", err);
      toast.error(err?.message || "Failed to clear chats");
    }
  };


  const handleLogBug = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg || msg.role !== "beacon") return;

    const conversationSlice = messages.slice(Math.max(0, msgIndex - 5), msgIndex + 1);
    const summary = conversationSlice.map(m => `${m.role === "user" ? "User" : "Beacon"}: ${m.text.slice(0, 300)}`).join("\n");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/beacon-proxy?action=create-bug`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            title: `[${currentPage}] Bug reported via Beacon`,
            description: summary,
            page: currentPage,
            ai_diagnosis: msg.text.slice(0, 1000),
          }),
        }
      );

      if (res.ok) {
        setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, bugLogged: true } : m));
        toast.success("Bug logged from conversation");
      } else {
        toast.error("Failed to log bug");
      }
    } catch {
      toast.error("Failed to log bug");
    }
  };

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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
            onClick={handleShowHistory}
            title="Previous chats"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
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
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
              onClick={() => { setOpen(false); navigate("/beacon"); }}
              title="Beacon admin"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
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

      {/* History panel or Messages */}
      {showHistory ? (
        <BeaconChatHistory
          sessions={historySessions}
          loading={historyLoading}
          onSelect={handleSelectSession}
          onBack={() => setShowHistory(false)}
          onDelete={handleDeleteSession}
          onClearAll={handleClearAllSessions}
        />
      ) : (
        <>
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
                  <div
                    ref={msg.role === "beacon" && i === messages.length - 1 ? lastBotRef : undefined}
                    className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "")}
                  >
                    {msg.role === "beacon" && (
                      <div className="w-6 h-6 rounded-full bg-[#f59e0b] flex items-center justify-center shrink-0 mt-1">
                        <Brain className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className={cn("max-w-[85%]", msg.role === "user" ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2" : "")}>
                      {msg.role === "beacon" ? (
                        <div className="space-y-1.5">
                          <div className="beacon-chat-response text-[13px] leading-relaxed">
                            <ReactMarkdown
                              components={{
                                h1: ({ children }) => <strong className="block mb-1">{children}</strong>,
                                h2: ({ children }) => <strong className="block mb-1">{children}</strong>,
                                h3: ({ children }) => <strong className="block mb-1">{children}</strong>,
                                h4: ({ children }) => <strong>{children}</strong>,
                                h5: ({ children }) => <strong>{children}</strong>,
                                h6: ({ children }) => <strong>{children}</strong>,
                                p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="pl-4 mb-1.5 list-disc">{children}</ul>,
                                ol: ({ children }) => <ol className="pl-4 mb-1.5 list-decimal">{children}</ol>,
                                li: ({ children }) => <li className="mb-0">{children}</li>,
                              }}
                            >{msg.text.replace(/\n\n📚[\s\S]*$/, '').replace(/\n\nSources:[\s\S]*$/, '')}</ReactMarkdown>
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
                          {msg.sources && <SourcesList sources={msg.sources} onViewDocument={setViewingFile} />}
                          {msg.isBugReport && !msg.bugLogged && (
                            <button
                              onClick={() => handleLogBug(i)}
                              className="flex items-center gap-1 mt-1 text-[10px] text-destructive hover:text-destructive/80 transition-colors"
                            >
                              <Bug className="h-3 w-3" />
                              Log as Bug
                            </button>
                          )}
                          {msg.bugLogged && (
                            <span className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                              <Bug className="h-3 w-3" /> Bug logged ✓
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm">{msg.text}</p>
                      )}
                      {msg.timestamp && (
                        <span className={cn(
                          "block text-[10px] mt-1 text-muted-foreground",
                          msg.role === "user" ? "text-right text-primary-foreground/60" : ""
                        )}>
                          {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
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

          {/* Context badge */}
          {activeContext?.projectAddress && (
            <div className="border-t px-3 py-1.5 flex items-center gap-1.5 bg-accent/30">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 font-normal max-w-[340px] truncate">
                📍 {activeContext.projectAddress}{activeContext.filingType ? ` — ${activeContext.filingType}` : ""}
                {activeContext.contractValue != null ? ` · $${activeContext.contractValue.toLocaleString()}` : ""}
              </Badge>
              <button
                onClick={() => setContextCleared(true)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Clear project context"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="border-t p-3">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={loading ? "Type your next message..." : "Ask Beacon..."}
                className="flex-1 h-9 text-sm"
              />
              <Button
                type="submit"
                disabled={!input.trim()}
                size="icon"
                className="h-9 w-9 bg-[#f59e0b] hover:bg-[#d97706] text-white shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      )}

      <Suspense fallback={null}>
        <BeaconDocumentModal
          open={!!viewingFile}
          onClose={() => setViewingFile(null)}
          sourceFile={viewingFile || ""}
        />
      </Suspense>
    </div>,
    document.body
  );
}
