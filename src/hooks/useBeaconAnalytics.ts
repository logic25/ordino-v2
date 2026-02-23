import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, formatDistanceToNow } from "date-fns";

export type DateRange = "7" | "30" | "90" | "all";

function getDateStart(range: DateRange): string | null {
  if (range === "all") return null;
  return subDays(new Date(), parseInt(range)).toISOString();
}

export function useBeaconAnalytics(dateRange: DateRange) {
  const since = getDateStart(dateRange);

  const interactions = useQuery({
    queryKey: ["beacon-interactions", dateRange],
    queryFn: async () => {
      let q = supabase
        .from("beacon_interactions")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(1000);
      if (since) q = q.gte("timestamp", since);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const apiUsage = useQuery({
    queryKey: ["beacon-api-usage", dateRange],
    queryFn: async () => {
      let q = supabase
        .from("beacon_api_usage")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(1000);
      if (since) q = q.gte("timestamp", since);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const suggestions = useQuery({
    queryKey: ["beacon-suggestions", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beacon_suggestions")
        .select("*")
        .eq("status", "pending")
        .order("timestamp", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const isLoading = interactions.isLoading || apiUsage.isLoading || suggestions.isLoading;
  const rows = interactions.data || [];
  const costs = apiUsage.data || [];
  const pendingSuggestions = suggestions.data || [];

  // KPIs
  const totalQuestions = rows.length;
  const activeUsers = new Set(rows.map((r: any) => r.user_id)).size;
  const avgConfidence = rows.length
    ? Math.round(rows.reduce((s: number, r: any) => s + (r.confidence || 0), 0) / rows.length)
    : 0;
  const pendingCount = pendingSuggestions.length;

  // Questions over time (daily)
  const dailyCounts: Record<string, number> = {};
  rows.forEach((r: any) => {
    const day = (r.timestamp || "").slice(0, 10);
    if (day) dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  });
  const questionsOverTime = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: format(new Date(date), "MMM dd"), count }));

  // Topics breakdown
  const topicCounts: Record<string, number> = {};
  rows.forEach((r: any) => {
    const t = r.topic || "Uncategorized";
    topicCounts[t] = (topicCounts[t] || 0) + 1;
  });
  const topicBreakdown = Object.entries(topicCounts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);

  // Confidence distribution
  let high = 0, medium = 0, low = 0;
  rows.forEach((r: any) => {
    const c = r.confidence || 0;
    if (c >= 85) high++;
    else if (c >= 60) medium++;
    else low++;
  });
  const confidenceDistribution = [
    { name: "High (≥85%)", value: high, fill: "#10b981" },
    { name: "Medium (60-84%)", value: medium, fill: "#f59e0b" },
    { name: "Low (<60%)", value: low, fill: "#ef4444" },
  ].filter((d) => d.value > 0);

  // Top questions
  const questionCounts: Record<string, { count: number; lastAsked: string }> = {};
  rows
    .filter((r: any) => !r.command)
    .forEach((r: any) => {
      const q = r.question || "";
      if (!questionCounts[q]) questionCounts[q] = { count: 0, lastAsked: r.timestamp };
      questionCounts[q].count++;
      if (r.timestamp > questionCounts[q].lastAsked) questionCounts[q].lastAsked = r.timestamp;
    });
  const topQuestions = Object.entries(questionCounts)
    .map(([question, d]) => ({
      question,
      count: d.count,
      lastAsked: d.lastAsked,
      lastAskedRelative: formatDistanceToNow(new Date(d.lastAsked), { addSuffix: true }),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Recent conversations
  const recentConversations = rows.slice(0, 20).map((r: any) => ({
    id: r.id,
    question: r.question || "",
    response: r.response || "",
    confidence: r.confidence || 0,
    sourcesCount: r.sources_used ? (() => { try { return JSON.parse(r.sources_used).length; } catch { return 0; } })() : 0,
    timestamp: r.timestamp,
    timestampRelative: r.timestamp ? formatDistanceToNow(new Date(r.timestamp), { addSuffix: true }) : "",
    userName: r.user_name || r.user_id || "Unknown",
    topic: r.topic || "",
    responseTimeMs: r.response_time_ms || 0,
    costUsd: r.cost_usd || 0,
  }));

  // Cost by provider
  const costByProvider: Record<string, number> = {};
  costs.forEach((c: any) => {
    const p = c.api_name || "unknown";
    costByProvider[p] = (costByProvider[p] || 0) + (c.cost_usd || 0);
  });
  const costBreakdown = Object.entries(costByProvider).map(([provider, total]) => ({
    provider: provider.charAt(0).toUpperCase() + provider.slice(1),
    total,
  }));
  const totalCost = costs.reduce((s: number, c: any) => s + (c.cost_usd || 0), 0);

  // Daily costs for chart
  const dailyCosts: Record<string, Record<string, number>> = {};
  costs.forEach((c: any) => {
    const day = (c.timestamp || "").slice(0, 10);
    const p = c.api_name || "unknown";
    if (!dailyCosts[day]) dailyCosts[day] = {};
    dailyCosts[day][p] = (dailyCosts[day][p] || 0) + (c.cost_usd || 0);
  });
  const costOverTime = Object.entries(dailyCosts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, providers]) => ({
      date: format(new Date(date), "MMM dd"),
      ...providers,
    }));
  const costProviderKeys = [...new Set(costs.map((c: any) => c.api_name || "unknown"))];

  // Team activity
  const userStats: Record<string, { count: number; totalConf: number; lastActive: string; name: string }> = {};
  rows.forEach((r: any) => {
    const uid = r.user_id || "unknown";
    if (!userStats[uid]) userStats[uid] = { count: 0, totalConf: 0, lastActive: r.timestamp, name: r.user_name || uid };
    userStats[uid].count++;
    userStats[uid].totalConf += r.confidence || 0;
    if (r.timestamp > userStats[uid].lastActive) userStats[uid].lastActive = r.timestamp;
  });
  const teamActivity = Object.entries(userStats)
    .map(([uid, d]) => ({
      uid,
      name: d.name,
      count: d.count,
      avgConfidence: Math.round(d.totalConf / d.count),
      lastActive: d.lastActive,
      lastActiveRelative: formatDistanceToNow(new Date(d.lastActive), { addSuffix: true }),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    isLoading,
    totalQuestions,
    activeUsers,
    avgConfidence,
    pendingCount,
    questionsOverTime,
    topicBreakdown,
    confidenceDistribution,
    topQuestions,
    recentConversations,
    costBreakdown,
    totalCost,
    costOverTime,
    costProviderKeys,
    teamActivity,
    pendingSuggestions,
  };
}
