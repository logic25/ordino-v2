import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2, GraduationCap, FileArchive, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Phrases where Beacon explicitly says the knowledge base is missing something.
// These count as a gap regardless of confidence — Google Chat answers often
// score high while still admitting the KB has no guidance.
const GAP_PHRASES = [
  "don't have",
  "do not have",
  "doesn't have",
  "does not have",
  "don't have relevant documents",
  "not in my documents",
  "not in the knowledge base",
  "knowledge base doesn't",
  "knowledge base does not",
  "documents don't contain",
  "documents do not contain",
  "don't cover",
  "no guidance on",
  "no specific guidance",
  "outside my reference",
];

type GapSource = "web" | "gchat" | "ordino-chat" | "other";

const SOURCE_LABEL: Record<GapSource, string> = {
  web: "Web widget",
  gchat: "Google Chat",
  "ordino-chat": "Ordino chat",
  other: "Other",
};

/** Test/diagnostic spaces that should never surface as real gaps. */
const TEST_SPACES = new Set([
  "test",
  "test-session",
  "spaces/x",
  "spaces/test123",
  "spaces/TEST123",
  "spaces/AAAA1234",
  "spaces/DIAGNOSTIC_FAKE",
]);

function sourceOf(space: string | null): GapSource {
  const s = (space ?? "").trim();
  if (s === "ordino-web") return "web";
  if (s === "ordino-chat") return "ordino-chat";
  if (s.startsWith("spaces/")) return "gchat";
  return "other";
}

/** Widget questions arrive as "[Page: Documents] when are TR2s required". */
function splitPageContext(q: string): { page: string | null; text: string } {
  const m = q.match(/^\[Page:\s*([^\]]+)\]\s*(.*)$/);
  if (!m) return { page: null, text: q };
  const page = m[1].trim();
  return { page: page && page.toLowerCase() !== "unknown" ? page : null, text: m[2].trim() };
}

type Row = {
  id: number;
  question: string | null;
  response: string | null;
  confidence: number | null;
  answered: boolean | null;
  command: string | null;
  topic: string | null;
  space_name: string | null;
};

function isGap(r: Row): boolean {
  if (TEST_SPACES.has((r.space_name ?? "").trim())) return false;
  if (r.command === "passive_gap") return true;

  const { text } = splitPageContext((r.question ?? "").trim());
  if (!text || text.startsWith("/") || text.length <= 15) return false;
  const ql = text.toLowerCase();
  if (/^(hi|hello|hey|test|ping|diagnostic)\b/.test(ql)) return false;
  if (r.answered !== true) return false;

  const resp = (r.response ?? "").toLowerCase();
  const admitsMiss = GAP_PHRASES.some((p) => resp.includes(p));

  // Branch 1: Beacon said the KB lacks it — a gap at any confidence.
  if (admitsMiss) return true;
  // Branch 2: low confidence, no clean sourced answer.
  return r.confidence != null && Number(r.confidence) < 0.5;
}

type GapExample = { question: string; page: string | null; source: GapSource };

type Group = {
  topic: string;
  count: number;
  avgConfidence: number;
  examples: GapExample[];
  ids: number[];
  sources: GapSource[];
  gchatCount: number;
};

