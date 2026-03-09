import { useState, useCallback, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search, Brain, ChevronRight, ChevronDown, FileText, Sparkles, X,
  Save, Mail, CheckCircle2, Clock, AlertCircle, PanelLeftClose,
  PanelLeft, BookOpen, Upload, ThumbsUp, ThumbsDown, MessageSquare,
  Eye, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ComposeEmailDialog } from "@/components/emails/ComposeEmailDialog";
import { useObjectionItems, type ObjectionItem } from "@/hooks/useObjectionItems";
import { useUploadDocument } from "@/hooks/useUniversalDocuments";
import { askBeacon, type BeaconChatResponse, type BeaconSource } from "@/services/beaconApi";
import { useAuth } from "@/hooks/useAuth";
import { ObjectionSummaryView } from "./ObjectionSummaryView";
import { UploadObjectionDialog } from "./UploadObjectionDialog";

// --- Types ---

type ObjectionStatus = "pending" | "in_progress" | "resolved";

interface BeaconResearchResponse {
  id: string;
  query: string;
  text: string;
  confidence: number;
  sources: BeaconSource[];
  timestamp: Date;
}

interface ObjectionWorkState {
  beaconResponses: BeaconResearchResponse[];
  pmNotes: string;
  cleanedVersion: string | null;
}

// --- Status helpers ---

const statusConfig: Record<ObjectionStatus, { label: string; className: string }> = {
  pending: { label: "Open", className: "bg-muted text-muted-foreground border-border" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700" },
  resolved: { label: "Resolved", className: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700" },
};

// --- Sub-components ---

function ObjectionListItem({ objection, isSelected, onClick }: { objection: ObjectionItem; isSelected: boolean; onClick: () => void }) {
  const status = (objection.status || "pending") as ObjectionStatus;
  const cfg = statusConfig[status] || statusConfig.pending;
  const hasNotes = !!(objection.resolution_notes || objection.response_draft);
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-colors",
        isSelected ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20" : "bg-background border-border hover:bg-muted/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground">#{objection.item_number}</span>
            {objection.code_reference && (
              <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">{objection.code_reference}</Badge>
            )}
            {hasNotes && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                <FileText className="h-3 w-3" /> Notes
              </span>
            )}
          </div>
          <p className="text-sm text-foreground line-clamp-2">{objection.objection_text}</p>
        </div>
        <span className={cn("shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", cfg.className)}>
          {cfg.label}
        </span>
      </div>
    </button>
  );
}

