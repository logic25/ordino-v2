import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  MessageSquare, Users, Target, AlertCircle, ChevronDown, Clock, DollarSign, Trophy,
  Check, X, Loader2, Sparkles, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBeaconAnalytics, useReviewSuggestion, useTurnQuestionIntoContent, type DateRange } from "@/hooks/useBeaconAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { TooltipProvider } from "@/components/ui/tooltip";

const BEACON_ORANGE = "#f59e0b";

// ── Feedback: pending KB correction suggestions, approve/reject ──────────────
function SuggestionCard({ s }: { s: any }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const review = useReviewSuggestion();
  const act = (status: "approved" | "rejected") =>
    review.mutate(
      { id: s.id, status, reviewedBy: user?.email ?? user?.id },
      {
        onSuccess: () => toast({
          title: status === "approved" ? "Approved" : "Rejected",
          description: status === "approved"
            ? "Beacon will fold this correction into the knowledge base."
            : "Dismissed — won't be used.",
        }),
        onError: (e: any) => toast({ title: "Couldn't update", description: e.message, variant: "destructive" }),
      },
    );
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{s.user_name || "Someone"}</span>
          {s.timestamp && <span>· {formatDistanceToNow(new Date(s.timestamp), { addSuffix: true })}</span>}
          {s.topics && <Badge variant="secondary" className="text-[9px]">{s.topics}</Badge>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => act("rejected")}>
            <X className="h-3.5 w-3.5 mr-1" /> Reject
          </Button>
          <Button size="sm" disabled={review.isPending} onClick={() => act("approved")}>
            {review.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />} Approve
          </Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Beacon said (wrong)</div>
          <p className="text-xs text-foreground/90 mt-0.5 whitespace-pre-wrap">{s.wrong_answer}</p>
        </div>
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Should be</div>
          <p className="text-xs text-foreground/90 mt-0.5 whitespace-pre-wrap">{s.correct_answer}</p>
        </div>
      </div>
    </div>
  );
}

