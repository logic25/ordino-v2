import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2, Sparkles, Check, X, Send, FileText, Mail, Eye, Copy, Pencil,
  Users, ExternalLink, HelpCircle, Plus, LayoutTemplate, Trash2, ImagePlus, Upload, Target,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useContentCandidates, useGeneratedFor, useGeneratedForMany, usePublishedContent,
  useUpdateCandidateStatus, useGenerateDraft, useSaveDraft, usePublish, useComposeContent,
  useQuickGenerate, useDeleteCandidate, useSetCoverImage,
  type ContentCandidate, type GeneratedContent,
} from "@/hooks/useContent";
import { CONTENT_TEMPLATES, type ContentTemplate } from "@/lib/contentTemplates";

const STAGES: { key: string; label: string; tone: string }[] = [
  { key: "pending", label: "Ideas", tone: "text-foreground" },
  { key: "drafted", label: "Drafted", tone: "text-blue-600" },
  { key: "approved", label: "Approved", tone: "text-emerald-600" },
  { key: "published", label: "Published", tone: "text-purple-600" },
];

const isNewsletter = (t?: string | null) => (t || "").toLowerCase().includes("news");
const typeLabel = (t?: string | null) => (isNewsletter(t) ? "Newsletter" : "Blog Post");
const TypeIcon = ({ t, className }: { t?: string | null; className?: string }) =>
  isNewsletter(t) ? <Mail className={className} /> : <FileText className={className} />;

function priorityClasses(p?: string | null) {
  switch ((p || "").toLowerCase()) {
    case "high": return "bg-orange-100 text-orange-700 border-orange-200";
    case "medium": return "bg-amber-50 text-amber-700 border-amber-200";
    default: return "bg-muted text-muted-foreground";
  }
}

// Hover-explained priority tier. Tiers are editorial — derived from team-question
// volume + client value (manual on seed; Beacon recomputes for auto candidates).
const PRIORITY_TOOLTIPS: Record<string, { label: string; body: string }> = {
  high: {
    label: "High priority",
    body: "Many real team questions (typically 40+) and high client value. Write this next — strong demand signal from your Beacon chat history.",
  },
  medium: {
    label: "Medium priority",
    body: "Consistent but lower-volume team interest (roughly 15–40 questions). Worth writing once the High pile is clear.",
  },
  low: {
    label: "Low priority",
    body: "Niche topics with few team questions (under ~15). Still on-brand for the firm — good for breadth, not urgency.",
  },
};