function BeaconResponseCard({ response, innerRef, projectId, objectionId, userId, companyId }: {
  response: BeaconResearchResponse;
  innerRef?: React.Ref<HTMLDivElement>;
  projectId?: string;
  objectionId?: string;
  userId?: string;
  companyId?: string;
}) {
  const [expandSources, setExpandSources] = useState(false);
  const [expandAnalysis, setExpandAnalysis] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const confidenceLabel = response.confidence >= 0.85 ? "High" : response.confidence >= 0.6 ? "Medium" : "Low";
  const confidenceColor = response.confidence >= 0.85 ? "text-emerald-600 dark:text-emerald-400" : response.confidence >= 0.6 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";

  // Split response into direct answer (first paragraph) and detail
  const paragraphs = response.text.split(/\n\n+/);
  const directAnswer = paragraphs[0] || "";
  const detailText = paragraphs.slice(1).join("\n\n");

  const submitFeedback = async (isHelpful: boolean, comment?: string) => {
    if (!userId || !companyId) return;
    setSubmittingFeedback(true);
    try {
      await supabase.from("beacon_research_feedback").insert({
        user_id: userId,
        company_id: companyId,
        project_id: projectId || null,
        objection_id: objectionId || null,
        query: response.query,
        is_helpful: isHelpful,
        confidence_score: response.confidence,
        comment: comment || null,
      });
      setFeedbackGiven(isHelpful);
      setShowCommentBox(false);
    } catch { /* non-critical */ }
    setSubmittingFeedback(false);
  };

  return (
    <Card ref={innerRef} className="border-primary/20">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Beacon Research</CardTitle>
          </div>
          <span className={cn("text-[10px] font-semibold", confidenceColor)}>
            {confidenceLabel} ({Math.round(response.confidence * 100)}%)
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {/* Direct Answer — highlighted, compact */}
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-0.5">Direct Answer</p>
          <div className="text-sm leading-snug [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-medium [&_p]:text-sm [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
            <ReactMarkdown>{directAnswer}</ReactMarkdown>
          </div>
        </div>

        {/* Full Analysis — collapsible, compact */}
        {detailText.trim() && (
          <Collapsible open={expandAnalysis} onOpenChange={setExpandAnalysis}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              {expandAnalysis ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Full Analysis
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1.5">
              <div className="text-sm leading-snug max-h-[250px] overflow-y-auto pl-2 border-l-2 border-muted [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-[13px] [&_h3]:font-medium [&_p]:text-sm [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
                <ReactMarkdown>{detailText}</ReactMarkdown>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Sources — collapsible */}
        {response.sources.length > 0 && (
          <Collapsible open={expandSources} onOpenChange={setExpandSources}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {expandSources ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Sources ({response.sources.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1">
              {response.sources.map((s, i) => (
                <div key={i} className="p-2 rounded border bg-muted/30 text-sm flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{s.title}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{Math.round(s.score * 100)}%</span>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Feedback */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          {feedbackGiven === null ? (
            <>
              <span className="text-[10px] text-muted-foreground">Was this helpful?</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                disabled={submittingFeedback}
                onClick={() => submitFeedback(true)}
              >
                <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground hover:text-emerald-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                disabled={submittingFeedback}
                onClick={() => {
                  setFeedbackGiven(false);
                  setShowCommentBox(true);
                }}
              >
                <ThumbsDown className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              {feedbackGiven ? (
                <><ThumbsUp className="h-3 w-3 text-emerald-600" /> Thanks for your feedback</>
              ) : (
                <><ThumbsDown className="h-3 w-3 text-destructive" /> Thanks for your feedback</>
              )}
            </span>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground">
            {response.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>

        {/* Comment box for negative feedback */}
        {showCommentBox && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <MessageSquare className="h-3 w-3" /> What was wrong or missing? (optional)
            </div>
            <Textarea
              className="min-h-[60px] text-xs"
              placeholder="e.g. Wrong code section, didn't address the specific objection..."
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px]"
                onClick={() => submitFeedback(false, feedbackComment)}
                disabled={submittingFeedback}
              >
                Submit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px]"
                onClick={() => { setShowCommentBox(false); submitFeedback(false); }}
                disabled={submittingFeedback}
              >
                Skip
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Main Component ---

interface ResearchWorkspaceProps {
  projectId: string;
  projectAddress?: string;
  architectEmail?: string;
  filingType?: string;
  scopeOfWork?: string;
}

export function ResearchWorkspace({ projectId, projectAddress, architectEmail, filingType, scopeOfWork }: ResearchWorkspaceProps) {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { items: objections, isLoading, update, bulkInsert } = useObjectionItems(projectId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [workStates, setWorkStates] = useState<Record<string, ObjectionWorkState>>({});
  const [beaconInput, setBeaconInput] = useState("");
  const [beaconLoading, setBeaconLoading] = useState(false);
  const [cleanUpLoading, setCleanUpLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState<{ to: string; subject: string; body: string; attachments?: any[] }>({ to: "", subject: "", body: "" });
  const [showSummary, setShowSummary] = useState(false);
  const [savingPackage, setSavingPackage] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const lastResponseRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const uploadDocument = useUploadDocument();

  const selected = objections.find((o) => o.id === selectedId) || null;
  const openCount = objections.filter((o) => o.status !== "resolved").length;

  // Auto-select first item when objections load
  useEffect(() => {
    if (objections.length > 0 && !selectedId) {
      setSelectedId(objections[0].id);
    }
  }, [objections, selectedId]);

  // Initialize workState from DB fields
  useEffect(() => {
    if (!selected) return;
    setWorkStates((prev) => {
      if (prev[selected.id]) return prev;
      return {
        ...prev,
        [selected.id]: {
          beaconResponses: [],
          pmNotes: selected.resolution_notes || "",
          cleanedVersion: selected.response_draft || null,
        },
      };
    });
  }, [selected]);

  const getWorkState = useCallback((id: string): ObjectionWorkState => {
    return workStates[id] || { beaconResponses: [], pmNotes: "", cleanedVersion: null };
  }, [workStates]);

  const updateWorkState = useCallback((id: string, patch: Partial<ObjectionWorkState>) => {
    setWorkStates((prev) => ({
      ...prev,
      [id]: { ...prev[id] || { beaconResponses: [], pmNotes: "", cleanedVersion: null }, ...patch },
    }));
  }, []);

  const handleImportDemo = async () => {
    const demoItems = [
      { project_id: projectId, item_number: 1, objection_text: "Provide a complete scope of work including all construction operations", code_reference: "AC 28-104.7", status: "pending" },
      { project_id: projectId, item_number: 2, objection_text: "Applicant of record does not match the BIS record for this filing", code_reference: "AC 28-112.3", status: "pending" },
      { project_id: projectId, item_number: 3, objection_text: "Rear yard setback does not comply with the applicable zoning district requirements", code_reference: "ZR 33-42", status: "in_progress" },
      { project_id: projectId, item_number: 4, objection_text: "Provide occupant load calculations for all floors affected by the proposed work", code_reference: "BC 1003.6", status: "pending" },
      { project_id: projectId, item_number: 5, objection_text: "Energy code compliance path not indicated on the drawings", code_reference: "AC 28-105.4.1", status: "resolved" },
    ];
    try {
      await bulkInsert(demoItems as any);
      toast({ title: "Demo objections imported", description: `${demoItems.length} objections loaded.` });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    }
  };

  const userId = user?.email || user?.id || "anonymous";
  const userName = profile?.display_name || profile?.first_name || "User";

  const handleBeaconSend = async () => {
    if (!beaconInput.trim() || !selected) return;
    setBeaconLoading(true);
    const rawQuery = beaconInput.trim();
    setBeaconInput("");

    // Prepend objection context so Beacon knows exactly which code section is being discussed
    const codeRef = selected.code_reference || "";
    const contextPrefix = codeRef
      ? `[Regarding DOB objection #${selected.item_number} — ${codeRef}: "${selected.objection_text}"]\n\n`
      : `[Regarding DOB objection #${selected.item_number}: "${selected.objection_text}"]\n\n`;
    const query = contextPrefix + rawQuery;

    try {
      const res = await askBeacon(query, userId, userName, {
        projectId,
        projectAddress,
        codeSection: codeRef || undefined,
      });

      const response: BeaconResearchResponse = {
        id: `br-${Date.now()}`,
        query: rawQuery,
        text: res.response,
        confidence: res.confidence,
        sources: res.sources || [],
        timestamp: new Date(),
      };

      const current = getWorkState(selected.id);
      updateWorkState(selected.id, { beaconResponses: [...current.beaconResponses, response] });
    } catch {
      toast({ title: "Beacon unavailable", description: "Could not reach Beacon. Please try again.", variant: "destructive" });
    } finally {
      setBeaconLoading(false);
    }
  };

  const handleCleanUp = async () => {
    if (!selected) return;
    const ws = getWorkState(selected.id);
    if (!ws.pmNotes.trim()) {
      toast({ title: "No notes to clean up", description: "Write your notes first, then click Clean Up.", variant: "destructive" });
      return;
    }
    setCleanUpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-notes", {
        body: {
          notes: ws.pmNotes,
          code_reference: selected.code_reference || "",
          objection_text: selected.objection_text || "",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      updateWorkState(selected.id, { cleanedVersion: data.cleaned });
      toast({ title: "Notes cleaned up" });
    } catch (err: any) {
      toast({ title: "Clean up failed", description: err.message, variant: "destructive" });
    } finally {
      setCleanUpLoading(false);
    }
  };

  const handleSaveToDocs = async () => {
    if (!selected) return;
    const ws = getWorkState(selected.id);
    try {
      await update({
        id: selected.id,
        resolution_notes: ws.pmNotes || null,
        response_draft: ws.cleanedVersion || null,
      });
      toast({ title: "Research saved", description: `Notes for objection #${selected.item_number} saved.` });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const handleSendAsEmail = () => {
    if (!selected) return;
    const ws = getWorkState(selected.id);
    const body = ws.cleanedVersion || ws.pmNotes || "";
    setComposeDefaults({
      to: architectEmail || "",
      subject: `RE: ${projectAddress || "Project"} — Response to DOB Objection #${selected.item_number}`,
      body,
    });
    setComposeOpen(true);
  };

  // Build HTML body for all addressed objections
  const buildConsolidatedBody = () => {
    const addressed = objections.filter((o) => o.response_draft || o.resolution_notes);
    if (addressed.length === 0) return "";
    let html = `<p>Please see our responses to the DOB objections for <strong>${projectAddress || "the project"}</strong> below:</p><br/>`;
    addressed.forEach((obj) => {
      const response = obj.response_draft || obj.resolution_notes || "";
      html += `<p><strong>#${obj.item_number}${obj.code_reference ? ` — ${obj.code_reference}` : ""}</strong></p>`;
      html += `<p style="color:#666;font-style:italic;">${obj.objection_text}</p>`;
      html += `<p>${response.replace(/\n/g, "<br/>")}</p><br/>`;
    });
    return html;
  };

  // Fetch project plan docs from universal_documents and convert to AttachmentFile format
  const fetchProjectAttachments = async (): Promise<any[]> => {
    if (!profile?.company_id) return [];
    const { data: docs } = await supabase
      .from("universal_documents")
      .select("*")
      .eq("project_id", projectId)
      .in("category", ["Plans", "Objections", "Objection Responses"])
      .order("created_at", { ascending: false });
    if (!docs || docs.length === 0) return [];

    const attachments: any[] = [];
    for (const doc of docs.slice(0, 5)) { // limit to 5 files
      try {
        const { data: blob } = await supabase.storage
          .from("universal-documents")
          .download(doc.storage_path);
        if (!blob) continue;
        const file = new File([blob], doc.filename, { type: doc.mime_type || "application/octet-stream" });
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(file);
        });
        attachments.push({ file, name: doc.filename, size: file.size, base64 });
      } catch { /* skip failed downloads */ }
    }
    return attachments;
  };

  const handleSendAllAsEmail = async () => {
    const body = buildConsolidatedBody();
    if (!body) {
      toast({ title: "No responses to send", description: "Address at least one objection first.", variant: "destructive" });
      return;
    }
    const attachments = await fetchProjectAttachments();
    setComposeDefaults({
      to: architectEmail || "",
      subject: `RE: ${projectAddress || "Project"} — Objection Responses`,
      body,
      attachments,
    });
    setComposeOpen(true);
  };

  const handleSavePackageToDocs = async () => {
    const addressed = objections.filter((o) => o.response_draft || o.resolution_notes);
    if (addressed.length === 0) {
      toast({ title: "Nothing to save", description: "Address at least one objection first.", variant: "destructive" });
      return;
    }
    setSavingPackage(true);
    try {
      // Build HTML document
      let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Objection Responses — ${projectAddress || "Project"}</title>
<style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#333}
.item{margin-bottom:24px;border-bottom:1px solid #eee;padding-bottom:16px}
.code{font-family:monospace;background:#f4f4f4;padding:2px 6px;border-radius:3px;font-size:13px}
.objection{color:#666;font-style:italic;margin:4px 0 8px}
.response{white-space:pre-wrap;line-height:1.6}</style></head><body>
<h1>Objection Responses</h1>
<p><strong>Project:</strong> ${projectAddress || "—"}</p>
<p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
<p><strong>Total Items:</strong> ${objections.length} (${addressed.length} addressed)</p><hr/>`;

      addressed.forEach((obj) => {
        const response = obj.response_draft || obj.resolution_notes || "";
        html += `<div class="item">
<h3>#${obj.item_number} ${obj.code_reference ? `<span class="code">${obj.code_reference}</span>` : ""}</h3>
<p class="objection">${obj.objection_text}</p>
<div class="response">${response}</div></div>`;
      });
      html += `</body></html>`;

      const blob = new Blob([html], { type: "text/html" });
      const filename = `Objection-Responses-${projectAddress?.replace(/[^a-zA-Z0-9]/g, "-") || projectId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.html`;
      const file = new File([blob], filename, { type: "text/html" });

      await uploadDocument.mutateAsync({
        file,
        title: `Objection Responses — ${projectAddress || "Project"}`,
        description: `${addressed.length} of ${objections.length} objections addressed`,
        category: "Objection Responses",
        tags: ["objections", "responses"],
      });

      // Also link to project
      // The upload hook doesn't support project_id directly, so patch it
      const { data: latest } = await supabase
        .from("universal_documents")
        .select("id")
        .eq("company_id", profile!.company_id!)
        .eq("category", "Objection Responses")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (latest) {
        await supabase.from("universal_documents").update({ project_id: projectId } as any).eq("id", latest.id);
      }

      toast({ title: "Saved to Documents", description: "Objection response package saved." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingPackage(false);
    }
  };

  const handleStatusChange = async (id: string, status: ObjectionStatus) => {
    try {
      await update({ id, status });
      toast({ title: `Objection marked as ${statusConfig[status].label}` });
      if (status === "resolved") {
        const next = objections.find((o) => o.id !== id && o.status !== "resolved");
        if (next) setSelectedId(next.id);
      }
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  // Scroll to top of latest response so user reads from the beginning
  useEffect(() => {
    if (lastResponseRef.current) {
      lastResponseRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [workStates, selectedId]);

  const currentWorkState = selected ? getWorkState(selected.id) : null;

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[500px]">
      {/* Left Panel — Objection List */}
      {!panelCollapsed && (
        <div className="w-[38%] min-w-[280px] border-r flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              Objections
              {openCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">{openCount}</Badge>
              )}
            </h3>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-3 w-3" /> Upload Objection
              </Button>
              {objections.length === 0 && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleImportDemo}>
                  <Upload className="h-3 w-3" /> Import Demo
                </Button>
              )}
              {objections.length > 0 && (
                <Button
                  variant={showSummary ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowSummary(!showSummary)}
                >
                  <Eye className="h-3 w-3" /> Preview
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanelCollapsed(true)}>
                <PanelLeftClose className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : objections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No objections loaded</p>
                <p className="text-xs text-muted-foreground mt-1">Import a DOB objection sheet to get started</p>
                <div className="flex gap-2 mt-4">
                  <Button variant="default" size="sm" className="gap-1.5" onClick={() => setUploadDialogOpen(true)}>
                    <Upload className="h-3.5 w-3.5" /> Upload Objection Letter
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleImportDemo}>
                    <Upload className="h-3.5 w-3.5" /> Import Demo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {objections.map((obj) => (
                  <ObjectionListItem
                    key={obj.id}
                    objection={obj}
                    isSelected={selectedId === obj.id}
                    onClick={() => setSelectedId(obj.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Collapsed Toggle */}
      {panelCollapsed && (
        <div className="border-r flex flex-col items-center py-3 px-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanelCollapsed(false)}>
            <PanelLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Right Panel — Research Workspace or Summary */}
      <div className="flex-1 flex flex-col min-w-0">
        {showSummary ? (
          <ObjectionSummaryView
            objections={objections}
            onClose={() => setShowSummary(false)}
            onSendAll={handleSendAllAsEmail}
            onSaveToDocs={handleSavePackageToDocs}
            isSaving={savingPackage}
          />
        ) : !selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">Select an objection to research</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Click on an objection from the list to open the research workspace. Use Beacon to look up code sections and build your response.
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Objection Header */}
            <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-muted-foreground">#{selected.item_number}</span>
                {selected.code_reference && (
                  <Badge variant="outline" className="font-mono text-xs">{selected.code_reference}</Badge>
                )}
                <Separator orientation="vertical" className="h-4" />
                <p className="text-sm truncate">{selected.objection_text}</p>
              </div>
              <span className={cn("shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", statusConfig[(selected.status || "pending") as ObjectionStatus]?.className)}>
                {statusConfig[(selected.status || "pending") as ObjectionStatus]?.label}
              </span>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {/* Section A: Beacon Research */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Beacon Research
                  </h4>

                  {currentWorkState && currentWorkState.beaconResponses.length > 0 && (
                    <div className="space-y-3 mb-3">
                      {currentWorkState.beaconResponses.map((resp, idx) => {
                        const isLast = idx === currentWorkState.beaconResponses.length - 1;
                        return (
                          <div key={resp.id}>
                            <p className="text-xs text-muted-foreground mb-1.5 italic">"{resp.query}"</p>
                          <BeaconResponseCard
                            response={resp}
                            innerRef={isLast ? lastResponseRef : undefined}
                            projectId={projectId}
                            objectionId={selected.id}
                            userId={profile?.id}
                            companyId={profile?.company_id}
                          />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Beacon Input */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9 pr-4"
                        placeholder={`Ask Beacon about ${selected.code_reference || "this objection"}...`}
                        value={beaconInput}
                        onChange={(e) => setBeaconInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleBeaconSend(); }}
                        disabled={beaconLoading}
                      />
                    </div>
                    <Button
                      size="icon"
                      className="shrink-0"
                      onClick={handleBeaconSend}
                      disabled={!beaconInput.trim() || beaconLoading}
                    >
                      {beaconLoading ? (
                        <Clock className="h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="h-4 w-4 animate-pulse text-amber-500" />
                      )}
                    </Button>
                  </div>

                  {currentWorkState && currentWorkState.beaconResponses.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      Try: "Pull up {selected.code_reference || 'this section'}" or "How did we handle this before?"
                    </p>
                  )}
                </div>

                <Separator />

                {/* Section B: PM Notes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Your Notes
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={handleCleanUp}
                      disabled={cleanUpLoading || !(currentWorkState?.pmNotes?.trim())}
                    >
                      {cleanUpLoading ? (
                        <Clock className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Clean Up with Beacon
                    </Button>
                  </div>

                  <Textarea
                    className="min-h-[80px] text-sm"
                    placeholder="Write your notes here — interpretation, how it applies, what to tell the architect..."
                    value={currentWorkState?.pmNotes || ""}
                    onChange={(e) => updateWorkState(selected.id, { pmNotes: e.target.value })}
                  />

                  {currentWorkState?.cleanedVersion && (
                    <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-primary" />
                          Beacon's Version
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                            onClick={() => updateWorkState(selected.id, { cleanedVersion: null })}
                          >
                            <X className="h-3 w-3" /> Discard
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 text-[10px] gap-1"
                            onClick={() => {
                              updateWorkState(selected.id, { pmNotes: currentWorkState.cleanedVersion!, cleanedVersion: null });
                              toast({ title: "Beacon's version accepted", description: "Replaced your notes with the polished version." });
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Use This
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        className="min-h-[60px] text-sm bg-background"
                        value={currentWorkState.cleanedVersion}
                        onChange={(e) => updateWorkState(selected.id, { cleanedVersion: e.target.value })}
                      />
                      <p className="text-[10px] text-muted-foreground">Edit if needed, then accept or discard</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Section C: Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleSaveToDocs}>
                    <Save className="h-3.5 w-3.5" /> Save Notes
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleSendAsEmail}>
                    <Mail className="h-3.5 w-3.5" /> Send as Email
                  </Button>
                  <div className="flex-1" />
                  {selected.status !== "in_progress" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 border-amber-400/50 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                      onClick={() => handleStatusChange(selected.id, "in_progress")}
                    >
                      <Clock className="h-3.5 w-3.5" /> Mark In Progress
                    </Button>
                  )}
                  {selected.status !== "resolved" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 border-emerald-400/50 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                      onClick={() => handleStatusChange(selected.id, "resolved")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark Resolved
                    </Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Email Compose */}
      {composeOpen && (
        <ComposeEmailDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          defaultTo={composeDefaults.to}
          defaultSubject={composeDefaults.subject}
          defaultBody={composeDefaults.body}
          defaultAttachments={composeDefaults.attachments}
        />
      )}

      <UploadObjectionDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        projectId={projectId}
      />
    </div>
  );
}

export function useOpenObjectionCount(projectId: string | undefined) {
  const { items } = useObjectionItems(projectId);
  return items.filter((o) => o.status !== "resolved").length;
}
