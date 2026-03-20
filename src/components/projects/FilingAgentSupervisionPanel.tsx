import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, CheckCircle2, XCircle, Eye, Bot, ArrowLeft,
  ExternalLink, Clock, Image as ImageIcon, ThumbsUp, ThumbsDown,
  RotateCcw, Trash2, ChevronDown, ChevronRight, LogIn,
  Maximize2, Minimize2, Monitor,
} from "lucide-react";

interface FilingRunProgress {
  step: string;
  status: string;
  timestamp: string;
  screenshot_url?: string;
}

interface FilingRunData {
  id: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  agent_session_id: string | null;
  session_url: string | null;
  recording_url: string | null;
  live_url: string | null;
  progress_log: FilingRunProgress[];
  screenshots: Array<{ url: string; step: string; timestamp: string }>;
}

interface FilingAgentSupervisionPanelProps {
  runId: string;
  onReset: () => void;
  onRetry: () => void;
  onConfirmFiled: () => void;
  retrying: boolean;
  confirmingFiled: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Loader2 }> = {
  queued: { label: "Queued", color: "bg-muted text-muted-foreground border-border", icon: Clock },
  running: { label: "Running", color: "bg-primary/5 text-primary border-primary/20", icon: Loader2 },
  in_progress: { label: "Running", color: "bg-primary/5 text-primary border-primary/20", icon: Loader2 },
  completed: { label: "Completed", color: "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", icon: CheckCircle2 },
  ready_for_review: { label: "Ready for Review", color: "bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800", icon: Eye },
  review_needed: { label: "Ready for Review", color: "bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800", icon: Eye },
  failed: { label: "Error", color: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  error: { label: "Error", color: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  reviewed: { label: "Approved", color: "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
};

const TERMINAL_STATUSES = ["completed", "ready_for_review", "review_needed", "failed", "error", "reviewed", "rejected"];

export function FilingAgentSupervisionPanel({
  runId,
  onReset,
  onRetry,
  onConfirmFiled,
  retrying,
  confirmingFiled,
}: FilingAgentSupervisionPanelProps) {
  const { toast } = useToast();
  const [run, setRun] = useState<FilingRunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectNotes, setRejectNotes] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [screenshotIndex, setScreenshotIndex] = useState(0);
  const [stepsExpanded, setStepsExpanded] = useState(true);
  const [browserModalOpen, setBrowserModalOpen] = useState(false);
  const [iframeExpanded, setIframeExpanded] = useState(false);
  const prevLiveUrlRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch initial run data
  useEffect(() => {
    fetchRun();
  }, [runId]);

  // Poll for status updates + realtime subscription
  useEffect(() => {
    if (!run) return;

    const isTerminal = TERMINAL_STATUSES.includes(run.status);
    if (isTerminal && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }

    if (!isTerminal && !pollRef.current) {
      pollRef.current = setInterval(() => {
        pollAgentStatus();
        fetchRun();
      }, 5000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [run?.status]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`filing-supervision-${runId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "filing_runs", filter: `id=eq.${runId}` },
        (payload: any) => {
          const row = payload.new;
          setRun(prev => prev ? {
            ...prev,
            status: row.status,
            progress_log: Array.isArray(row.progress_log) ? row.progress_log : [],
            error_message: row.error_message,
            completed_at: row.completed_at,
            started_at: row.started_at,
            session_url: row.session_url,
            recording_url: row.recording_url,
            live_url: row.live_url,
            screenshots: Array.isArray(row.screenshots) ? row.screenshots : [],
          } : null);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [runId]);

  const fetchRun = async () => {
    const { data, error } = await (supabase.from("filing_runs") as any)
      .select("id, status, created_at, started_at, completed_at, error_message, agent_session_id, session_url, recording_url, live_url, progress_log, screenshots")
      .eq("id", runId)
      .maybeSingle();

    console.log("[FilingSupervision] fetchRun live_url:", data?.live_url, data);

    if (data) {
      setRun({
        ...data,
        progress_log: Array.isArray(data.progress_log) ? data.progress_log : [],
        screenshots: Array.isArray(data.screenshots) ? data.screenshots : [],
      });
    }
    setLoading(false);
  };

  const pollAgentStatus = async () => {
    if (!run?.agent_session_id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/filing-agent-proxy?action=status&job_id=${encodeURIComponent(run.agent_session_id)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (res.ok) {
        const agentData = await res.json();
        console.log("[FilingSupervision] polled agent data live_url:", agentData?.live_url, agentData);
        const updates: Record<string, any> = {};
        if (agentData.session_url) updates.session_url = agentData.session_url;
        if (agentData.recording_url) updates.recording_url = agentData.recording_url;
        if (agentData.live_url) updates.live_url = agentData.live_url;

        if (Object.keys(updates).length > 0) {
          await (supabase.from("filing_runs") as any)
            .update(updates)
            .eq("id", runId);
        }

        // Update local state with live_url immediately
        if (agentData.live_url) {
          setRun(prev => prev ? { ...prev, live_url: agentData.live_url } : null);
        }

        if (agentData.screenshots && Array.isArray(agentData.screenshots)) {
          await (supabase.from("filing_runs") as any)
            .update({ screenshots: agentData.screenshots })
            .eq("id", runId);
        }
      }
    } catch (err) {
      console.error("[FilingSupervision] Poll error:", err);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await (supabase.from("filing_runs") as any)
        .update({ status: "reviewed", completed_at: new Date().toISOString() })
        .eq("id", runId);
      setRun(prev => prev ? { ...prev, status: "reviewed" } : null);
      toast({ title: "Filing approved", description: "The filing has been marked as reviewed and approved." });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNotes.trim()) {
      toast({ title: "Notes required", description: "Please provide notes about what needs to be corrected.", variant: "destructive" });
      return;
    }
    setRejecting(true);
    try {
      await (supabase.from("filing_runs") as any)
        .update({
          status: "rejected",
          error_message: rejectNotes.trim(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
      setRun(prev => prev ? { ...prev, status: "rejected", error_message: rejectNotes.trim() } : null);
      setShowRejectForm(false);
      toast({ title: "Filing rejected", description: "The filing has been rejected with notes." });
    } finally {
      setRejecting(false);
    }
  };

  // Elapsed time — re-computed every tick via state counter
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!run || TERMINAL_STATUSES.includes(run.status)) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [run?.status]);

  const elapsed = useMemo(() => {
    // Reference tick so useMemo recomputes each second
    void tick;
    if (!run) return "";
    const start = run.started_at || run.created_at;
    const end = run.completed_at || (TERMINAL_STATUSES.includes(run.status) ? run.completed_at : null);
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const diff = Math.max(0, endTime - startTime);
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }, [run?.started_at, run?.created_at, run?.completed_at, run?.status, tick]);

  // Auto-open browser modal when live_url first becomes available
  useEffect(() => {
    if (run?.live_url && !prevLiveUrlRef.current && isRunningStatus(run.status)) {
      setBrowserModalOpen(true);
    }
    prevLiveUrlRef.current = run?.live_url || null;
  }, [run?.live_url, run?.status]);

  // Detect login-required step
  const needsLogin = useMemo(() => {
    if (!run || !isRunningStatus(run.status)) return false;
    return run.progress_log.some(
      (entry) =>
        entry.step?.toLowerCase().includes("login_required") ||
        entry.step?.toLowerCase().includes("waiting_for_login") ||
        entry.status?.toLowerCase().includes("login_required") ||
        entry.status?.toLowerCase().includes("waiting_for_login")
    );
  }, [run?.progress_log, run?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading agent status...
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        Filing run not found.
        <Button variant="ghost" size="sm" className="mt-2" onClick={onReset}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[run.status] || STATUS_CONFIG.queued;
  const StatusIcon = statusConfig.icon;
  const isRunning = isRunningStatus(run.status);
  const isReviewable = ["ready_for_review", "review_needed"].includes(run.status);
  const isError = ["failed", "error"].includes(run.status);
  const screenshots = run.screenshots || [];



  return (
    <div className="space-y-3">
      {/* ── STATUS BAR ── */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${statusConfig.color}`}>
        <StatusIcon className={`h-4 w-4 shrink-0 ${isRunning && run.status !== "queued" ? "animate-spin" : ""}`} />
        <span className="font-medium flex-1">{statusConfig.label}</span>
        <div className="flex items-center gap-2 text-xs">
          <Clock className="h-3 w-3" />
          <span className="font-mono">{elapsed}</span>
        </div>
      </div>

      {/* ── LOGIN REQUIRED BANNER ── */}
      {needsLogin && (
        <div className="p-3 rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 space-y-1.5">
          <div className="flex items-start gap-2">
            <LogIn className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <span className="font-semibold">DOB NOW requires login.</span>{" "}
              Log in directly in the browser view below. The agent will continue automatically after you sign in.
            </p>
          </div>
        </div>
      )}

      {/* ── EMBEDDED BROWSER VIEW (inline small preview + open modal button) ── */}
      {(() => {
        const iframeSrc = isRunning
          ? (run.live_url || run.session_url)
          : (!isRunning && TERMINAL_STATUSES.includes(run.status))
            ? (run.recording_url || run.session_url)
            : null;

        if (iframeSrc) {
          return (
            <div className="rounded-lg border bg-background overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground flex-1">
                  {isRunning ? "Live Browser" : "Session Recording"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 text-xs px-2"
                  onClick={() => setBrowserModalOpen(true)}
                >
                  <Maximize2 className="h-3 w-3" /> Open Full View
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => window.open(iframeSrc, "_blank")}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
              {/* Small inline preview iframe — fully interactive */}
              <iframe
                src={iframeSrc}
                className="w-full border-0 h-[280px]"
                allow="clipboard-read; clipboard-write; autoplay; encrypted-media; fullscreen"
                style={{ pointerEvents: "auto" }}
              />
            </div>
          );
        }

        // No URL available yet
        if (isRunning) {
          return (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 text-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1.5" />
              Waiting for browser session…
              {run.agent_session_id && (
                <div className="mt-1 font-mono text-[10px] text-muted-foreground/60 truncate">
                  Job: {run.agent_session_id}
                </div>
              )}
            </div>
          );
        }

        return null;
      })()}

      {/* ── BROWSER MODAL (custom portal — no focus trap, no pointer interception) ── */}
      {(() => {
        const modalSrc = isRunning
          ? (run.live_url || run.session_url)
          : (!isRunning && TERMINAL_STATUSES.includes(run.status))
            ? (run.recording_url || run.session_url)
            : null;

        if (!modalSrc || !browserModalOpen) return null;

        return createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[100] bg-black/60"
              onClick={() => setBrowserModalOpen(false)}
            />
            {/* Modal panel */}
            <div
              className="fixed z-[101] bg-background border rounded-lg shadow-2xl flex flex-col overflow-hidden"
              style={{
                top: "5vh",
                left: "4vw",
                width: "92vw",
                height: "85vh",
              }}
            >
              {/* Title bar */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/30 shrink-0">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold flex-1">
                  DOB NOW Filing Agent — {isRunning ? "Live Browser" : "Session Recording"}
                </span>
                <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${statusConfig.color}`}>
                  <StatusIcon className={`h-3 w-3 ${isRunning && run.status !== "queued" ? "animate-spin" : ""}`} />
                  {statusConfig.label}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="font-mono">{elapsed}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setBrowserModalOpen(false)}
                >
                  <Minimize2 className="h-3.5 w-3.5" /> Minimize
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => window.open(modalSrc, "_blank")}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Login banner inside modal */}
              {needsLogin && (
                <div className="px-4 py-2 border-b bg-blue-50 dark:bg-blue-900/20 flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    <span className="font-semibold">Login required.</span>{" "}
                    Type your DOB NOW credentials directly in the browser below.
                  </p>
                </div>
              )}

              {/* Full-size iframe — fully interactive, no focus trap */}
              <iframe
                src={modalSrc}
                className="flex-1 w-full border-0"
                allow="clipboard-read; clipboard-write; autoplay; encrypted-media; fullscreen"
                style={{ pointerEvents: "auto" }}
              />
            </div>
          </>,
          document.body
        );
      })()}

      <Separator />

      {/* ── STEPS LOG ── */}
      {run.progress_log.length > 0 && (
        <div className="rounded-lg border bg-background">
          <button
            className="flex items-center gap-2 w-full p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            onClick={() => setStepsExpanded(!stepsExpanded)}
          >
            {stepsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Steps ({run.progress_log.length})
          </button>
          {stepsExpanded && (
            <div className="px-3 pb-3 space-y-1.5 max-h-56 overflow-y-auto">
              {run.progress_log.map((entry, i) => {
                const isLast = i === run.progress_log.length - 1;
                const isCurrent = isLast && isRunning && entry.status !== "success" && entry.status !== "error";
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {entry.status === "success" || entry.status === "completed" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : entry.status === "error" || entry.status === "failed" ? (
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                    ) : isCurrent ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                    )}
                    <span className={`flex-1 ${isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {entry.step}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SCREENSHOT GALLERY ── */}
      {screenshots.length > 0 && (isReviewable || run.status === "completed" || run.status === "reviewed") && (
        <div className="rounded-lg border bg-background p-3 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" /> Screenshots ({screenshots.length})
          </h4>
          <div className="relative rounded-md overflow-hidden border bg-muted/30">
            <img
              src={screenshots[screenshotIndex]?.url}
              alt={screenshots[screenshotIndex]?.step || `Screenshot ${screenshotIndex + 1}`}
              className="w-full h-auto max-h-64 object-contain"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1">
              {screenshots[screenshotIndex]?.step || `Step ${screenshotIndex + 1}`}
            </div>
          </div>
          {screenshots.length > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                disabled={screenshotIndex === 0}
                onClick={() => setScreenshotIndex(i => i - 1)}
              >
                ← Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                {screenshotIndex + 1} / {screenshots.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                disabled={screenshotIndex >= screenshots.length - 1}
                onClick={() => setScreenshotIndex(i => i + 1)}
              >
                Next →
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── REVIEW ACTIONS ── */}
      {isReviewable && !showRejectForm && (
        <div className="flex items-center gap-2">
          <Button
            className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            size="sm"
            onClick={handleApprove}
            disabled={approving}
          >
            {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
            Approve
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
            size="sm"
            onClick={() => setShowRejectForm(true)}
          >
            <ThumbsDown className="h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      )}

      {/* Reject form */}
      {showRejectForm && (
        <div className="space-y-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <p className="text-xs font-medium text-destructive">What needs to be corrected?</p>
          <Textarea
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="Describe the issues..."
            className="h-20 text-sm"
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={handleReject}
              disabled={rejecting}
            >
              {rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
              Confirm Reject
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowRejectForm(false); setRejectNotes(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── ERROR DISPLAY ── */}
      {isError && (
        <div className="space-y-2">
          {run.error_message && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
              <p className="font-medium text-xs mb-1">Error Details</p>
              {run.error_message}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry} disabled={retrying}>
              {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Retry
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onReset}>
              <Trash2 className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </div>
      )}

      {/* ── COMPLETED ACTIONS ── */}
      {(run.status === "completed" || run.status === "reviewed") && (
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={onConfirmFiled} disabled={confirmingFiled}>
            {confirmingFiled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Confirm Filed
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onReset}>
            Done
          </Button>
        </div>
      )}

      {/* Rejected state */}
      {run.status === "rejected" && (
        <div className="space-y-2">
          {run.error_message && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
              <p className="font-medium text-xs mb-1">Rejection Notes</p>
              {run.error_message}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry} disabled={retrying}>
              {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Retry Filing
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onReset}>
              <Trash2 className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </div>
      )}

      {/* Running state — show subtle cancel */}
      {isRunning && (
        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={onReset}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Cancel & Reset
        </Button>
      )}
    </div>
  );
}

function isRunningStatus(status: string): boolean {
  return ["queued", "running", "in_progress"].includes(status);
}
