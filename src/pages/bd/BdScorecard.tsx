import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Trophy, Users, Clock, Target, TrendingUp, TrendingDown, DollarSign,
  Zap, ArrowRight, Flame, Sparkles, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useIsCompAdmin, useBdScorecard } from "@/hooks/useBdComp";
import { money } from "@/lib/bdComp";
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

/* ------------------------------ helpers ------------------------------ */

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
}

function Delta({
  current,
  prior,
  format = "money",
  invert = false,
}: {
  current: number | null;
  prior: number | null;
  format?: "money" | "percent" | "hours" | "count";
  invert?: boolean;
}) {
  if (current == null || prior == null) return null;
  const diff = current - prior;
  if (Math.abs(diff) < 0.0001) {
    return <span className="text-xs text-muted-foreground">no change</span>;
  }
  const positive = invert ? diff < 0 : diff > 0;
  const Icon = diff > 0 ? TrendingUp : TrendingDown;
  const label =
    format === "money" ? money(Math.abs(diff)) :
    format === "percent" ? `${Math.round(Math.abs(diff) * 100)}pp` :
    format === "hours" ? `${Math.abs(diff).toFixed(1)}h` :
    Math.abs(Math.round(diff)).toString();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}
    >
      <Icon className="h-3 w-3" />
      {diff > 0 ? "+" : "−"}{label}
      <span className="text-muted-foreground font-normal">vs prior</span>
    </span>
  );
}

const TILE_ACCENTS = {
  amber: {
    ring: "ring-amber-200/60 dark:ring-amber-500/20",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    stroke: "hsl(38 92% 50%)",
  },
  emerald: {
    ring: "ring-emerald-200/60 dark:ring-emerald-500/20",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    stroke: "hsl(160 84% 39%)",
  },
  sky: {
    ring: "ring-sky-200/60 dark:ring-sky-500/20",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    stroke: "hsl(199 89% 48%)",
  },
  rose: {
    ring: "ring-rose-200/60 dark:ring-rose-500/20",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    stroke: "hsl(347 77% 50%)",
  },
} as const;

type Accent = keyof typeof TILE_ACCENTS;