function ReviewedCard({ s }: { s: any }) {
  const approved = s.status === "approved";
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className={cn("font-semibold px-1.5 py-0.5 rounded-full text-[10px]",
          approved ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                   : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400")}>
          {approved ? "Approved" : "Rejected"}
        </span>
        {s.user_name && <span>by {s.user_name}</span>}
        {s.reviewed_at && <span>· {formatDistanceToNow(new Date(s.reviewed_at), { addSuffix: true })}</span>}
        {s.topics && <Badge variant="secondary" className="text-[9px]">{s.topics}</Badge>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">Was wrong</div>
          <p className="text-xs text-foreground/90 mt-0.5 whitespace-pre-wrap">{s.wrong_answer}</p>
        </div>
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Corrected to</div>
          <p className="text-xs text-foreground/90 mt-0.5 whitespace-pre-wrap">{s.correct_answer}</p>
        </div>
      </div>
    </div>
  );
}

function FeedbackPanel({ suggestions, reviewed, isLoading }: { suggestions: any[]; reviewed: any[]; isLoading: boolean }) {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-orange-500" /> Feedback — KB Corrections
        </CardTitle>
        <div className="flex gap-1 mt-2">
          <button onClick={() => setTab("pending")}
            className={cn("text-xs px-2.5 py-1 rounded-md transition-colors", tab === "pending" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50")}>
            Pending Review {suggestions.length > 0 && <span className="ml-1 text-[10px] rounded-full bg-orange-500 text-white px-1.5">{suggestions.length}</span>}
          </button>
          <button onClick={() => setTab("history")}
            className={cn("text-xs px-2.5 py-1 rounded-md transition-colors", tab === "history" ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50")}>
            Approved History {reviewed.length > 0 && <span className="ml-1 text-[10px] text-muted-foreground">({reviewed.length})</span>}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : tab === "pending" ? (
          suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-xs">No corrections waiting. You're all caught up.</p>
            </div>
          ) : (
            <div className="space-y-2.5">{suggestions.map((s) => <SuggestionCard key={s.id} s={s} />)}</div>
          )
        ) : reviewed.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No reviewed corrections yet.</p>
        ) : (
          <div className="space-y-2.5">{reviewed.map((s) => <ReviewedCard key={s.id} s={s} />)}</div>
        )}
      </CardContent>
    </Card>
  );
}

function formatAbbrev(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 85 ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
    : value >= 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
    : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400";
  return <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", color)}>{value}%</span>;
}

function ConversationItem({ item }: { item: any }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const turnIntoContent = useTurnQuestionIntoContent();
  const toContent = () =>
    turnIntoContent.mutate({ question: item.question }, {
      onSuccess: () => toast({ title: "Added to Content pipeline", description: "Find it under Content → Ideas." }),
      onError: (e: any) => toast({ title: "Couldn't add", description: e.message, variant: "destructive" }),
    });
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full text-left group">
        <div className="flex items-center gap-3 py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate text-foreground">
              {item.question.length > 80 ? item.question.slice(0, 80) + "…" : item.question}
            </p>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
              <span>{item.userName}</span>
              <span>·</span>
              <span>{item.timestampRelative}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ConfidenceBadge value={item.confidence} />
            {item.sourcesCount > 0 && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                {item.sourcesCount} sources
              </Badge>
            )}
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-3 pl-3 border-l-2 border-border pb-3 space-y-2 text-xs">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Full Question</p>
            <p className="text-foreground">{item.question}</p>
          </div>
          {item.response && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Response Preview</p>
              <p className="text-muted-foreground">
                {item.response.length > 200 ? item.response.slice(0, 200) + "…" : item.response}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-3 pt-1 text-[10px] text-muted-foreground">
            <span>Confidence: <strong className="text-foreground">{item.confidence}%</strong></span>
            <span>Topic: <strong className="text-foreground">{item.topic || "—"}</strong></span>
            <span>Response time: <strong className="text-foreground">{item.responseTimeMs}ms</strong></span>
            <span>Cost: <strong className="text-foreground">${item.costUsd.toFixed(4)}</strong></span>
            <span>{new Date(item.timestamp).toLocaleString()}</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={turnIntoContent.isPending} onClick={toContent}>
            {turnIntoContent.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1 text-orange-500" />}
            Turn into Content
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const RANK_STYLES = ["text-amber-500", "text-slate-400", "text-amber-700"];

const COST_PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#8b5cf6",
  pinecone: "#06b6d4",
  voyage: "#f97316",
};

export function BeaconAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const data = useBeaconAnalytics(dateRange);

  const kpis = [
    {
      label: "Total Questions", value: formatAbbrev(data.totalQuestions), icon: MessageSquare, color: "bg-amber-500/10 text-amber-600",
      tip: "Every question a real teammate asked Beacon (web chat, Google Chat DM, embedded widget). Test/anonymous probes are excluded so this reflects actual usage.",
    },
    {
      label: "Active Users", value: data.activeUsers.toString(), icon: Users, color: "bg-blue-500/10 text-blue-600",
      tip: "Distinct humans who asked Beacon at least once in the selected range. Identity variants (work email, profile ID, Google ID, name aliases) are merged into one person — so Manny logged in 4 different ways still counts as 1.",
    },
    {
      label: "Avg Confidence", value: `${data.avgConfidence}%`, icon: Target, color: "bg-green-500/10 text-green-600",
      tip: "Average RAG retrieval confidence (0–100%) across all answered questions. High = Beacon found strong matches in the knowledge base. Low = the KB is thin on that topic — a signal to add content.",
    },
    {
      label: "Pending Suggestions", value: data.pendingCount.toString(), icon: AlertCircle, color: "bg-red-500/10 text-red-600",
      tip: "KB corrections waiting for your review. When teammates flag a wrong answer in chat, it lands here. Approving folds the correction into Beacon's knowledge base.",
    },
  ];

  const rangeLabel = dateRange === "all" ? "All time" : `Last ${dateRange} days`;

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          Beacon AI chatbot performance, usage, and cost analytics — {rangeLabel.toLowerCase()}
        </p>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="pt-4 pb-3">
                {data.isLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <div className="flex items-start gap-3">
                    <div className={cn("rounded-md p-2 shrink-0", kpi.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: BEACON_ORANGE }}>{kpi.value}</p>
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        {kpi.label}
                        <InfoTooltip>{kpi.tip}</InfoTooltip>
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Feedback — pending KB corrections (actionable, so it's up top) */}
      <FeedbackPanel suggestions={data.pendingSuggestions} reviewed={data.reviewedSuggestions} isLoading={data.isLoading} />

      {/* Questions Over Time + Topics */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              Questions Over Time
              <InfoTooltip>Daily volume of questions teammates asked Beacon. Spikes usually align with new filings, audits, or training pushes.</InfoTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : data.questionsOverTime.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-xs">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.questionsOverTime}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                    formatter={(v: number) => [`${v} questions`, "Count"]}
                  />
                  <Bar dataKey="count" fill={BEACON_ORANGE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              Topics Breakdown
              <InfoTooltip>What subjects teammates are asking Beacon about (DOB filings, objections, RFPs, etc.). This feeds the Content engine — recurring topics become candidates for blog posts, playbooks, and training material.</InfoTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : data.topicBreakdown.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-xs">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.topicBreakdown.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="topic" tick={{ fontSize: 10 }} width={120} />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                    formatter={(v: number) => [`${v} questions`, "Count"]}
                  />
                  <Bar dataKey="count" fill={BEACON_ORANGE} radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confidence Distribution + Top Questions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              Confidence Distribution
              <InfoTooltip>How sure Beacon was when answering. High (≥85%) = strong KB match. Medium (60–84%) = partial match. Low (&lt;60%) = thin coverage — those topics need more documents in the knowledge base.</InfoTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : data.confidenceDistribution.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-xs">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.confidenceDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    label={({ name, value, percent }) => `${value} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {data.confidenceDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>}
                  />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                  />
                  {/* Center label */}
                  <text x="50%" y="48%" textAnchor="middle" className="fill-foreground text-2xl font-bold">
                    {data.totalQuestions}
                  </text>
                  <text x="50%" y="56%" textAnchor="middle" className="fill-muted-foreground text-[10px]">
                    total
                  </text>
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              Top Questions
              <InfoTooltip>The most frequently asked questions, deduped. Open any conversation below and click "Turn into Content" to send it to the Content pipeline as a blog/playbook candidate.</InfoTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : data.topQuestions.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-xs">No questions recorded yet</div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Question</TableHead>
                      <TableHead className="text-xs text-right w-[70px]">Count</TableHead>
                      <TableHead className="text-xs text-right w-[100px]">Last Asked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topQuestions.map((q, i) => (
                      <TableRow key={i} className="group">
                        <TableCell className="text-xs py-2">
                          <span title={q.question}>
                            {q.question.length > 100 ? q.question.slice(0, 100) + "…" : q.question}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium tabular-nums py-2">{q.count}</TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground py-2">{q.lastAskedRelative}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Conversations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Recent Conversations
            <InfoTooltip>Latest 20 question-and-answer exchanges. Click any row to see the full question, response preview, confidence, response time, and cost — and to turn it into a Content candidate.</InfoTooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : data.recentConversations.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No conversations recorded yet</p>
          ) : (
            <div className="divide-y divide-border">
              {data.recentConversations.map((item) => (
                <ConversationItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Tracking */}
      <div className="grid gap-4 lg:grid-cols-3">
        {["Anthropic", "Pinecone", "Voyage"].map((provider) => {
          const entry = data.costBreakdown.find((c) => c.provider.toLowerCase() === provider.toLowerCase());
          return (
            <Card key={provider}>
              <CardContent className="pt-4 pb-3">
                {data.isLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="rounded-md p-2 bg-amber-500/10">
                      <DollarSign className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold tabular-nums" style={{ color: BEACON_ORANGE }}>
                        ${(entry?.total || 0).toFixed(2)}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground">{provider} API</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data.costOverTime.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Daily API Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.costOverTime}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                  formatter={(v: number, name: string) => [`$${v.toFixed(4)}`, name]}
                />
                {data.costProviderKeys.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="costs"
                    fill={COST_PROVIDER_COLORS[key] || "#94a3b8"}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Team Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Team Activity
            <InfoTooltip>Who's using Beacon most. Identity variants are merged — one teammate counts once regardless of which login (email, Google ID, profile UUID) Beacon recorded.</InfoTooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : data.teamActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No team activity recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[50px]">Rank</TableHead>
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs text-right">Questions</TableHead>
                    <TableHead className="text-xs text-right">Avg Confidence</TableHead>
                    <TableHead className="text-xs text-right">Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.teamActivity.map((u, i) => (
                    <TableRow key={u.uid}>
                      <TableCell className={cn("text-xs font-bold py-2", RANK_STYLES[i] || "text-muted-foreground")}>
                        {i + 1}
                      </TableCell>
                      <TableCell className="text-xs font-medium py-2">{u.name}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums py-2">{u.count}</TableCell>
                      <TableCell className="text-xs text-right py-2">
                        <ConfidenceBadge value={u.avgConfidence} />
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground py-2">{u.lastActiveRelative}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
