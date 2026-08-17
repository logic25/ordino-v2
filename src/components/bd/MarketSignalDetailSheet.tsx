import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, RefreshCw, Sparkles, UserPlus, AlertTriangle, ChevronDown, ChevronRight, Lightbulb, Newspaper } from "lucide-react";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { safeFormatDate } from "@/lib/dateUtils";
import {
  enrichSignal, gleGapOf, incumbentOf, whoWeKnowLines, whoWeKnowProjects, type SignalLead,
} from "@/services/signalEnrichment";

export type MarketSignal = {
  id: string;
  company_id: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  sender: string | null;
  signal_date: string | null;
  status: string;
  created_at: string;
  enrichment?: unknown;
  enriched_at?: string | null;
};

function cachedLeads(signal: MarketSignal): SignalLead[] | null {
  const raw: any = signal.enrichment;
  if (!raw) return null;
  const leads = Array.isArray(raw) ? raw : Array.isArray(raw?.leads) ? raw.leads : null;
  return leads as SignalLead[] | null;
}

function cachedStory(signal: MarketSignal): string {
  const raw: any = signal.enrichment;
  return typeof raw?.story === "string" ? raw.story : "";
}

function cachedArticleUrls(signal: MarketSignal): string[] {
  const raw: any = signal.enrichment;
  return Array.isArray(raw?.article_urls)
    ? raw.article_urls.filter((u: unknown) => typeof u === "string" && u.trim())
    : [];
}

// Fallback: if Beacon returned no article links, use the signal's own source URL
// plus any http(s) links found in the title/summary text.
function fallbackArticleUrls(signal: MarketSignal | null): string[] {
  if (!signal) return [];
  const found = `${signal.title ?? ""}\n${signal.summary ?? ""}`.match(/https?:\/\/[^\s<>")\]]+/g) ?? [];
  const all = [signal.source_url ?? "", ...found].map((u) => u.trim()).filter(Boolean);
  return Array.from(new Set(all));
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground shrink-0 w-40">{label}</span>
      <span className="min-w-0">{value}</span>
    </div>
  );
}

function FullStory({ story }: { story: string }) {
  const [open, setOpen] = useState(false);
  if (!story.trim()) return null;
  return (
    <div className="mt-4 border rounded-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Full story
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t max-h-[45vh] overflow-y-auto">
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
            {story}
          </p>
        </div>
      )}
    </div>
  );
}