function PriorityBadge({ priority }: { priority: string }) {
  const key = (priority || "").toLowerCase();
  const info = PRIORITY_TOOLTIPS[key];
  const badge = (
    <Badge variant="outline" className={`text-[11px] capitalize cursor-help ${priorityClasses(priority)}`}>
      {priority}
    </Badge>
  );
  if (!info) return badge;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild><button type="button" className="inline-flex">{badge}</button></TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-xs z-[100]" sideOffset={6}>
        <div className="font-semibold text-xs mb-0.5">{info.label}</div>
        <div className="text-xs text-muted-foreground">{info.body}</div>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Cover image picker: searches free Unsplash/Pexels via stock-photos edge
// function (server holds the keys). On pick, prepends ![alt](url) to the
// draft body and appends the required photographer attribution line.
// Falls back to a manual upload into the `content-images` storage bucket.
type StockPhoto = {
  id: string; source: "unsplash" | "pexels";
  thumb: string; full: string;
  photographer: string; photographer_url: string;
  attribution: string; alt: string;
};
function CoverImagePicker({
  candidate, draft, body, onApply,
}: {
  candidate: ContentCandidate;
  draft: GeneratedContent;
  body: string;
  onApply: (nextBody: string, url: string, attribution: string) => void;
}) {
  const { toast } = useToast();
  const setCover = useSetCoverImage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && !query) {
      // seed query from key_topics or title
      const seed = (candidate.key_topics?.[0] || candidate.title || "construction").toString();
      setQuery(seed);
      runSearch(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setWarning(undefined);
    try {
      const { data, error } = await supabase.functions.invoke(`stock-photos?q=${encodeURIComponent(q)}`, { method: "GET" as any });
      if (error) throw new Error(error.message);
      setPhotos((data as any)?.photos || []);
      setWarning((data as any)?.warning);
    } catch (e: any) {
      setWarning(e.message || "Search failed");
      setPhotos([]);
    } finally { setLoading(false); }
  };

  const insertImage = (url: string, alt: string, attribution: string) => {
    // Strip any prior cover-image block we previously inserted (idempotent re-apply).
    const stripped = body
      .replace(/^!\[[^\]]*\]\([^)]+\)\n+(\*Photo by [^\n]+\*\n+)?/m, "");
    const next = `![${alt}](${url})\n\n*${attribution}*\n\n${stripped}`;
    onApply(next, url, attribution);
    setCover.mutate({ draftId: draft.id, candidateId: candidate.id, url, attribution });
    toast({ title: "Cover image added", description: "Photographer credit was appended to the post." });
    setOpen(false);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${candidate.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("content-images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("content-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;
      insertImage(signed.signedUrl, candidate.title || "Cover image", `Image uploaded by Green Light Expediting`);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ImagePlus className="h-3.5 w-3.5 mr-1" />
        {draft.cover_image_url ? "Change cover" : "Add cover image"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ImagePlus className="h-4 w-4" /> Cover image</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search free photos — Unsplash + Pexels"
                onKeyDown={(e) => { if (e.key === "Enter") runSearch(query); }} />
              <Button size="sm" onClick={() => runSearch(query)} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
              </Button>
              <Button size="sm" variant="outline" asChild disabled={uploading}>
                <label className="cursor-pointer">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                  Upload
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                </label>
              </Button>
            </div>

            {warning && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded px-2 py-1.5">
                {warning}
              </p>
            )}

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : photos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No results yet. Try a search above or upload your own image.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto">
                {photos.map((p) => (
                  <button key={p.id} type="button"
                    onClick={() => insertImage(p.full, p.alt, p.attribution)}
                    className="group relative rounded-md overflow-hidden border hover:ring-2 hover:ring-orange-400 transition">
                    <img src={p.thumb} alt={p.alt} className="w-full h-32 object-cover" loading="lazy" />
                    <div className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] px-1.5 py-1 truncate text-left">
                      {p.photographer} · {p.source}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


// ── Preview / Review modal with inline edit + publish ───────────────────────
function PreviewDialog({
  candidate, open, onClose,
}: { candidate: ContentCandidate | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { data: draft, isLoading } = useGeneratedFor(open ? candidate?.id ?? null : null);
  const saveDraft = useSaveDraft();
  const publish = usePublish();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState("");

  useEffect(() => { if (draft?.content != null) setBody(draft.content); }, [draft?.content]);
  useEffect(() => { if (!open) setEditing(false); }, [open]);

  const copy = () => {
    navigator.clipboard.writeText(body || "");
    toast({ title: "Copied", description: "Paste it into your site, LinkedIn, or newsletter to publish." });
  };
  const save = async () => {
    if (!draft) return;
    await saveDraft.mutateAsync({ id: draft.id, candidateId: candidate!.id, content: body });
    setEditing(false);
    toast({ title: "Saved", description: "Your edits are stored." });
  };
  const doPublish = async () => {
    if (!draft) return;
    if (editing) await save();
    await publish.mutateAsync({ draftId: draft.id, candidateId: candidate!.id });
    toast({ title: "Published", description: "Marked as published. Copy it into your site to go live." });
    onClose();
  };

  const words = body.split(/\s+/).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <Eye className="h-4 w-4 text-orange-500 shrink-0" />
            <span className="truncate">Preview: {candidate?.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-[11px]">
            <TypeIcon t={candidate?.content_type} className="h-3 w-3" /> {typeLabel(candidate?.content_type)}
          </Badge>
          {candidate?.priority && (
            <Badge variant="outline" className={`text-[11px] ${priorityClasses(candidate.priority)}`}>{candidate.priority}</Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{words} words</span>
        </div>

        <div className="flex-1 overflow-y-auto rounded-md border bg-muted/30 p-4" style={{ maxHeight: "62vh" }}>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !draft?.content ? (
            <p className="text-sm text-muted-foreground text-center py-10">No draft yet — generate one from the pipeline.</p>
          ) : editing ? (
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[50vh] font-mono text-sm" />
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{body}</ReactMarkdown></div>
          )}
        </div>

        {draft?.content && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose}><X className="h-3.5 w-3.5 mr-1" /> Close</Button>
            <div className="flex items-center gap-2 flex-wrap">
              {candidate && draft && (
                <CoverImagePicker
                  candidate={candidate}
                  draft={draft}
                  body={body}
                  onApply={(next) => { setBody(next); if (!editing) setEditing(true); }}
                />
              )}
              <Button variant="outline" size="sm" onClick={copy}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
              {editing ? (
                <Button variant="outline" size="sm" onClick={save} disabled={saveDraft.isPending}>
                  {saveDraft.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />} Save edits
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
              )}
              <Button size="sm" onClick={doPublish} disabled={publish.isPending}>
                {publish.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />} Publish
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Source badge: where did this idea come from? ────────────────────────────
// "From N questions" is now a popover button that shows the actual team questions
// that clustered into this idea (when we have them).
function SourceBadge({ c }: { c: ContentCandidate }) {
  const src = (c.source_type || "").toLowerCase();
  const qCount = c.team_questions_count || 0;
  const isQuestionCluster = src === "question_cluster" || src === "questions" || qCount > 0;
  const isManual = src === "manual" || src === "scratch" || src === "from_scratch";

  if (isQuestionCluster) {
    const label = `📊 ${qCount > 0 ? `From ${qCount} question${qCount === 1 ? "" : "s"}` : "From questions"}`;
    const questions = c.team_questions || [];
    const badgeClass =
      "cursor-pointer text-[11px] border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50";

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            title="Click to see the actual team questions behind this idea"
          >
            <Badge variant="outline" className={badgeClass}>{label}</Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[420px] max-h-[60vh] overflow-y-auto">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Team questions ({qCount || questions.length})
          </div>
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {qCount > 0
                ? `Beacon counted ${qCount} questions in this cluster but the originals weren't saved with this candidate. Re-run the question-clustering job to attach them.`
                : "No team questions recorded for this idea."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {questions.map((q, i) => (
                <li key={i} className="text-sm text-foreground/90 flex gap-2">
                  <span className="text-muted-foreground/60 select-none">{i + 1}.</span>
                  <span className="break-words">{q}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 pt-2 border-t text-[11px] text-muted-foreground">
            Sourced from your team's real Beacon chat history. Higher counts → stronger client demand signal.
          </p>
        </PopoverContent>
      </Popover>
    );
  }

  if (isManual) {
    return (
      <Badge
        variant="outline"
        className="text-[11px] text-muted-foreground"
        title="Composed manually, not derived from team questions"
      >
        ✍️ From scratch
      </Badge>
    );
  }
  return null;
}

// ── Idea card ───────────────────────────────────────────────────────────────
function IdeaCard({
  c, draft, generatingId, canDelete, onGenerate, onView, onStatus, onDelete,
}: {
  c: ContentCandidate;
  draft?: GeneratedContent;
  generatingId: string | null;
  canDelete: boolean;
  onGenerate: (c: ContentCandidate) => void;
  onView: (c: ContentCandidate) => void;
  onStatus: (c: ContentCandidate, status: string, label: string) => void;
  onDelete: (c: ContentCandidate) => void;
}) {
  const { toast } = useToast();

  const copyDraft = async () => {
    if (!draft?.content) {
      toast({ title: "Nothing to copy yet", description: "Generate a draft first." });
      return;
    }
    try {
      await navigator.clipboard.writeText(draft.content);
      toast({ title: "Copied", description: "Paste it into your site / LinkedIn / newsletter to publish." });
    } catch {
      toast({ title: "Copy failed", description: "Browser blocked clipboard access.", variant: "destructive" });
    }
  };

  const actions = () => {
    const regenerate = draft?.content ? (
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0"
        disabled={generatingId === c.id}
        onClick={() => onGenerate(c)}
        title="Regenerate draft from Beacon"
      >
        {generatingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      </Button>
    ) : null;
    switch (c.status) {
      case "pending": return (
        <>
          <Button size="sm" disabled={generatingId === c.id} onClick={() => onGenerate(c)}>
            {generatingId === c.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}Generate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onStatus(c, "skipped", "Skipped")}><X className="h-3.5 w-3.5" /></Button>
        </>
      );
      case "drafted": return (
        <>
          {regenerate}
          <Button size="sm" variant="outline" onClick={() => onView(c)}><Eye className="h-3.5 w-3.5 mr-1" />Review</Button>
          <Button size="sm" onClick={() => onStatus(c, "approved", "Approved")}><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
        </>
      );
      case "approved": return (
        <>
          {regenerate}
          <Button size="sm" onClick={() => onView(c)}><Send className="h-3.5 w-3.5 mr-1" />Review &amp; Publish</Button>
        </>
      );
      case "published": return <Button size="sm" variant="outline" onClick={() => onView(c)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>;
      default: return <Button size="sm" variant="ghost" onClick={() => onStatus(c, "pending", "Restored")}>Restore</Button>;
    }
  };

  // Inline excerpt of the latest draft body (strip leading markdown header).
  const excerpt = useMemo(() => {
    const raw = draft?.content || "";
    if (!raw) return "";
    const cleaned = raw
      .replace(/^#{1,6}\s+.*$/m, "")
      .replace(/^\s*\n+/, "")
      .replace(/[*_`>#]/g, "")
      .trim();
    return cleaned.length > 240 ? cleaned.slice(0, 240).trimEnd() + "…" : cleaned;
  }, [draft?.content]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {c.priority && <PriorityBadge priority={c.priority} />}
            <Badge variant="outline" className="gap-1 text-[11px]"><TypeIcon t={c.content_type} className="h-3 w-3" /> {typeLabel(c.content_type)}</Badge>
            <SourceBadge c={c} />
          </div>
          <div className="font-semibold leading-snug">{c.title}</div>
          {c.reasoning && <div className="text-sm text-muted-foreground">{c.reasoning}</div>}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            {draft?.content && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={copyDraft}
                title="Copy draft body to clipboard"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
            {actions()}
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(c)}
                title="Delete idea and all of its drafts (permanent)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {c.source_url && (
            <a href={c.source_url} target="_blank" rel="noreferrer"
               className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Source
            </a>
          )}
        </div>
      </div>

      {/* Metric row — only honest signals. relevance is editorial ("fit"),
          team_questions_count is real Beacon chat volume. search_interest
          was manual/fake and is intentionally NOT rendered anymore. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
        {c.relevance_score != null && (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 cursor-help">
                <Target className="h-3 w-3 text-orange-500" />
                <strong className="text-foreground">{c.relevance_score}%</strong> fit
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs z-[100]">
              Editorial "fit for Green Light" score — manual heuristic on the seed,
              not a live SEO metric.
            </TooltipContent>
          </Tooltip>
        )}
        {!!c.team_questions_count && (
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-purple-500" /><strong className="text-foreground">{c.team_questions_count}</strong> team questions</span>
        )}
        {draft?.word_count != null && (
          <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /><strong className="text-foreground">{draft.word_count}</strong> words</span>
        )}
      </div>


      {/* Inline draft excerpt — makes generated posts actually render on the page */}
      {excerpt && (
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Latest draft preview</span>
            <button
              onClick={() => onView(c)}
              className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Eye className="h-3 w-3" /> Open full draft
            </button>
          </div>
          <p className="text-[13px] text-foreground/80 whitespace-pre-wrap break-words leading-snug">{excerpt}</p>
        </div>
      )}

      {/* topic tags */}
      {!!c.key_topics?.length && (
        <div className="flex flex-wrap gap-1.5">
          {c.key_topics.map((t) => <Badge key={t} variant="secondary" className="text-[10px] font-normal">{t}</Badge>)}
        </div>
      )}

      {/* review question */}
      {c.review_question && (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400"><HelpCircle className="h-3 w-3" /> Review Question</div>
          <div className="text-sm text-foreground/90 mt-0.5">{c.review_question}</div>
        </div>
      )}

      {/* common team questions */}
      {!!c.team_questions?.length && (
        <div>
          <div className="text-[11px] font-semibold text-muted-foreground">Common team questions:</div>
          <ul className="mt-1 space-y-0.5">
            {c.team_questions.slice(0, 4).map((q, i) => (
              <li key={i} className="text-[13px] text-muted-foreground flex gap-1.5"><span className="text-muted-foreground/50">•</span>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ── Compose from scratch (optionally seeded by a template) ──────────────────
function ComposeDialog({
  open, onClose, preset, onComposed,
}: {
  open: boolean;
  onClose: () => void;
  preset: ContentTemplate | null;
  onComposed: (c: ContentCandidate) => void;
}) {
  const { toast } = useToast();
  const compose = useComposeContent();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"blog_post" | "newsletter">("blog_post");
  const [templateId, setTemplateId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setTitle("");
      setType(preset?.content_type ?? "blog_post");
      setTemplateId(preset?.id ?? "");
    }
  }, [open, preset]);

  const tmpl = CONTENT_TEMPLATES.find((t) => t.id === templateId);

  const submit = async () => {
    if (!title.trim()) { toast({ title: "Add a title first", variant: "destructive" }); return; }
    const c = await compose.mutateAsync({ title: title.trim(), content_type: type, body: tmpl?.body ?? `# ${title.trim()}\n\n` });
    toast({ title: "Draft created", description: "Opening the editor…" });
    onClose();
    onComposed(c);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Compose from Scratch</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New DOB NOW filing requirement for 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <div className="flex gap-1.5 mt-1">
                <Button type="button" size="sm" variant={type === "blog_post" ? "default" : "outline"} onClick={() => setType("blog_post")} className="flex-1"><FileText className="h-3.5 w-3.5 mr-1" />Blog</Button>
                <Button type="button" size="sm" variant={type === "newsletter" ? "default" : "outline"} onClick={() => setType("newsletter")} className="flex-1"><Mail className="h-3.5 w-3.5 mr-1" />Newsletter</Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Template</label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border bg-background px-2 text-sm">
                <option value="">Blank</option>
                {CONTENT_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </div>
          </div>
          {tmpl && <p className="text-xs text-muted-foreground">{tmpl.description}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={compose.isPending}>
            {compose.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Pencil className="h-4 w-4 mr-1" />}Create draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Content() {
  const { toast } = useToast();
  const { data: candidates = [], isLoading } = useContentCandidates();
  const { data: published = [] } = usePublishedContent();
  const updateStatus = useUpdateCandidateStatus();
  const generate = useGenerateDraft();
  const deleteCandidate = useDeleteCandidate();
  const { isAdmin, userRoles } = usePermissions();
  // Gate hard-delete to admin/manager only, consistent with the other write actions.
  const canDelete = isAdmin || userRoles.some((r) => /manager/i.test(r));
  const [viewing, setViewing] = useState<ContentCandidate | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePreset, setComposePreset] = useState<ContentTemplate | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContentCandidate | null>(null);

  // Pull all latest drafts for visible candidates so each card can show
  // an inline excerpt + Copy button without N round-trips.
  const candidateIds = useMemo(() => candidates.map((c) => c.id), [candidates]);
  const { data: draftsByCandidate = {} } = useGeneratedForMany(candidateIds);

  const openCompose = (preset: ContentTemplate | null = null) => { setComposePreset(preset); setComposeOpen(true); };

  // "+ Write about…" — ad-hoc topic + immediate Beacon generation.
  const quickGen = useQuickGenerate();
  const [quickTopic, setQuickTopic] = useState("");
  const submitQuick = async () => {
    const title = quickTopic.trim();
    if (!title) return;
    try {
      const cand = await quickGen.mutateAsync({ title, content_type: "blog_post" });
      setQuickTopic("");
      toast({ title: "Draft generated", description: `"${title}" is ready to review.` });
      setViewing(cand);
    } catch (e: any) {
      toast({ title: "Generate failed", description: e.message, variant: "destructive" });
    }
  };

  const byStage = useMemo(() => {
    const g: Record<string, ContentCandidate[]> = { pending: [], drafted: [], approved: [], published: [], skipped: [] };
    for (const c of candidates) (g[c.status] ?? (g[c.status] = [])).push(c);
    return g;
  }, [candidates]);

  const doGenerate = async (c: ContentCandidate) => {
    setGeneratingId(c.id);
    try {
      await generate.mutateAsync(c);
      toast({ title: "Draft generated", description: `"${c.title}" is ready to review.` });
      setViewing(c); // auto-open the preview, like the Beacon dashboard
    } catch (e: any) {
      toast({ title: "Generate failed", description: e.message, variant: "destructive" });
    } finally { setGeneratingId(null); }
  };

  const setStatus = (c: ContentCandidate, status: string, label: string) =>
    updateStatus.mutate({ id: c.id, status }, { onSuccess: () => toast({ title: label }) });

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="h-6 w-6 text-orange-500" /> Content Intelligence</h1>
            <p className="text-sm text-muted-foreground">AI-identified content opportunities from your knowledge base &amp; team questions. Draft, review, publish.</p>
          </div>
          <Button onClick={() => openCompose(null)}><Plus className="h-4 w-4 mr-1" /> Compose from Scratch</Button>
        </div>

        {/* "+ Write about…" — ad-hoc topic that creates a manual candidate and drafts it immediately via Beacon */}
        <Card className="p-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-orange-500 shrink-0" />
          <Input
            value={quickTopic}
            onChange={(e) => setQuickTopic(e.target.value)}
            placeholder="+ Write about…  (e.g. New DOB NOW filing requirement, FDNY sprinkler shop drawings)"
            className="border-0 focus-visible:ring-0 shadow-none px-1"
            onKeyDown={(e) => { if (e.key === "Enter") submitQuick(); }}
            disabled={quickGen.isPending}
          />
          <Button size="sm" onClick={submitQuick} disabled={!quickTopic.trim() || quickGen.isPending}>
            {quickGen.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            Generate
          </Button>
        </Card>

        <Tabs defaultValue="pipeline">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="published">Published ({published.length})</TabsTrigger>
            <TabsTrigger value="templates">Templates ({CONTENT_TEMPLATES.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="mt-4 space-y-5">
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : candidates.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground text-sm">
                No content ideas yet. Beacon generates them from team questions &amp; ingested DOB updates.
              </Card>
            ) : (
              STAGES.map((s) => byStage[s.key]?.length ? (
                <div key={s.key} className="space-y-2">
                  <div className={`text-xs font-semibold uppercase tracking-wide ${s.tone}`}>{s.label} ({byStage[s.key].length})</div>
                  {byStage[s.key].map((c) => (
                    <IdeaCard key={c.id} c={c} draft={draftsByCandidate[c.id]} generatingId={generatingId}
                      canDelete={canDelete}
                      onGenerate={doGenerate} onView={setViewing} onStatus={setStatus}
                      onDelete={setConfirmDelete} />

                  ))}
                </div>
              ) : null)
            )}
          </TabsContent>

          <TabsContent value="published" className="mt-4 space-y-2">
            {published.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground text-sm">Nothing published yet.</Card>
            ) : published.map((g) => (
              <Card key={g.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{g.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <TypeIcon t={g.content_type} className="h-3 w-3" /> {typeLabel(g.content_type)} · {g.word_count} words
                  </div>
                </div>
                {g.published_url && (
                  <a href={g.published_url} target="_blank" rel="noreferrer"
                     className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0">
                    <ExternalLink className="h-3 w-3" /> Live
                  </a>
                )}
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="templates" className="mt-4 space-y-4">
            <Card className="p-4 bg-muted/30">
              <div className="font-semibold flex items-center gap-2"><LayoutTemplate className="h-4 w-4" /> Content Templates</div>
              <p className="text-sm text-muted-foreground mt-0.5">Pre-built structures for common content types. Pick one to get a head start.</p>
            </Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CONTENT_TEMPLATES.map((t) => (
                <Card key={t.id} className="p-4 flex flex-col">
                  <div className="flex items-center gap-2 font-semibold"><span>{t.icon}</span>{t.name}</div>
                  <Badge variant="secondary" className="text-[10px] w-fit mt-1.5">{t.category}</Badge>
                  <p className="text-sm text-muted-foreground mt-2 flex-1">{t.description}</p>
                  <pre className="mt-3 max-h-28 overflow-hidden rounded bg-muted/60 p-2 text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap">{t.body.split("\n").slice(0, 6).join("\n")}</pre>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => openCompose(t)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Use template
                  </Button>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <PreviewDialog candidate={viewing} open={!!viewing} onClose={() => setViewing(null)} />
      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} preset={composePreset} onComposed={setViewing} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this idea?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title}" and any drafts generated from it will be permanently removed.
              This can't be undone. (Use the X button on a card to just skip it instead.)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDelete) return;
                const c = confirmDelete;
                setConfirmDelete(null);
                try {
                  await deleteCandidate.mutateAsync(c.id);
                  toast({ title: "Deleted", description: `"${c.title}" was removed.` });
                } catch (e: any) {
                  toast({ title: "Delete failed", description: e.message, variant: "destructive" });
                }
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>

  );
}
