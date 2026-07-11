import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Sparkles, FileText, Mail, TrendingUp, HelpCircle, ExternalLink,
  Clock, DollarSign, Lightbulb, ShieldCheck, BarChart3, Search,
} from "lucide-react";
import { safeFormatDate } from "@/lib/dateUtils";
import {
  useContentFunnel,
  useContentGaps,
  useGroundingHealth,
  usePostPerformance,
} from "@/hooks/useContentAnalytics";

// Small stat tile matching the dashboard look elsewhere in the app.
function StatTile({
  label, value, sub, icon: Icon, tone = "text-foreground",
}: {
  label: string; value: string | number; sub?: string;
  icon: any; tone?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${tone}`} />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm text-muted-foreground italic py-6 text-center">
      {children}
    </div>
  );
}

function Section({
  title, subtitle, children, right,
}: {
  title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

const isNewsletter = (t?: string | null) => (t || "").toLowerCase().includes("news");

function confidenceTone(conf: number | null) {
  if (conf == null) return "bg-muted text-muted-foreground";
  if (conf >= 0.7) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
  if (conf >= 0.4) return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400";
}

export function ContentAnalyticsTab() {
  const funnelQ = useContentFunnel();
  const gapsQ = useContentGaps();
  const groundingQ = useGroundingHealth();
  const perfQ = usePostPerformance();

  const loading = funnelQ.isLoading || gapsQ.isLoading || groundingQ.isLoading;
  const funnel = funnelQ.data?.funnel;
  const sourceMix = funnelQ.data?.sourceMix || [];
  const gaps = gapsQ.data || [];
  const grounding = groundingQ.data;
  const perf = perfQ.data;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading analytics…
      </div>
    );
  }

  const conversion =
    funnel && funnel.ideas > 0
      ? Math.round((funnel.published / funnel.ideas) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Publish funnel */}
      <Section
        title="Publish funnel"
        subtitle="Ideas surfaced → drafts written → posts published. Real counts, no estimates."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Ideas" value={funnel?.ideas ?? 0} icon={Lightbulb} tone="text-amber-600" />
          <StatTile label="Drafted" value={funnel?.drafted ?? 0} icon={FileText} tone="text-blue-600" />
          <StatTile
            label="Published"
            value={funnel?.published ?? 0}
            sub={funnel && funnel.ideas > 0 ? `${conversion}% of ideas` : undefined}
            icon={TrendingUp}
            tone="text-emerald-600"
          />
          <StatTile
            label="Median time to publish"
            value={
              funnel?.medianDaysToPublish != null
                ? `${funnel.medianDaysToPublish.toFixed(1)}d`
                : "—"
            }
            sub={funnel?.medianDaysToPublish == null ? "No published posts yet" : undefined}
            icon={Clock}
          />
        </div>
      </Section>

      {/* Post performance (external engagement) */}
      <Section
        title="Post performance"
        subtitle="How each published post is performing in the wild — page views, contact conversions, search impressions."
      >
        {perf?.connected && perf.rows.length > 0 ? (
          <Card className="divide-y">
            {perf.rows.map((r) => (
              <div key={r.id} className="p-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                <div className="md:col-span-2 min-w-0">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {safeFormatDate(r.published_at, "MMM d, yyyy", "Not yet live")}
                    {r.published_url && (
                      <> · <a href={r.published_url} target="_blank" rel="noreferrer" className="underline hover:text-foreground inline-flex items-center gap-0.5">Open <ExternalLink className="h-2.5 w-2.5" /></a></>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold tabular-nums">{r.page_views ?? "—"}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Views</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold tabular-nums">{r.conversions ?? "—"}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Conversions</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold tabular-nums">{r.search_impressions ?? "—"}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Impressions</div>
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <Card className="p-6 flex items-start gap-4 border-dashed">
            <BarChart3 className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">Connect Google Analytics & Search Console</div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                We don't fabricate performance numbers. Once GA4 and Search Console are connected we'll show
                per-post page views, contact conversions (CTA/phone clicks), and search impressions — pulled
                directly from those tools against each post's live URL.
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Button size="sm" variant="outline" asChild>
                  <a href="https://analytics.google.com" target="_blank" rel="noreferrer">
                    <TrendingUp className="h-3.5 w-3.5 mr-1" /> Google Analytics
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer">
                    <Search className="h-3.5 w-3.5 mr-1" /> Search Console
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </div>
            </div>
          </Card>
        )}
      </Section>

      {/* Grounding health (internal quality) + Content gaps side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          title="⭐ Grounding health"
          subtitle="How well-grounded published posts were at generation time. Higher = more KB-sourced, fewer editor fact-guard flags."
        >
          <Card className="p-3 space-y-3">
            {!grounding || grounding.postsWithGrounding === 0 ? (
              <Empty>
                Grounding metrics start once posts generated with the KB-grounding pipeline are published.
              </Empty>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg KB confidence</div>
                    <div className="text-xl font-semibold">
                      {grounding.avgKbConfidence != null ? `${Math.round(grounding.avgKbConfidence * 100)}%` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Clean drafts</div>
                    <div className="text-xl font-semibold">
                      {grounding.cleanDraftPct != null ? `${Math.round(grounding.cleanDraftPct)}%` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Flags resolved</div>
                    <div className="text-xl font-semibold">{grounding.verifyFlagsResolved}</div>
                  </div>
                </div>
                <div className="divide-y border-t -mx-3 px-3">
                  {grounding.perPost.map((p) => {
                    const Icon = isNewsletter(p.content_type) ? Mail : FileText;
                    return (
                      <div key={p.id} className="py-2 flex items-center gap-3 text-sm">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{p.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {safeFormatDate(p.published_at, "MMM d, yyyy", "Not yet live")}
                            {p.ai_cost_usd > 0 && (
                              <> · <DollarSign className="h-3 w-3 inline -mt-0.5" />
                                {p.ai_cost_usd.toFixed(3)}
                              </>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10.5px] ${confidenceTone(p.kb_confidence_avg)}`}>
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          {p.kb_confidence_avg != null ? `${Math.round(p.kb_confidence_avg * 100)}%` : "no grounding"}
                        </Badge>
                        {p.verify_flags_at_generate > 0 && (
                          <span className="text-[10.5px] text-muted-foreground">
                            {p.verify_flags_at_generate} flag{p.verify_flags_at_generate === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </Section>

        <Section
          title="⭐ Content gaps"
          subtitle="Questions Beacon couldn't answer from the KB (no source cited or low confidence). Write these next."
        >
          <Card className="divide-y">
            {gaps.length === 0 && (
              <Empty>No knowledge gaps detected — Beacon is answering everything with sources.</Empty>
            )}
            {gaps.map((g) => (
              <div key={g.cluster} className="p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <HelpCircle className="h-4 w-4 text-orange-500 shrink-0" />
                    <span className="text-sm font-medium truncate">{g.cluster}</span>
                  </div>
                  <Badge variant="outline" className="text-[11px]">
                    {g.question_count} {g.question_count === 1 ? "question" : "questions"}
                  </Badge>
                </div>
                {g.sample_questions.length > 0 && (
                  <ul className="text-xs text-muted-foreground list-disc ml-5 space-y-0.5">
                    {g.sample_questions.map((q, i) => (
                      <li key={i} className="line-clamp-1">{q}</li>
                    ))}
                  </ul>
                )}
                {g.avg_confidence != null && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    avg confidence {Math.round(g.avg_confidence * 100)}%
                  </div>
                )}
              </div>
            ))}
          </Card>
        </Section>
      </div>

      {/* Author / source mix */}
      <Section
        title="Author & source mix"
        subtitle="Manual vs Beacon-generated drafts, by month and content type."
      >
        <Card className="p-3">
          {sourceMix.length === 0 ? (
            <Empty>No drafts yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground text-left">
                    <th className="py-1.5 pr-4 font-medium">Month</th>
                    <th className="py-1.5 pr-4 font-medium">Type</th>
                    <th className="py-1.5 pr-4 font-medium text-right">Manual</th>
                    <th className="py-1.5 pr-4 font-medium text-right">
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-orange-500" /> Beacon
                      </span>
                    </th>
                    <th className="py-1.5 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sourceMix.map((r) => (
                    <tr key={`${r.month}-${r.content_type}`}>
                      <td className="py-1.5 pr-4">{r.month}</td>
                      <td className="py-1.5 pr-4 capitalize">
                        {r.content_type.replace(/_/g, " ")}
                      </td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{r.manual}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{r.beacon}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">
                        {r.manual + r.beacon}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Section>
    </div>
  );
}
