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
// name variants) into one canonical identity — fallback when no profile match.
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

  // Team roster — lets us merge UUID/Google-id rows back to a person and
  // seed Team Activity with all teammates (so Don / Natalia / Sheri show up too).
  const teamProfiles = useQuery({
    queryKey: ["beacon-team-profiles"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("user_id, first_name, last_name, display_name, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const isLoading = interactions.isLoading || apiUsage.isLoading || suggestions.isLoading;
  const rows = interactions.data || [];
  const costs = apiUsage.data || [];
  const pendingSuggestions = suggestions.data || [];
  const reviewedSuggestions = reviewed.data || [];
  const profiles = teamProfiles.data || [];

  // Build identity-merge maps from the team roster.
  const profileKeyOf = (p: any) => {
    const dn = (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`).trim();
    return (p.user_id || dn).toLowerCase();
  };
  const uidToProfile: Record<string, any> = {};
  const nameToProfile: Record<string, any> = {};
  profiles.forEach((p: any) => {
    if (p.user_id) uidToProfile[p.user_id.toLowerCase()] = p;
    const dn = (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`).trim();
    if (dn) nameToProfile[dn.toLowerCase()] = p;
  });
  // Link known email logins to a profile via the row's user_name
  // (logs use "manny@..." as uid + "Manny Russell" as name).
  rows.forEach((r: any) => {
    const uid = (r.user_id || "").toLowerCase();
    if (uid.includes("@") && r.user_name) {
      const p = nameToProfile[r.user_name.toLowerCase().trim()];
      if (p && !uidToProfile[uid]) uidToProfile[uid] = p;
    }
  });

  const humanRows = rows.filter((r: any) => !isSynthetic(r.user_id || "", r.user_name || ""));

  function identityFor(r: any): { key: string; displayName: string; profile?: any } {
    const uid = (r.user_id || "").toLowerCase().trim();
    const nm = (r.user_name || "").toLowerCase().trim();
    const p = uidToProfile[uid] || nameToProfile[nm];
    if (p) {
      const dn = (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`).trim();
      return { key: profileKeyOf(p), displayName: dn || r.user_name || uid, profile: p };
    }
    const c = canonicalIdentity(r.user_id || "", r.user_name || "");
    return { key: c.key, displayName: c.displayName };
  }

  const totalQuestions = humanRows.length;
  const activeUsers = new Set(humanRows.map((r: any) => identityFor(r).key)).size;
  const toPct = (v: any): number | null =>
    v == null ? null : Math.round(Number(v) <= 1 ? Number(v) * 100 : Number(v));
  const confRows = humanRows.filter((r: any) => r.confidence != null);
  const avgConfidence = confRows.length
    ? Math.round(confRows.reduce((s: number, r: any) => s + (toPct(r.confidence) || 0), 0) / confRows.length)
    : 0;
  const pendingCount = pendingSuggestions.length;

  const dailyCounts: Record<string, number> = {};
  humanRows.forEach((r: any) => {
    const day = (r.timestamp || "").slice(0, 10);
    if (day) dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  });
  const questionsOverTime = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: format(new Date(date), "MMM dd"), count }));

  const shapeRow = (r: any) => ({
    id: r.id,
    question: r.question || "",
    response: r.response || "",
    confidence: toPct(r.confidence) ?? 0,
    sourcesCount: r.sources_used ? (() => { try { return JSON.parse(r.sources_used).length; } catch { return 0; } })() : 0,
    topic: r.topic || "",
    userName: identityFor(r).displayName,
    timestamp: r.timestamp,
    timestampRelative: r.timestamp ? formatDistanceToNow(new Date(r.timestamp), { addSuffix: true }) : "",
    costUsd: Number(r.cost_usd || 0),
    responseTimeMs: r.response_time_ms || 0,
  });

  // Topics breakdown + per-topic drill-down items.
  const topicGroups: Record<string, any[]> = {};
  humanRows.forEach((r: any) => {
    const t = r.topic || "Uncategorized";
    (topicGroups[t] = topicGroups[t] || []).push(r);
  });
  const topicBreakdown = Object.entries(topicGroups)
    .map(([topic, items]) => ({
      topic,
      count: items.length,
      items: items
        .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""))
        .map(shapeRow),
    }))
    .sort((a, b) => b.count - a.count);

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

  // Top questions + per-question drill-down (every time it was asked + the response given).
  const questionGroups: Record<string, any[]> = {};
  humanRows
    .filter((r: any) => !r.command)
    .forEach((r: any) => {
      const q = r.question || "";
      (questionGroups[q] = questionGroups[q] || []).push(r);
    });
  const topQuestions = Object.entries(questionGroups)
    .map(([question, items]) => {
      const sorted = [...items].sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
      const lastAsked = sorted[0]?.timestamp || "";
      return {
        question,
        count: items.length,
        lastAsked,
        lastAskedRelative: lastAsked ? formatDistanceToNow(new Date(lastAsked), { addSuffix: true }) : "",
        items: sorted.map(shapeRow),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const recentConversations = humanRows.slice(0, 20).map(shapeRow);

  // ── Costs ──────────────────────────────────────────────────────────────
  // beacon_api_usage is currently empty in prod; derive from beacon_interactions
  // (each row carries cost_usd) so the cards aren't all $0.00.
  const useInteractionCosts = costs.length === 0;
  const costSourceRows = useInteractionCosts
    ? humanRows.map((r: any) => ({ timestamp: r.timestamp, api_name: "beacon", cost_usd: Number(r.cost_usd || 0) }))
    : costs;

  const costByProvider: Record<string, number> = {};
  costSourceRows.forEach((c: any) => {
    const p = c.api_name || "unknown";
    costByProvider[p] = (costByProvider[p] || 0) + (c.cost_usd || 0);
  });
  const costBreakdown = Object.entries(costByProvider).map(([provider, total]) => ({
    provider: provider.charAt(0).toUpperCase() + provider.slice(1),
    total,
  }));
  const totalCost = costSourceRows.reduce((s: number, c: any) => s + (c.cost_usd || 0), 0);

  const dailyCosts: Record<string, Record<string, number>> = {};
  costSourceRows.forEach((c: any) => {
    const day = (c.timestamp || "").slice(0, 10);
    if (!day) return;
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
  const costProviderKeys = [...new Set(costSourceRows.map((c: any) => c.api_name || "unknown"))];

  // Team activity — seed from the active roster so teammates with 0 questions
  // (Don / Natalia / Sheri) still appear, then merge in real counts.
  const userStats: Record<string, { count: number; totalConf: number; confCount: number; lastActive: string; name: string }> = {};
  profiles.forEach((p: any) => {
    const key = profileKeyOf(p);
    const dn = (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`).trim();
    userStats[key] = { count: 0, totalConf: 0, confCount: 0, lastActive: "", name: dn || key };
  });
  humanRows.forEach((r: any) => {
    const { key, displayName } = identityFor(r);
    if (!userStats[key]) userStats[key] = { count: 0, totalConf: 0, confCount: 0, lastActive: r.timestamp, name: displayName };
    userStats[key].count++;
    if (displayName.length > userStats[key].name.length && !displayName.includes("@")) {
      userStats[key].name = displayName;
    }
    if (r.confidence != null) { userStats[key].totalConf += toPct(r.confidence) || 0; userStats[key].confCount++; }
    if (!userStats[key].lastActive || r.timestamp > userStats[key].lastActive) userStats[key].lastActive = r.timestamp;
  });
  const teamActivity = Object.entries(userStats)
    .map(([uid, d]) => ({
      uid,
      name: d.name,
      count: d.count,
      avgConfidence: d.confCount ? Math.round(d.totalConf / d.confCount) : 0,
      lastActive: d.lastActive,
      lastActiveRelative: d.lastActive ? formatDistanceToNow(new Date(d.lastActive), { addSuffix: true }) : "Never",
    }))
    .sort((a, b) => b.count - a.count);

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
