import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Loader2, RefreshCcw, BookOpen } from "lucide-react";
import { usePlaybook, useResearchPlaybook, useApplyAIDraftToEmptySlots, useUpdatePlaybookSummary, type AISuggestion } from "@/hooks/usePermitPlaybooks";
import { useMarkets } from "@/hooks/useMarkets";
import QAList from "@/components/playbooks/QAList";
import AttachmentsPanel from "@/components/playbooks/AttachmentsPanel";
import EnrichDiffDialog from "@/components/playbooks/EnrichDiffDialog";
import { useToast } from "@/hooks/use-toast";

export default function PlaybookEditor() {
  const { marketId, id } = useParams<{ marketId: string; id: string }>();
  const { data: playbook, isLoading } = usePlaybook(id);
  const { data: markets = [] } = useMarkets();
  const market = useMemo(() => markets.find((m) => m.id === marketId), [markets, marketId]);
  const research = useResearchPlaybook();
  const applyDraft = useApplyAIDraftToEmptySlots();
  const updateSummary = useUpdatePlaybookSummary();
  const { toast } = useToast();

  const [summaryDraft, setSummaryDraft] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffSuggestions, setDiffSuggestions] = useState<AISuggestion[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      </AppLayout>
    );
  }
  if (!playbook || !market) {
    return (
      <AppLayout>
        <div className="text-center py-12 text-muted-foreground">
          Playbook not found. <Link to="/markets" className="underline">Back to Markets</Link>
        </div>
      </AppLayout>
    );
  }

  const total = playbook.qa.length;
  const verified = playbook.qa.filter((s) => s.verified).length;
  const pct = total ? Math.round((verified / total) * 100) : 0;

  const handleFillEmpty = async () => {
    try {
      const suggestions = await research.mutateAsync({
        playbook, marketName: market.name, state: market.state,
      });
      if (suggestions.length === 0) {
        toast({ title: "Nothing to fill", description: "All slots are already verified or have answers." });
        return;
      }
      const withAnswers = suggestions.filter((s) => s.answer && s.answer.trim());
      if (withAnswers.length === 0) {
        toast({ title: "AI couldn't find confident answers for empty slots." });
        return;
      }
      await applyDraft.mutateAsync({ playbook, suggestions: withAnswers });
      toast({ title: `Filled ${withAnswers.length} slot${withAnswers.length === 1 ? "" : "s"} with AI drafts` });
    } catch (e: any) {
      toast({ title: "Research failed", description: e?.message, variant: "destructive" });
    }
  };

  const handleEnrichAll = async () => {
    setDiffSuggestions([]);
    setDiffOpen(true);
    setDiffLoading(true);
    try {
      // Research every NON-verified slot (refresh existing AI drafts + fill empties)
      const slotIds = playbook.qa.filter((s) => !s.verified).map((s) => s.id);
      const suggestions = await research.mutateAsync({
        playbook, marketName: market.name, state: market.state, slotIds,
      });
      setDiffSuggestions(suggestions);
    } catch (e: any) {
      toast({ title: "Research failed", description: e?.message, variant: "destructive" });
      setDiffOpen(false);
    } finally {
      setDiffLoading(false);
    }
  };

  const currentSummary = summaryDraft ?? playbook.summary ?? "";

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in max-w-4xl">
        <div>
          <Link to="/markets?tab=details" className="text-sm text-muted-foreground inline-flex items-center hover:underline">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Markets
          </Link>
          <div className="flex items-start justify-between gap-3 mt-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                {playbook.permit_type}
              </h1>
              <p className="text-sm text-muted-foreground">
                {market.name}, {market.state}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  verified === total && total > 0
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }
              >
                {verified} of {total} verified ({pct}%)
              </Badge>
              <Button size="sm" variant="outline" onClick={handleFillEmpty} disabled={research.isPending || applyDraft.isPending}>
                {research.isPending && !diffOpen ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                Fill empty with AI
              </Button>
              <Button size="sm" variant="outline" onClick={handleEnrichAll}>
                <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Re-research / enrich
              </Button>
            </div>
          </div>
          <div className="h-1.5 mt-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <Card className="p-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</div>
          <Textarea
            value={currentSummary}
            onChange={(e) => setSummaryDraft(e.target.value)}
            onBlur={() => {
              if (summaryDraft != null && summaryDraft !== (playbook.summary ?? "")) {
                updateSummary.mutate({ id: playbook.id, summary: summaryDraft.trim() || null });
              }
            }}
            rows={2}
            placeholder="One-line summary of this permit in this jurisdiction (optional)…"
          />
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Standard Q&A — green = verified, amber = AI draft, gray = empty
          </div>
          <QAList playbook={playbook} marketName={market.name} state={market.state} />
        </Card>

        <Card className="p-4">
          <AttachmentsPanel playbook={playbook} />
        </Card>
      </div>

      <EnrichDiffDialog
        open={diffOpen}
        onOpenChange={setDiffOpen}
        playbook={playbook}
        suggestions={diffSuggestions}
        loading={diffLoading}
      />
    </AppLayout>
  );
}
