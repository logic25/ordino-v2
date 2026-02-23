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
} from "lucide-react";
import { useBeaconAnalytics, type DateRange } from "@/hooks/useBeaconAnalytics";
import { cn } from "@/lib/utils";

const BEACON_ORANGE = "#f59e0b";

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
  const [dateRange, setDateRange] = useState<DateRange>("30");
  const data = useBeaconAnalytics(dateRange);

  const kpis = [
    { label: "Total Questions", value: formatAbbrev(data.totalQuestions), icon: MessageSquare, color: "bg-amber-500/10 text-amber-600" },
    { label: "Active Users", value: data.activeUsers.toString(), icon: Users, color: "bg-blue-500/10 text-blue-600" },
    { label: "Avg Confidence", value: `${data.avgConfidence}%`, icon: Target, color: "bg-green-500/10 text-green-600" },
    { label: "Pending Suggestions", value: data.pendingCount.toString(), icon: AlertCircle, color: "bg-red-500/10 text-red-600" },
  ];

  const rangeLabel = dateRange === "all" ? "All time" : `Last ${dateRange} days`;

  return (
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
                      <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Questions Over Time + Topics */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Questions Over Time</CardTitle>
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
            <CardTitle className="text-sm">Topics Breakdown</CardTitle>
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
            <CardTitle className="text-sm">Confidence Distribution</CardTitle>
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
            <CardTitle className="text-sm">Top Questions</CardTitle>
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
  );
}