function ArticleLinks({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) return null;
  return (
    <div className="mt-4 border rounded-md">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Newspaper className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Read the article</span>
      </div>
      <ul className="divide-y">
        {urls.map((url, i) => (
          <li key={`${url}-${i}`}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
            >
              <span className="truncate text-primary">{domainFromUrl(url)}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OpportunityCard({ lead, onPromote }: { lead: SignalLead; onPromote: () => void }) {
  const incumbent = incumbentOf(lead);
  const gap = gleGapOf(lead);
  const who = whoWeKnowLines(lead.who_we_know);
  const whoProjects = whoWeKnowProjects(lead);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold leading-tight">{lead.party}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{lead.address || "—"}</div>
          </div>
          <Button size="sm" variant="outline" className="shrink-0" onClick={onPromote}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Create lead
          </Button>
        </div>
        {lead.deal_type && (
          <Badge variant="secondary" className="font-normal">{lead.deal_type}</Badge>
        )}
        {lead.angle && <p className="text-sm whitespace-pre-wrap">{lead.angle}</p>}
        {lead.why && (
          <div className="flex gap-2 rounded-md border-l-2 border-primary bg-muted/40 px-3 py-2">
            <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm whitespace-pre-wrap">
              <span className="font-medium">Why: </span>
              {lead.why}
            </p>
          </div>
        )}
        {(lead.property?.owner || incumbent || gap || who.length > 0 || whoProjects.length > 0) && (
          <div className="space-y-1 pt-1 border-t">
            {lead.property?.owner && <Field label="Owner" value={lead.property.owner} />}
            {incumbent && <Field label="Incumbent expediter" value={incumbent} />}
            {gap && <Field label="GLE gap" value={gap} />}
            {who.length > 0 && <Field label="Who we know" value={who.join("; ")} />}
            {whoProjects.length > 0 && (
              <div className="flex gap-2 text-sm">
                <span className="text-muted-foreground shrink-0 w-40">Related projects</span>
                <div className="min-w-0 space-y-0.5">
                  {whoProjects.map((p, i) =>
                    p.id ? (
                      <Link
                        key={`${p.id}-${p.role ?? ""}-${i}`}
                        to={`/projects/${p.id}`}
                        className="block truncate text-primary hover:underline"
                      >
                        {p.project || "Untitled project"}
                        {p.role ? ` (${p.role})` : ""}
                      </Link>
                    ) : (
                      <div key={`noid-${i}`} className="truncate text-muted-foreground">
                        {p.project || "Untitled project"}
                        {p.role ? ` (${p.role})` : ""}
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MarketSignalDetailSheet({
  signal, open, onOpenChange, onPromote,
}: {
  signal: MarketSignal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPromote: (signal: MarketSignal, lead: SignalLead) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [leads, setLeads] = useState<SignalLead[] | null>(null);
  const [story, setStory] = useState<string>("");
  const [articleUrls, setArticleUrls] = useState<string[]>([]);

  const analyze = useMutation({
    mutationFn: async (s: MarketSignal) => {
      const text = [s.title, s.summary, s.source_url].filter(Boolean).join("\n\n");
      const result = await enrichSignal(text);
      await supabase
        .from("bd_market_signals" as any)
        .update({ enrichment: result as any, enriched_at: new Date().toISOString() })
        .eq("id", s.id);
      return result;
    },
    onSuccess: (result) => {
      setLeads(result.leads);
      setStory(result.story ?? "");
      setArticleUrls(result.article_urls ?? []);
      qc.invalidateQueries({ queryKey: ["bd-market-signals"] });
    },
    onError: (e: any) =>
      toast({
        title: "Analysis failed",
        description: e?.message ?? "Beacon could not read this signal.",
        variant: "destructive",
      }),
  });

  // Load from cache when opening; otherwise analyze once.
  useEffect(() => {
    if (!open || !signal) return;
    const cached = cachedLeads(signal);
    if (cached) {
      setLeads(cached);
      setStory(cachedStory(signal));
      setArticleUrls(cachedArticleUrls(signal));
    } else {
      setLeads(null);
      setStory("");
      setArticleUrls([]);
      analyze.mutate(signal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signal?.id]);

  const running = analyze.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {signal && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="pr-8 leading-snug">{signal.title}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {signal.signal_date && (
                    <span>{safeFormatDate(signal.signal_date, "MMM d, yyyy")}</span>
                  )}
                  {signal.sender && <span>From {signal.sender}</span>}
                  {signal.source_url && (
                    <a href={signal.source_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline">
                      Source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </SheetDescription>
            </SheetHeader>

            {signal.summary && (
              <p className="text-sm whitespace-pre-wrap mt-4 text-muted-foreground">
                {signal.summary}
              </p>
            )}

            <FullStory story={story} />
            <ArticleLinks urls={articleUrls.length ? articleUrls : fallbackArticleUrls(signal)} />

            <Separator className="my-5" />

            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium text-sm flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                Opportunities in this signal
              </h3>
              <Button size="sm" variant="ghost" disabled={running}
                onClick={() => analyze.mutate(signal)}>
                {running ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                {leads ? "Re-analyze" : "Analyze signal"}
              </Button>
            </div>

            <div className="mt-3 space-y-3 pb-8">
              {running ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Reading the linked article and matching it against our filings — this can take
                    a few seconds.
                  </p>
                  <Skeleton className="h-28 w-full" />
                  <Skeleton className="h-28 w-full" />
                </>
              ) : analyze.isError && !leads ? (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  Analysis unavailable. Try Re-analyze.
                </div>
              ) : leads && leads.length > 0 ? (
                leads.map((lead, i) => (
                  <OpportunityCard
                    key={`${lead.party}-${i}`}
                    lead={lead}
                    onPromote={() => onPromote(signal, lead)}
                  />
                ))
              ) : leads ? (
                <p className="text-sm text-muted-foreground">
                  No concrete permit opportunities in this signal.
                </p>
              ) : null}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
