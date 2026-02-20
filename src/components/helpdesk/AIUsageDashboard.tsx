import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Brain, Zap, DollarSign, TrendingUp, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURE_LABELS: Record<string, string> = {
  stress_test: "AI Stress Test",
  collection_message: "Collection Message",
  plan_analysis: "Plan Analysis",
  rfp_extract: "RFP Extraction",
  rfp_score: "RFP Scoring",
  rfp_cover_letter: "RFP Cover Letter",
  telemetry_analysis: "Behavior Analysis",
  payment_risk: "Payment Risk",
  checklist_followup: "Checklist Follow-up",
  extract_tasks: "Task Extraction",
  claimflow: "ClaimFlow Package",
};

const FEATURE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#f97316",
];

// Estimated cost per 1M tokens (USD) by model
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "google/gemini-3-flash-preview": { input: 0.075, output: 0.30 },
  "google/gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5.00 },
  "google/gemini-2.5-flash-lite": { input: 0.015, output: 0.06 },
  "openai/gpt-5": { input: 2.50, output: 10.00 },
  "openai/gpt-5-mini": { input: 0.15, output: 0.60 },
};

function formatCost(usd: number) {
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`;
  return `$${usd.toFixed(4)}`;
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
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
        .select("*, profiles(display_name, first_name, last_name)")
        .eq("company_id", companyId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  // Aggregate metrics
  const totalRequests = logs.length;
  const totalTokens = logs.reduce((s: number, l: any) => s + (l.total_tokens || 0), 0);
  const totalCost = logs.reduce((s: number, l: any) => s + (parseFloat(l.estimated_cost_usd) || 0), 0);

  // By feature
  const byFeature = Object.entries(
    logs.reduce((acc: Record<string, { count: number; tokens: number; cost: number }>, l: any) => {
      const key = l.feature || "unknown";
      if (!acc[key]) acc[key] = { count: 0, tokens: 0, cost: 0 };
      acc[key].count++;
      acc[key].tokens += l.total_tokens || 0;
      acc[key].cost += parseFloat(l.estimated_cost_usd) || 0;
      return acc;
    }, {})
  )
    .map(([feature, d]) => ({ feature, label: FEATURE_LABELS[feature] || feature, ...d }))
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
  ).map(([model, d]) => ({ model, ...d }));

  // By user
  const byUser = Object.entries(
    logs.reduce((acc: Record<string, { count: number; tokens: number; name: string }>, l: any) => {
      const key = l.user_id || "system";
      const name = l.profiles?.display_name ||
        [l.profiles?.first_name, l.profiles?.last_name].filter(Boolean).join(" ") ||
        "System / Automated";
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
    { label: "Total Requests", value: totalRequests.toLocaleString(), icon: Brain, sub: `Last ${days} days` },
    { label: "Tokens Used", value: formatTokens(totalTokens), icon: Zap, sub: "Input + output" },
    { label: "Estimated Cost", value: formatCost(totalCost), icon: DollarSign, sub: "Based on published rates" },
    { label: "Features Used", value: byFeature.length.toString(), icon: TrendingUp, sub: "Distinct AI features" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Track AI model usage, estimated costs, and which features are calling AI.
          </p>
        </div>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="pt-4 pb-3">
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="rounded-md bg-primary/10 p-1.5 mt-0.5 shrink-0">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                      <p className="text-xs font-medium text-foreground">{kpi.label}</p>
                      <p className="text-[10px] text-muted-foreground">{kpi.sub}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Requests by feature */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Requests by Feature</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : byFeature.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-xs">
                No AI calls recorded yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byFeature} layout="vertical" barSize={12}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip
                    formatter={(v: number, name: string) => [v, name === "count" ? "Requests" : name]}
                    contentStyle={{ fontSize: 11 }}
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
            <CardTitle className="text-sm">Daily Request Volume</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : byDay.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-xs">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byDay}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Model breakdown + per-user */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Models */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Models Used</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : byModel.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">No data</div>
            ) : (
              <div className="space-y-2">
                {byModel.map((m, i) => (
                  <div key={m.model} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: FEATURE_COLORS[i % FEATURE_COLORS.length] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">{m.model}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{m.count} calls</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(m.count / totalRequests) * 100}%`,
                            background: FEATURE_COLORS[i % FEATURE_COLORS.length],
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatTokens(m.tokens)} tokens</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per user */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Usage by Team Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : byUser.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">No data</div>
            ) : (
              <div className="space-y-2">
                {byUser.map((u) => (
                  <div key={u.uid} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-semibold text-primary">
                          {u.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs truncate">{u.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{formatTokens(u.tokens)} tokens</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{u.count} calls</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cost breakdown by feature */}
      {byFeature.some((f) => f.cost > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Estimated Cost by Feature</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {byFeature.map((f) => (
                <div key={f.feature} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{f.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{f.count} calls · {formatTokens(f.tokens)} tokens</span>
                    <span className="font-medium text-foreground w-16 text-right">{formatCost(f.cost)}</span>
                  </div>
                </div>
              ))}
              <div className="border-t pt-1.5 flex items-center justify-between text-xs font-semibold">
                <span>Total (estimated)</span>
                <span>{formatCost(totalCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground">
        * Costs are estimates based on published Lovable AI pricing. Actual billing is managed through your Lovable workspace.
      </p>
    </div>
  );
}
