import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Sparkles, Check, X, Send, FileText, Eye, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import {
  useContentCandidates, useGeneratedFor, usePublishedContent,
  useUpdateCandidateStatus, useGenerateDraft, type ContentCandidate,
} from "@/hooks/useContent";

const STAGES: { key: string; label: string; tone: string }[] = [
  { key: "pending", label: "Ideas", tone: "text-foreground" },
  { key: "drafted", label: "Drafted", tone: "text-blue-600" },
  { key: "approved", label: "Approved", tone: "text-emerald-600" },
  { key: "published", label: "Published", tone: "text-purple-600" },
];

function DraftDialog({ candidate, open, onClose }: { candidate: ContentCandidate | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { data: draft, isLoading } = useGeneratedFor(open ? candidate?.id ?? null : null);
  const copy = () => {
    navigator.clipboard.writeText(draft?.content || "");
    toast({ title: "Copied", description: "Paste it into your blog, LinkedIn, or newsletter to publish." });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle className="truncate pr-8">{candidate?.title}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: "70vh" }}>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : draft?.content ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{draft.word_count} words · {draft.content_type?.replace(/_/g, " ")}</p>
                <Button size="sm" variant="outline" onClick={copy}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{draft.content}</ReactMarkdown></div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">No draft yet — generate one from the pipeline.</p>
          )}
        </div>
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
    } catch (e: any) {
      toast({ title: "Generate failed", description: e.message, variant: "destructive" });
    } finally { setGeneratingId(null); }
  };

  const setStatus = (c: ContentCandidate, status: string, label: string) =>
    updateStatus.mutate({ id: c.id, status }, { onSuccess: () => toast({ title: label }) });

  const actionsFor = (c: ContentCandidate) => {
    switch (c.status) {
      case "pending": return (
        <>
          <Button size="sm" disabled={generatingId === c.id} onClick={() => doGenerate(c)}>
            {generatingId === c.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}Generate
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStatus(c, "skipped", "Skipped")}><X className="h-3.5 w-3.5" /></Button>
        </>
      );
      case "drafted": return (
        <>
          <Button size="sm" variant="outline" onClick={() => setViewing(c)}><Eye className="h-3.5 w-3.5 mr-1" />Review</Button>
          <Button size="sm" onClick={() => setStatus(c, "approved", "Approved")}><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>
          <Button size="sm" variant="ghost" onClick={() => setStatus(c, "skipped", "Skipped")}><X className="h-3.5 w-3.5" /></Button>
        </>
      );
      case "approved": return (
        <>
          <Button size="sm" variant="outline" onClick={() => setViewing(c)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
          <Button size="sm" onClick={() => setStatus(c, "published", "Published")}><Send className="h-3.5 w-3.5 mr-1" />Publish</Button>
        </>
      );
      case "published": return <Button size="sm" variant="outline" onClick={() => setViewing(c)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>;
      default: return <Button size="sm" variant="ghost" onClick={() => setStatus(c, "pending", "Restored")}>Restore</Button>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> Content</h1>
          <p className="text-sm text-muted-foreground">Beacon spots content ideas from your KB &amp; team questions. Draft, review, publish.</p>
        </div>

        <Tabs defaultValue="pipeline">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="published">Published ({published.length})</TabsTrigger>
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
                    <Card key={c.id} className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{c.title}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-[10px]">{c.content_type?.replace(/_/g, " ")}</Badge>
                          {c.priority && <Badge variant="secondary" className="text-[10px]">{c.priority}</Badge>}
                          {!!c.team_questions_count && <span className="text-[11px] text-muted-foreground">{c.team_questions_count} team questions</span>}
                        </div>
                        {c.reasoning && <div className="text-sm text-muted-foreground mt-1">{c.reasoning}</div>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">{actionsFor(c)}</div>
                    </Card>
                  ))}
                </div>
              ) : null)
            )}
          </TabsContent>

          <TabsContent value="published" className="mt-4 space-y-2">
            {published.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground text-sm">Nothing published yet.</Card>
            ) : published.map((g) => (
              <Card key={g.id} className="p-3">
                <div className="font-medium">{g.title}</div>
                <div className="text-xs text-muted-foreground">{g.content_type?.replace(/_/g, " ")} · {g.word_count} words</div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <DraftDialog candidate={viewing} open={!!viewing} onClose={() => setViewing(null)} />
    </AppLayout>
  );
}