export function BeaconKbGaps() {
  const qc = useQueryClient();
  const [pending, setPending] = useState<Group | null>(null);
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<string>("teach");
  const [sourceFilter, setSourceFilter] = useState<"all" | GapSource>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["beacon-kb-gaps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beacon_interactions")
        .select("id, question, response, confidence, answered, command, topic, space_name")
        .is("addressed_at" as any, null)
        .order("id", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const sourceCounts = useMemo(() => {
    const counts: Record<GapSource, number> = { web: 0, gchat: 0, "ordino-chat": 0, other: 0 };
    for (const r of (data ?? []).filter(isGap)) counts[sourceOf(r.space_name)]++;
    return counts;
  }, [data]);

  const groups = useMemo<Group[]>(() => {
    if (!data) return [];
    const gaps = data
      .filter(isGap)
      .filter((r) => sourceFilter === "all" || sourceOf(r.space_name) === sourceFilter);
    const map = new Map<string, { topic: string; rows: Row[] }>();
    for (const r of gaps) {
      const topic = (r.topic ?? "uncategorized").trim() || "uncategorized";
      if (!map.has(topic)) map.set(topic, { topic, rows: [] });
      map.get(topic)!.rows.push(r);
    }
    return Array.from(map.values())
      .map((g) => ({
        topic: g.topic,
        count: g.rows.length,
        avgConfidence:
          g.rows.reduce((s, r) => s + Number(r.confidence ?? 0), 0) / g.rows.length,
        examples: g.rows.slice(0, 3).map((r) => {
          const { page, text } = splitPageContext(r.question ?? "");
          return { question: text, page, source: sourceOf(r.space_name) };
        }),
        ids: g.rows.map((r) => r.id),
        sources: [...new Set(g.rows.map((r) => sourceOf(r.space_name)))],
        gchatCount: g.rows.filter((r) => sourceOf(r.space_name) === "gchat").length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [data, sourceFilter]);

  const markAddressed = useMutation({
    mutationFn: async ({ ids, note, method }: { ids: number[]; note: string; method: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const composedNote = `[${method}] ${note}`.trim();
      const { error } = await supabase
        .from("beacon_interactions")
        .update({
          addressed_at: new Date().toISOString(),
          addressed_note: composedNote,
          addressed_by: userRes?.user?.id ?? null,
        } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as addressed");
      qc.invalidateQueries({ queryKey: ["beacon-kb-gaps"] });
      setPending(null);
      setNote("");
      setMethod("teach");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to mark addressed"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> Failed to load gaps: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <Card className="border-dashed bg-muted/30">
          <CardContent className="py-4 text-sm space-y-2">
            <div className="flex items-start gap-2">
              <HelpCircle className="h-4 w-4 mt-0.5 text-[#f59e0b] shrink-0" />
              <div className="space-y-2">
                <p className="font-medium">What is a KB gap?</p>
                <p className="text-muted-foreground">
                  These are questions users asked Beacon — in the web widget, in Google Chat, or
                  in the Ordino chat panel — where Beacon answered with low confidence or said it
                  didn't have the documents to answer well. Grouped by topic so you can fix the
                  underlying knowledge once and clear many at a time.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">How to fix:</strong> open the{" "}
                  <Link to="/beacon?tab=teach" className="underline text-[#f59e0b]">Teach tab</Link>{" "}
                  to add a quick Q&amp;A snippet, or upload supporting docs in{" "}
                  <Link to="/documents" className="underline text-[#f59e0b]">Documents</Link>{" "}
                  (Beacon Knowledge Base folder). Then come back and click{" "}
                  <strong className="text-foreground">Mark addressed</strong> — you'll be asked
                  how you resolved it so the audit trail stays clean.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-[hsl(142,71%,45%)]" />
              No open knowledge-base gaps. Beacon is covering recent questions well.
            </CardContent>
          </Card>
        ) : (
          groups.map((g) => (
            <Card key={g.topic}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base capitalize">{g.topic}</CardTitle>
                  <CardDescription className="flex items-center gap-3 text-xs">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary">{g.count} {g.count === 1 ? "gap" : "gaps"}</Badge>
                      </TooltipTrigger>
                      <TooltipContent>Number of distinct user questions in this topic still unaddressed.</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>Avg confidence {Math.round(g.avgConfidence * 100)}%</span>
                      </TooltipTrigger>
                      <TooltipContent>Beacon's average self-reported confidence on these answers. Lower = bigger gap.</TooltipContent>
                    </Tooltip>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/beacon?tab=teach&teachQ=${encodeURIComponent(g.examples[0] ?? "")}&teachTopic=${encodeURIComponent(g.topic)}`}>
                          <GraduationCap className="h-3.5 w-3.5 mr-1" /> Teach
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add a quick Q&amp;A snippet that answers this topic.</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/documents">
                          <FileArchive className="h-3.5 w-3.5 mr-1" /> Docs
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Upload supporting documents to the Beacon Knowledge Base folder.</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" onClick={() => setPending(g)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark addressed
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Clear this gap from the queue. You'll be asked how you resolved it.</TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {g.examples.map((q, i) => (
                    <li key={i} className="text-muted-foreground border-l-2 border-muted pl-3 flex items-start justify-between gap-2">
                      <span>"{q}"</span>
                      <Button asChild size="sm" variant="ghost" className="shrink-0 h-7 px-2 text-xs">
                        <Link to={`/beacon?tab=teach&teachQ=${encodeURIComponent(q)}&teachTopic=${encodeURIComponent(g.topic)}`}>
                          <GraduationCap className="h-3.5 w-3.5 mr-1" /> Teach
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))
        )}

        <Dialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark "{pending?.topic}" as addressed</DialogTitle>
              <DialogDescription>
                This will clear {pending?.count} gap{pending?.count === 1 ? "" : "s"} from the
                queue. Tell us how you resolved it so the next admin has context.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>How did you address it?</Label>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { v: "teach", l: "Added Teach snippet" },
                    { v: "docs", l: "Uploaded document(s)" },
                    { v: "config", l: "Tuned Beacon config" },
                    { v: "other", l: "Other / N/A" },
                  ].map((opt) => (
                    <label
                      key={opt.v}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer ${
                        method === opt.v ? "border-[#f59e0b] bg-[#f59e0b]/5" : "border-input"
                      }`}
                    >
                      <input
                        type="radio"
                        name="method"
                        value={opt.v}
                        checked={method === opt.v}
                        onChange={() => setMethod(opt.v)}
                        className="accent-[#f59e0b]"
                      />
                      {opt.l}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressed-note">Notes (what was added / why)</Label>
                <Textarea
                  id="addressed-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Added Teach snippet covering Spring Valley filing fees and uploaded the 2024 fee schedule PDF."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
              <Button
                disabled={markAddressed.isPending || !note.trim()}
                onClick={() => {
                  if (!pending) return;
                  markAddressed.mutate({ ids: pending.ids, note: note.trim(), method });
                }}
              >
                {markAddressed.isPending ? "Saving…" : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
