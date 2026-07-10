import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Sparkles, FileText, Mail, TrendingUp, HelpCircle, ExternalLink,
  Clock, DollarSign, Quote, Lightbulb,
} from "lucide-react";
import { safeFormatDate } from "@/lib/dateUtils";
import {
  useContentFunnel,
  usePublishedPostAnalytics,
  useContentGaps,
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

export function ContentAnalyticsTab() {
  const funnelQ = useContentFunnel();
  const postsQ = usePublishedPostAnalytics();
  const gapsQ = useContentGaps();

  const loading = funnelQ.isLoading || postsQ.isLoading || gapsQ.isLoading;
  const funnel = funnelQ.data?.funnel;
  const sourceMix = funnelQ.data?.sourceMix || [];
  const posts = postsQ.data || [];
  const gaps = gapsQ.data || [];

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

      {/* Beacon citations (hero) + Content gaps side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          title="⭐ Beacon citations per post"
          subtitle="How often each published post has been cited as a source in a Beacon answer. This is the 'is it earning its keep?' metric."
        >
          <Card className="divide-y">
            {posts.length === 0 && (
              <Empty>No published posts yet — publish one to start tracking citations.</Empty>
            )}
            {posts.map((p) => {
              const Icon = isNewsletter(p.content_type) ? Mail : FileText;
              return (
                <div key={p.id} className="p-3 flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {safeFormatDate(p.published_at, "MMM d, yyyy", "Not yet live")}
                      {p.ai_cost_usd > 0 && (
                        <> · <DollarSign className="h-3 w-3 inline -mt-0.5" />
                          {p.ai_cost_usd.toFixed(3)}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Quote className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-lg font-semibold">{p.citations}</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      citations
                    </div>
                  </div>
                </div>
              );
            })}
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

      {/* SEO outbound link — we deliberately don't rebuild this. */}
      <Card className="p-3 flex items-center gap-3">
        <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="text-sm flex-1">
          <div className="font-medium">Search rankings & impressions</div>
          <div className="text-xs text-muted-foreground">
            We don't rebuild SEO metrics in-app. Check Google Search Console for
            impressions, clicks, and rank.
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a
            href="https://search.google.com/search-console"
            target="_blank"
            rel="noreferrer"
          >
            Open Search Console <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </Button>
      </Card>
    </div>
  );
}