function KpiTile({
  accent, icon, label, value, delta, spark,
}: {
  accent: Accent;
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: React.ReactNode;
  spark?: { day: string; count: number }[];
}) {
  const a = TILE_ACCENTS[accent];
  return (
    <Card className={cn("relative overflow-hidden ring-1 transition-shadow hover:shadow-md", a.ring)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={cn("h-9 w-9 rounded-lg grid place-items-center", a.chip)}>{icon}</div>
          {spark && spark.length > 0 && (
            <div className="h-8 w-20 -mr-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spark}>
                  <Line type="monotone" dataKey="count" stroke={a.stroke} strokeWidth={2} dot={false} />
                  <Tooltip
                    cursor={false}
                    contentStyle={{ fontSize: 11, padding: "2px 6px" }}
                    labelFormatter={(l) => new Date(l as string).toLocaleDateString(undefined, { weekday: "short" })}
                    formatter={(v: any) => [v, "activity"]}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
        {delta && <div className="mt-1">{delta}</div>}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ funnel ------------------------------ */

function Funnel({
  stages,
}: {
  stages: { label: string; value: number }[];
}) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const width = Math.max((s.value / max) * 100, 4);
        const conv = i > 0 && stages[i - 1].value > 0 ? s.value / stages[i - 1].value : null;
        return (
          <div key={s.label} className="group">
            <div className="flex items-center gap-3">
              <div className="w-28 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="flex-1 relative h-9">
                <div
                  className="h-full rounded-md bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 dark:from-amber-500 dark:via-amber-400 dark:to-amber-300 transition-all group-hover:shadow-md"
                  style={{ width: `${width}%` }}
                />
                <div className="absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-900 tabular-nums">
                  {s.value}
                </div>
              </div>
              <div className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                {conv != null ? `${Math.round(conv * 100)}%` : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ activity strip ------------------------------ */

function ActivityStrip({ spark }: { spark: { day: string; count: number }[] }) {
  const max = Math.max(...spark.map((s) => s.count), 1);
  const total = spark.reduce((sum, s) => sum + s.count, 0);
  return (
    <Card className="ring-1 ring-border/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold">This week</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Notes, emails and stage changes logged</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{total}</div>
            <div className="text-xs text-muted-foreground">activities</div>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-16">
          {spark.map((d) => {
            const dow = new Date(d.day).toLocaleDateString(undefined, { weekday: "short" })[0];
            const height = d.count === 0 ? 4 : Math.max((d.count / max) * 100, 12);
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={cn(
                      "w-full rounded-sm transition-colors",
                      d.count === 0 ? "bg-muted" : "bg-gradient-to-t from-amber-500 to-amber-300"
                    )}
                    style={{ height: `${height}%` }}
                    title={`${d.day}: ${d.count}`}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground">{dow}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ stage bar ------------------------------ */

const STAGE_COLORS: Record<string, string> = {
  NEW: "bg-slate-400",
  CONTACTED: "bg-sky-400",
  QUALIFIED: "bg-amber-400",
  PROPOSAL: "bg-orange-500",
  WON: "bg-emerald-500",
  LOST: "bg-rose-400",
};

function StageBar({ byStage }: { byStage: Record<string, number> }) {
  const order = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
  const total = Object.values(byStage).reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground">No leads in window.</p>;

  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden ring-1 ring-border/60">
        {order.map((s) => {
          const n = byStage[s] ?? 0;
          if (n === 0) return null;
          const w = (n / total) * 100;
          return (
            <div
              key={s}
              className={cn("h-full transition-all hover:opacity-80", STAGE_COLORS[s])}
              style={{ width: `${w}%` }}
              title={`${s}: ${n}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {order.map((s) => {
          const n = byStage[s] ?? 0;
          if (n === 0) return null;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <div className={cn("h-2.5 w-2.5 rounded-sm", STAGE_COLORS[s])} />
              <span className="font-medium text-foreground">{s}</span>
              <span className="text-muted-foreground tabular-nums">{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ tier tier ------------------------------ */

function tierFor(value: number): { label: string; className: string } {
  if (value >= 100000) return { label: "Gold", className: "bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 border-amber-500" };
  if (value >= 25000) return { label: "Silver", className: "bg-gradient-to-r from-slate-300 to-slate-200 text-slate-800 border-slate-400" };
  if (value > 0) return { label: "Bronze", className: "bg-gradient-to-r from-orange-400 to-amber-300 text-orange-950 border-orange-500" };
  return { label: "—", className: "bg-muted text-muted-foreground border-border" };
}

/* ------------------------------ page ------------------------------ */

const PERIOD_OPTIONS = [
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last 12 months" },
];

export default function BdScorecard() {
  const { profile } = useAuth();
  const isCompAdmin = useIsCompAdmin();
  const { data: people = [] } = useCompanyProfiles();
  const [personId, setPersonId] = useState<string | undefined>(profile?.id);
  const [period, setPeriod] = useState<number>(90);
  const effectivePerson = isCompAdmin ? personId : profile?.id;
  const { data, isLoading } = useBdScorecard(effectivePerson, period);

  const personOptions = useMemo(
    () => (isCompAdmin ? people : people.filter((p) => p.id === profile?.id)),
    [isCompAdmin, people, profile?.id]
  );

  const selectedPerson = useMemo(
    () => personOptions.find((p) => p.id === effectivePerson),
    [personOptions, effectivePerson]
  );

  const displayName = selectedPerson
    ? selectedPerson.display_name ?? `${selectedPerson.first_name ?? ""} ${selectedPerson.last_name ?? ""}`.trim()
    : "—";

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* ============ HERO BAND ============ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white">
          {/* amber accent stripe */}
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600" />
          {/* subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "20px 20px",
            }}
          />
          {/* glow */}
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl" />

          <div className="relative p-6 sm:p-8">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-14 w-14 ring-2 ring-amber-400/40">
                    <AvatarFallback className="bg-slate-700 text-white font-semibold">
                      {initials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-amber-500 grid place-items-center ring-2 ring-slate-900">
                    <Trophy className="h-3.5 w-3.5 text-slate-900" />
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-amber-400/90 font-semibold">
                    BD Scorecard
                  </div>
                  <div className="mt-0.5 text-2xl font-bold">{displayName}</div>
                  <div className="text-sm text-slate-300">
                    {PERIOD_OPTIONS.find((p) => p.value === period)?.label}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isCompAdmin && (
                  <Select value={effectivePerson} onValueChange={setPersonId}>
                    <SelectTrigger className="w-48 bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800">
                      <SelectValue placeholder="Person" />
                    </SelectTrigger>
                    <SelectContent>
                      {personOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.display_name ?? (`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
                  <SelectTrigger className="w-40 bg-slate-800/60 border-slate-700 text-white hover:bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hero big number: pipeline */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-400 font-medium flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" /> Pipeline value
                </div>
                {isLoading || !data ? (
                  <Skeleton className="mt-2 h-14 w-64 bg-slate-700/40" />
                ) : (
                  <>
                    <div className="mt-2 text-5xl sm:text-6xl font-black tabular-nums bg-gradient-to-r from-white via-amber-100 to-amber-300 bg-clip-text text-transparent">
                      {money(data.pipelineValue)}
                    </div>
                    <div className="mt-2">
                      <Delta current={data.pipelineValue} prior={data.prior.pipelineValue} format="money" />
                    </div>
                  </>
                )}
              </div>
              {!isLoading && data && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-white/5 backdrop-blur border border-white/10 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400">Won</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-400">{data.won}</div>
                  </div>
                  <div className="rounded-lg bg-white/5 backdrop-blur border border-white/10 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400">Qualified</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-amber-300">{data.qualified}</div>
                  </div>
                  <div className="rounded-lg bg-white/5 backdrop-blur border border-white/10 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400">Leads</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-white">{data.contactsCaptured}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <>
            {/* ============ KPI ROW ============ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiTile
                accent="amber"
                icon={<Users className="h-4 w-4" />}
                label="Leads captured"
                value={String(data.contactsCaptured)}
                delta={<Delta current={data.contactsCaptured} prior={data.prior.contactsCaptured} format="count" />}
                spark={data.activitySpark}
              />
              <KpiTile
                accent="emerald"
                icon={<Target className="h-4 w-4" />}
                label="Qualify rate"
                value={pct(data.qualifyRate)}
                delta={<Delta current={data.qualifyRate} prior={data.prior.qualifyRate} format="percent" />}
              />
              <KpiTile
                accent="sky"
                icon={<Trophy className="h-4 w-4" />}
                label="Win rate"
                value={pct(data.winRate)}
                delta={<Delta current={data.winRate} prior={data.prior.winRate} format="percent" />}
              />
              <KpiTile
                accent="rose"
                icon={<Clock className="h-4 w-4" />}
                label="1st touch"
                value={data.avgSpeedToTouchHrs == null ? "—" : `${data.avgSpeedToTouchHrs.toFixed(1)}h`}
                delta={
                  data.avgSpeedToTouchHrs != null && data.prior.avgSpeedToTouchHrs != null
                    ? <Delta current={data.avgSpeedToTouchHrs} prior={data.prior.avgSpeedToTouchHrs} format="hours" invert />
                    : <span className="text-xs text-muted-foreground">target &lt; 24h</span>
                }
              />
            </div>

            {/* ============ FUNNEL + ACTIVITY ============ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 ring-1 ring-border/60">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <h3 className="text-sm font-semibold uppercase tracking-wider">Conversion funnel</h3>
                    </div>
                    <Badge variant="outline" className="text-xs">{PERIOD_OPTIONS.find((p) => p.value === period)?.label}</Badge>
                  </div>
                  <Funnel
                    stages={[
                      { label: "Leads", value: data.scans },
                      { label: "Qualified", value: data.qualified },
                      { label: "Proposals", value: data.proposalsCount },
                      { label: "Won", value: data.won },
                    ]}
                  />
                </CardContent>
              </Card>
              <ActivityStrip spark={data.activitySpark} />
            </div>

            {/* ============ STAGE BAR + LEADERBOARD ============ */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <Card className="lg:col-span-2 ring-1 ring-border/60">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider">Leads by stage</h3>
                  </div>
                  <StageBar byStage={data.byStage} />
                </CardContent>
              </Card>

              <Card className="lg:col-span-3 ring-1 ring-border/60">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <h3 className="text-sm font-semibold uppercase tracking-wider">Top referral sources</h3>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                      <Link to="/bd/referrals">
                        View all <ChevronRight className="h-3 w-3 ml-0.5" />
                      </Link>
                    </Button>
                  </div>
                  {data.topSources.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-6 text-center">
                      No won referrals yet in this window.
                      <div className="mt-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/bd/referrals">
                            Track your first referral <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.topSources.map((s, i) => {
                        const t = tierFor(s.value);
                        return (
                          <div
                            key={s.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="w-6 text-center text-sm font-bold text-muted-foreground tabular-nums">
                              {i + 1}
                            </div>
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-amber-100 text-amber-800 text-xs font-semibold dark:bg-amber-500/20 dark:text-amber-300">
                                {initials(s.label)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{s.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {s.won} won · {s.count} total
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold tabular-nums">{money(s.value)}</div>
                              <Badge variant="outline" className={cn("text-[10px] mt-0.5 border", t.className)}>
                                {t.label}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
