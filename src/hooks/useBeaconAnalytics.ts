import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, formatDistanceToNow } from "date-fns";

export type DateRange = "7" | "30" | "90" | "all";

// Approve/reject a Beacon KB correction suggestion. Approving flips status to
// 'approved'; Beacon's poller ingests approved corrections into the knowledge base.
export function useReviewSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reviewedBy }: { id: number; status: "approved" | "rejected"; reviewedBy?: string }) => {
      const { error } = await supabase
        .from("beacon_suggestions")
        .update({ status, reviewed_by: reviewedBy ?? null, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["beacon-suggestions"] }),
  });
}

function getDateStart(range: DateRange): string | null {
  if (range === "all") return null;
  return subDays(new Date(), parseInt(range)).toISOString();
}

// Synthetic / test identities that should NOT be counted as real human users.
const SYNTHETIC_ID_PATTERNS = [
  /^test$/i, /^unknown$/i, /^web-user$/i, /^anonymous$/i, /^guest$/i,
  /^users\/t$/i, /^users\/test$/i, /^users\/\d+$/i,
];
const SYNTHETIC_NAME_PATTERNS = [/^test/i, /^web user/i, /^anonymous/i, /^guest/i];

function isSynthetic(uid: string, name: string): boolean {
  if (!uid) return true;
  if (SYNTHETIC_ID_PATTERNS.some((re) => re.test(uid))) return true;
  if (SYNTHETIC_NAME_PATTERNS.some((re) => re.test(name || ""))) return true;
  return false;
}

// Collapse many shapes of "the same person" (email, profile UUID, Google id,
// name variants) into one canonical identity.
function canonicalIdentity(uid: string, name: string): { key: string; displayName: string } {
  const emailMatch = (uid?.includes("@") ? uid : name?.includes("@") ? name : "")
    .toLowerCase()
    .trim();
  if (emailMatch) {
    const pretty = name && !name.includes("@") ? name : emailMatch.split("@")[0];
    return { key: emailMatch, displayName: pretty };
  }
  const cleanName = (name || uid || "").trim();
  if (cleanName) {
    return { key: cleanName.toLowerCase().replace(/\s+/g, ""), displayName: cleanName };
  }
  return { key: uid || "unknown", displayName: uid || "Unknown" };
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

  // Reviewed (approved/rejected) corrections — the audit trail behind the Feedback panel.
  const reviewed = useQuery({
    queryKey: ["beacon-suggestions-reviewed", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beacon_suggestions")
        .select("*")
        .neq("status", "pending")
        .order("reviewed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const isLoading = interactions.isLoading || apiUsage.isLoading || suggestions.isLoading;
  const rows = interactions.data || [];
  const costs = apiUsage.data || [];
  const pendingSuggestions = suggestions.data || [];
  const reviewedSuggestions = reviewed.data || [];

  // Real human rows only (drop test/unknown/web-user/anonymous probes).
  const humanRows = rows.filter((r: any) => !isSynthetic(r.user_id || "", r.user_name || ""));

  // KPIs
  const totalQuestions = humanRows.length;
  // Active users = distinct canonical humans (Manny via email + UUID + Google id collapses to 1).
  const activeUsers = new Set(
    humanRows.map((r: any) => canonicalIdentity(r.user_id || "", r.user_name || "").key),
  ).size;
  // confidence is stored 0-1; normalize to 0-100 (tolerate already-0-100 rows), and
  // average only over rows that actually have a confidence (skip no-RAG/null rows).
  const toPct = (v: any): number | null =>
    v == null ? null : Math.round(Number(v) <= 1 ? Number(v) * 100 : Number(v));
  const confRows = humanRows.filter((r: any) => r.confidence != null);
  const avgConfidence = confRows.length
    ? Math.round(confRows.reduce((s: number, r: any) => s + (toPct(r.confidence) || 0), 0) / confRows.length)
    : 0;
  const pendingCount = pendingSuggestions.length;

  // Questions over time (daily)
  const dailyCounts: Record<string, number> = {};
  humanRows.forEach((r: any) => {
    const day = (r.timestamp || "").slice(0, 10);
    if (day) dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  });
  const questionsOverTime = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: format(new Date(date), "MMM dd"), count }));

  // Topics breakdown
  const topicCounts: Record<string, number> = {};
  humanRows.forEach((r: any) => {
    const t = r.topic || "Uncategorized";
    topicCounts[t] = (topicCounts[t] || 0) + 1;
  });
  const topicBreakdown = Object.entries(topicCounts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);

  // Confidence distribution
  let high = 0, medium = 0, low = 0;
  humanRows.forEach((r: any) => {
    if (r.confidence == null) return;
    const c = toPct(r.confidence) || 0;
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
  humanRows
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
  const recentConversations = humanRows.slice(0, 20).map((r: any) => ({
    id: r.id,
    question: r.question || "",
    response: r.response || "",
    confidence: toPct(r.confidence) ?? 0,
    sourcesCount: r.sources_used ? (() => { try { return JSON.parse(r.sources_used).length; } catch { return 0; } })() : 0,
    timestamp: r.timestamp,
    timestampRelative: r.timestamp ? formatDistanceToNow(new Date(r.timestamp), { addSuffix: true }) : "",
    userName: canonicalIdentity(r.user_id || "", r.user_name || "").displayName,
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
  const userStats: Record<string, { count: number; totalConf: number; confCount: number; lastActive: string; name: string }> = {};
  rows.forEach((r: any) => {
    const uid = r.user_id || "unknown";
    if (!userStats[uid]) userStats[uid] = { count: 0, totalConf: 0, confCount: 0, lastActive: r.timestamp, name: r.user_name || uid };
    userStats[uid].count++;
    if (r.confidence != null) { userStats[uid].totalConf += toPct(r.confidence) || 0; userStats[uid].confCount++; }
    if (r.timestamp > userStats[uid].lastActive) userStats[uid].lastActive = r.timestamp;
  });
  const teamActivity = Object.entries(userStats)
    .map(([uid, d]) => ({
      uid,
      name: d.name,
      count: d.count,
      avgConfidence: d.confCount ? Math.round(d.totalConf / d.confCount) : 0,
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
    reviewedSuggestions,
  };
}

// Turn a logged Beacon question into a content_candidate (feeds the Content pipeline).
export function useTurnQuestionIntoContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ question }: { question: string }) => {
      const title = (question || "").slice(0, 140);
      const { error } = await (supabase as any).from("content_candidates").insert({
        id: `beacon-q-${Date.now()}`,
        title,
        content_type: "blog_post",
        priority: "medium",
        status: "pending",
        source_type: "beacon_question",
        reasoning: "Surfaced from a real Beacon question — people are already asking this.",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-candidates"] }),
  });
}
