import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import { Brain, Zap, DollarSign, TrendingUp, Users, ExternalLink, HelpCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

// Human-readable labels for each AI feature
const FEATURE_LABELS: Record<string, { label: string; description: string }> = {
  stress_test:        { label: "Roadmap Stress Test",   description: "AI reviews a product idea and surfaces risks, duplicates, and evidence" },
  collection_message: { label: "Collection Email",       description: "AI drafts a personalized payment reminder based on invoice history" },
  plan_analysis:      { label: "Plan Analysis",          description: "AI reads uploaded construction plans and writes the job description" },
  rfp_extract:        { label: "RFP Extraction",         description: "AI reads an RFP webpage and pulls out title, agency, due date, and links" },
  rfp_score:          { label: "RFP Relevance Score",    description: "AI scores each discovered RFP 0–100 based on how well it fits your services" },
  rfp_cover_letter:   { label: "RFP Cover Letter",       description: "AI writes a customized cover letter for a specific RFP" },
  telemetry_analysis: { label: "Behavior Analysis",      description: "AI analyzes usage patterns to surface product gaps and roadmap ideas" },
  payment_risk:       { label: "Payment Risk Score",     description: "AI predicts how likely a client is to pay late based on their history" },
  checklist_followup: { label: "Checklist Follow-up",    description: "AI drafts a follow-up email for outstanding DOB checklist items" },
  extract_tasks:      { label: "Task Extraction",        description: "AI reads a note or email and pulls out action items" },
  claimflow:          { label: "ClaimFlow Package",      description: "AI generates a legal collections referral package" },
};

// Human-friendly model names
const MODEL_FRIENDLY: Record<string, string> = {
  "google/gemini-3-flash-preview": "Gemini Flash (fast, efficient)",
  "google/gemini-2.5-flash":       "Gemini Flash 2.5 (multimodal)",
  "google/gemini-2.5-pro":         "Gemini Pro (most powerful)",
  "openai/gpt-5":                  "GPT-5 (OpenAI)",
  "openai/gpt-5-mini":             "GPT-5 Mini (OpenAI)",
};

const FEATURE_COLORS = [
  "hsl(var(--primary))",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className="inline-flex cursor-help ml-1">
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-xs leading-relaxed">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Format word-equivalent count (tokens ≈ 0.75 words)
function formatWords(tokens: number) {
  const words = Math.round(tokens * 0.75);
  if (words >= 1_000_000) return `${(words / 1_000_000).toFixed(1)}M words`;
  if (words >= 1_000) return `${(words / 1_000).toFixed(1)}K words`;
  return `${words} words`;
}

function formatCost(usd: number) {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `<$0.01`;
  return `$${usd.toFixed(2)}`;
}

function formatCostFull(usd: number) {
  return `$${usd.toFixed(4)}`;
}

export function AIUsageDashboard() {
  const { profile } = useAuth();
  const companyId = (profile as any)?.company_id;
  const [days, setDays] = useState("30");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["ai-usage-logs", companyId, days],
    enabled: !!companyId,
    queryFn: async () => {
      const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("ai_usage_logs" as any)
        .select("*, profiles!ai_usage_logs_user_id_fkey(display_name, first_name, last_name)")
        .eq("company_id", companyId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const totalRequests = logs.length;
  const totalTokens = logs.reduce((s: number, l: any) => s + (l.total_tokens || 0), 0);
  const totalCost = logs.reduce((s: number, l: any) => s + (parseFloat(l.estimated_cost_usd) || 0), 0);

  // By feature
  const byFeature = Object.entries(
    logs.reduce((acc: Record<string, { count: number; tokens: number; cost: number; models: Record<string, number> }>, l: any) => {
      const key = l.feature || "unknown";
      if (!acc[key]) acc[key] = { count: 0, tokens: 0, cost: 0, models: {} };
      acc[key].count++;
      acc[key].tokens += l.total_tokens || 0;
      acc[key].cost += parseFloat(l.estimated_cost_usd) || 0;
      const m = l.model || "unknown";
      acc[key].models[m] = (acc[key].models[m] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([feature, d]) => {
      // Pick the most-used model for this feature
      const dominantModel = Object.entries(d.models).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      return {
        feature,
        label: FEATURE_LABELS[feature]?.label || feature,
        desc: FEATURE_LABELS[feature]?.description || "",
        dominantModel,
        dominantModelFriendly: MODEL_FRIENDLY[dominantModel] || dominantModel,
        models: d.models,
        count: d.count,
        tokens: d.tokens,
        cost: d.cost,
      };
    })
    .sort((a, b) => b.count - a.count);

  // By model
  const byModel = Object.entries(
    logs.reduce((acc: Record<string, { count: number; tokens: number }>, l: any) => {
      const key = l.model || "unknown";
      if (!acc[key]) acc[key] = { count: 0, tokens: 0 };
      acc[key].count++;
      acc[key].tokens += l.total_tokens || 0;
      return acc;
    }, {})
  ).map(([model, d]) => ({ model, friendlyName: MODEL_FRIENDLY[model] || model, ...d }));

  // By user
  const byUser = Object.entries(
    logs.reduce((acc: Record<string, { count: number; tokens: number; name: string }>, l: any) => {
      const key = l.user_id || "system";
      const name =
        l.profiles?.display_name ||
        [l.profiles?.first_name, l.profiles?.last_name].filter(Boolean).join(" ") ||
        "Automated / System";
      if (!acc[key]) acc[key] = { count: 0, tokens: 0, name };
      acc[key].count++;
      acc[key].tokens += l.total_tokens || 0;
      return acc;
    }, {})
  )
    .map(([uid, d]) => ({ uid, ...d }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Daily trend
  const byDay = Object.entries(
    logs.reduce((acc: Record<string, number>, l: any) => {
      const day = l.created_at?.slice(0, 10) || "";
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([date, count]) => ({ date: date.slice(5), count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const kpis = [
    {
      label: "AI Requests",
      value: totalRequests.toLocaleString(),
      icon: Brain,
      color: "bg-primary/10 text-primary",
      tip: "Total number of times AI was called — each feature use counts as one request.",
    },
    {
      label: "Words Processed",
      value: formatWords(totalTokens),
      icon: Zap,
      color: "bg-amber-500/10 text-amber-600",
      tip: 'The total text sent to and received from AI, measured in "words" (technically tokens — roughly 1 token = ¾ of a word).',
    },
    {
      label: "Estimated Cost",
      value: formatCost(totalCost),
      icon: DollarSign,
      color: "bg-green-500/10 text-green-600",
      tip: "Approximate cost based on Lovable AI published rates. Actual billing is in your Lovable workspace.",
    },
    {
      label: "Features Using AI",
      value: byFeature.length.toString(),
      icon: TrendingUp,
      color: "bg-violet-500/10 text-violet-600",
      tip: "How many different tools in Ordino called AI during this period.",
    },
  ];

  return (
    <TooltipProvider>
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          See which AI features are being used, how much text they process, and estimated costs.
        </p>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <a href="https://lovable.dev/settings" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" /> Lovable Billing
            </a>
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="pt-4 pb-3">
                {isLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <div className="flex items-start gap-2">
                    <div className={`rounded-md p-1.5 mt-0.5 shrink-0 ${kpi.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground leading-tight">{kpi.value}</p>
                      <p className="text-xs font-medium text-foreground flex items-center gap-0.5">
                        {kpi.label}
                        <InfoTip>{kpi.tip}</InfoTip>
                      </p>
                      <p className="text-[10px] text-muted-foreground">Last {days} days</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Feature usage bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              Requests by Feature
              <InfoTip>Each bar shows how many times that AI feature was triggered. Hover for the feature's purpose.</InfoTip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : byFeature.length === 0 ? (
              <div className="h-[240px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Brain className="h-8 w-8 opacity-30" />
                <p className="text-xs">No AI calls recorded yet in this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byFeature} layout="vertical" barSize={14} margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    width={130}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload as any;
                      return (
                        <div className="bg-popover border rounded-md shadow-md p-3 max-w-[220px] text-xs space-y-1">
                          <p className="font-semibold text-foreground">{d.label}</p>
                          <p className="text-muted-foreground">{d.desc}</p>
                          <div className="border-t pt-1 space-y-0.5">
                            <p><span className="text-foreground font-medium">{d.count}</span> requests</p>
                            <p><span className="text-foreground font-medium">{formatWords(d.tokens)}</span> processed</p>
                            <p>Est. cost: <span className="text-foreground font-medium">{formatCostFull(d.cost)}</span></p>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Daily trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              Daily AI Activity
              <InfoTip>How many times AI was called each day. Spikes often match busy billing or proposal days.</InfoTip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : byDay.length === 0 ? (
              <div className="h-[240px] flex flex-col items-center justify-center text-muted-foreground gap-2">
                <TrendingUp className="h-8 w-8 opacity-30" />
                <p className="text-xs">No data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byDay}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <RechartsTooltip
                    formatter={(v: number) => [`${v} requests`, "AI calls"]}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Model + Per user */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* AI Models */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              AI Models Used
              <InfoTip>Different features use different AI models. Flash models are fast and cheap; Pro models are slower but more powerful.</InfoTip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : byModel.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-xs">No data</div>
            ) : (
              <div className="space-y-3">
                {byModel.map((m, i) => {
                  const pct = totalRequests > 0 ? (m.count / totalRequests) * 100 : 0;
                  return (
                    <div key={m.model}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: FEATURE_COLORS[i % FEATURE_COLORS.length] }} />
                          <span className="text-xs font-medium truncate">{m.friendlyName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {m.count} calls · {formatWords(m.tokens)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: FEATURE_COLORS[i % FEATURE_COLORS.length] }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{pct.toFixed(0)}% of all requests</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per user */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Usage by Team Member
              <InfoTip>How many AI calls each person triggered. "Automated" calls happen in the background (e.g. scheduled reminders).</InfoTip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : byUser.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-xs">No data</div>
            ) : (
              <div className="space-y-2">
                {byUser.map((u) => {
                  const pct = totalRequests > 0 ? (u.count / totalRequests) * 100 : 0;
                  return (
                    <div key={u.uid} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-semibold text-primary">
                          {u.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-medium truncate">{u.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{u.count} calls</span>
                        </div>
                        <div className="mt-0.5 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/60 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        {formatWords(u.tokens)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cost breakdown table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            Cost Breakdown by Feature
            <InfoTip>Estimated costs based on published AI pricing. Flash models cost roughly $0.08–$0.30 per million words processed.</InfoTip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[120px] w-full" />
          ) : byFeature.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No AI usage recorded yet</p>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    <th className="text-left pb-2 pr-3">Feature</th>
                    <th className="text-left pb-2 pr-3 w-[140px]">Model</th>
                    <th className="text-right pb-2 pr-3 w-[80px]">Requests</th>
                    <th className="text-right pb-2 pr-3 w-[110px]">Words Processed</th>
                    <th className="text-right pb-2 w-[80px]">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {byFeature.map((f) => {
                    const isPro = f.dominantModel.includes("pro");
                    const isFlash25 = f.dominantModel.includes("2.5-flash");
                    return (
                      <tr key={f.feature} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span>{f.label}</span>
                            {f.desc && <InfoTip>{f.desc}</InfoTip>}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex cursor-default">
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] px-1.5 py-0 ${
                                    isPro
                                      ? "border-violet-400 text-violet-600 bg-violet-50 dark:bg-violet-950/30"
                                      : isFlash25
                                      ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950/30"
                                      : "border-green-400 text-green-600 bg-green-50 dark:bg-green-950/30"
                                  }`}
                                >
                                  {isPro ? "⚡ Pro" : isFlash25 ? "Flash 2.5" : "Flash"}
                                </Badge>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs max-w-[200px]">
                              <p className="font-medium">{f.dominantModelFriendly}</p>
                              <p className="text-muted-foreground mt-0.5">
                                {isPro
                                  ? "Most powerful — best for complex reasoning and nuanced tasks"
                                  : isFlash25
                                  ? "Multimodal — handles text + images efficiently"
                                  : "Fast & efficient — ideal for structured generation"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{f.count}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{formatWords(f.tokens)}</td>
                        <td className="py-2 text-right font-medium">{formatCostFull(f.cost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="pt-2 pr-3">Total</td>
                    <td className="pt-2 pr-3" />
                    <td className="pt-2 pr-3 text-right">{totalRequests}</td>
                    <td className="pt-2 pr-3 text-right">{formatWords(totalTokens)}</td>
                    <td className="pt-2 text-right">{formatCostFull(totalCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        * Costs are estimates. Actual billing is managed through your Lovable workspace.{" "}
        <a href="https://docs.lovable.dev/features/ai" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          Learn about Lovable AI pricing →
        </a>
      </p>
    </div>
    </TooltipProvider>
  );
}
