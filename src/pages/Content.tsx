import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, Sparkles, Check, X, Send, FileText, Mail, Eye, Copy, Pencil,
  TrendingUp, Users, ExternalLink, HelpCircle, Plus, LayoutTemplate,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import {
  useContentCandidates, useGeneratedFor, useGeneratedForMany, usePublishedContent,
  useUpdateCandidateStatus, useGenerateDraft, useSaveDraft, usePublish, useComposeContent,
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
            <div className="flex items-center gap-2">
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
function SourceBadge({ c }: { c: ContentCandidate }) {
  const src = (c.source_type || "").toLowerCase();
  const qCount = c.team_questions_count || 0;
  // "From questions" if the source is a question cluster OR we have team_questions.
  if (src === "question_cluster" || src === "questions" || qCount > 0) {
    return (
      <Badge
        variant="outline"
        className="text-[11px] border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
        title="Derived from your team's real Beacon chat questions"
      >
        📊 {qCount > 0 ? `From ${qCount} question${qCount === 1 ? "" : "s"}` : "From questions"}
      </Badge>
    );
  }
  if (src === "manual" || src === "scratch" || src === "from_scratch") {
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
  c, draft, generatingId, onGenerate, onView, onStatus,
}: {
  c: ContentCandidate;
  draft?: GeneratedContent;
  generatingId: string | null;
  onGenerate: (c: ContentCandidate) => void;
  onView: (c: ContentCandidate) => void;
  onStatus: (c: ContentCandidate, status: string, label: string) => void;
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
          <Button size="sm" variant="outline" onClick={() => onView(c)}><Eye className="h-3.5 w-3.5 mr-1" />Review</Button>
          <Button size="sm" onClick={() => onStatus(c, "approved", "Approved")}><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
        </>
      );
      case "approved": return (
        <Button size="sm" onClick={() => onView(c)}><Send className="h-3.5 w-3.5 mr-1" />Review &amp; Publish</Button>
      );
      case "published": return <Button size="sm" variant="outline" onClick={() => onView(c)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>;
      default: return <Button size="sm" variant="ghost" onClick={() => onStatus(c, "pending", "Restored")}>Restore</Button>;
    }
  };

  const si = (c.search_interest || "").toLowerCase();
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
            {c.priority && <Badge variant="outline" className={`text-[11px] ${priorityClasses(c.priority)}`}>{c.priority}</Badge>}
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
          </div>
          {c.source_url && (
            <a href={c.source_url} target="_blank" rel="noreferrer"
               className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Source
            </a>
          )}
        </div>
      </div>

      {/* metric row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
        {c.relevance_score != null && (
          <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3 text-orange-500" /><strong className="text-foreground">{c.relevance_score}%</strong> relevance</span>
        )}
        {si && si !== "unknown" && (
          <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3 text-blue-500" /><strong className="text-foreground capitalize">{si}</strong> search interest</span>
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
  const [viewing, setViewing] = useState<ContentCandidate | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePreset, setComposePreset] = useState<ContentTemplate | null>(null);

  // Pull all latest drafts for visible candidates so each card can show
  // an inline excerpt + Copy button without N round-trips.
  const candidateIds = useMemo(() => candidates.map((c) => c.id), [candidates]);
  const { data: draftsByCandidate = {} } = useGeneratedForMany(candidateIds);

  const openCompose = (preset: ContentTemplate | null = null) => { setComposePreset(preset); setComposeOpen(true); };

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
                      onGenerate={doGenerate} onView={setViewing} onStatus={setStatus} />
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
    </AppLayout>
  );
}
