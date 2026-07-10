import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Content Analytics — read-only aggregations over data we already have.
 * NO estimates, NO mocks. If a metric has zero rows, we return zeros and
 * the UI shows an honest "No data yet" empty state.
 */

export interface FunnelStats {
  ideas: number;
  drafted: number;
  published: number;
  medianDaysToPublish: number | null; // null = no published posts yet
}

export interface SourceMixRow {
  month: string; // YYYY-MM
  content_type: string;
  manual: number;
  beacon: number;
}

export interface PublishedPost {
  id: string;
  candidate_id: string | null;
  title: string;
  content_type: string;
  published_at: string | null;
  citations: number;
  ai_cost_usd: number; // 0 when no ai_usage_logs row references this candidate
}

export interface ContentGap {
  cluster: string;
  question_count: number;
  sample_questions: string[];
  avg_confidence: number | null;
}

const CONFIDENCE_THRESHOLD = 0.6;

// --- Funnel + author/source mix --------------------------------------------
export function useContentFunnel() {
  return useQuery({
    queryKey: ["content-analytics", "funnel"],
    queryFn: async (): Promise<{
      funnel: FunnelStats;
      sourceMix: SourceMixRow[];
    }> => {
      const [candRes, genRes] = await Promise.all([
        (supabase as any)
          .from("content_candidates")
          .select("id, status, source_type, content_type, created_at"),
        (supabase as any)
          .from("generated_content")
          .select("id, candidate_id, status, content_type, generated_at, published_at"),
      ]);
      if (candRes.error) throw candRes.error;
      if (genRes.error) throw genRes.error;

      const candidates = (candRes.data || []) as any[];
      const generated = (genRes.data || []) as any[];

      const ideas = candidates.length;
      const drafted = generated.length;
      const publishedRows = generated.filter((g) => g.status === "published");
      const published = publishedRows.length;

      // Time-to-publish: candidate.created_at → generated.published_at
      const candById = new Map(candidates.map((c) => [c.id, c]));
      const durationsDays: number[] = [];
      for (const g of publishedRows) {
        if (!g.published_at || !g.candidate_id) continue;
        const cand = candById.get(g.candidate_id);
        if (!cand?.created_at) continue;
        const ms = new Date(g.published_at).getTime() - new Date(cand.created_at).getTime();
        if (isFinite(ms) && ms >= 0) durationsDays.push(ms / (1000 * 60 * 60 * 24));
      }
      let medianDaysToPublish: number | null = null;
      if (durationsDays.length) {
        const sorted = [...durationsDays].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        medianDaysToPublish =
          sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      }

      // Source mix — manual vs Beacon by month × content_type
      const mixMap = new Map<string, SourceMixRow>();
      for (const g of generated) {
        const cand = g.candidate_id ? candById.get(g.candidate_id) : null;
        const when = g.generated_at || cand?.created_at;
        if (!when) continue;
        const month = when.slice(0, 7);
        const ctype = g.content_type || cand?.content_type || "blog_post";
        const key = `${month}::${ctype}`;
        const isManual = (cand?.source_type || "").toLowerCase() === "manual";
        const row =
          mixMap.get(key) || { month, content_type: ctype, manual: 0, beacon: 0 };
        if (isManual) row.manual += 1;
        else row.beacon += 1;
        mixMap.set(key, row);
      }
      const sourceMix = [...mixMap.values()].sort((a, b) =>
        a.month === b.month
          ? a.content_type.localeCompare(b.content_type)
          : a.month.localeCompare(b.month),
      );

      return {
        funnel: { ideas, drafted, published, medianDaysToPublish },
        sourceMix,
      };
    },
  });
}

// --- Published posts + Beacon citations + cost -----------------------------
export function usePublishedPostAnalytics() {
  return useQuery({
    queryKey: ["content-analytics", "published-posts"],
    queryFn: async (): Promise<PublishedPost[]> => {
      const { data: posts, error } = await (supabase as any)
        .from("generated_content")
        .select("id, candidate_id, title, content_type, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (error) throw error;
      const published = (posts || []) as any[];
      if (published.length === 0) return [];

      // Fetch Beacon interactions that returned any sources — we'll substring
      // match post titles against the sources_used JSON text. It's imprecise
      // but honest: we count only interactions that DID cite something.
      const { data: interactions } = await (supabase as any)
        .from("beacon_interactions")
        .select("sources_used, timestamp")
        .eq("had_sources", true)
        .not("sources_used", "is", null);

      const sourceStrings = ((interactions || []) as any[]).map(
        (r) => (r.sources_used || "") as string,
      );

      // AI cost per candidate — from ai_usage_logs.metadata.candidate_id.
      // When no rows exist for a candidate, cost is 0 (shown honestly).
      const candIds = published
        .map((p) => p.candidate_id)
        .filter(Boolean) as string[];
      const costByCandidate = new Map<string, number>();
      if (candIds.length) {
        const { data: usage } = await (supabase as any)
          .from("ai_usage_logs")
          .select("estimated_cost_usd, metadata")
          .in("feature", ["content_generate", "content-generate", "beacon_content_generate"]);
        for (const row of (usage || []) as any[]) {
          const cid = row?.metadata?.candidate_id;
          if (!cid) continue;
          costByCandidate.set(
            cid,
            (costByCandidate.get(cid) || 0) + Number(row.estimated_cost_usd || 0),
          );
        }
      }

      return published.map((p) => {
        const title = (p.title || "").trim();
        let citations = 0;
        if (title.length >= 4) {
          const needle = title.toLowerCase();
          for (const s of sourceStrings) {
            if (s.toLowerCase().includes(needle)) citations += 1;
          }
        }
        return {
          id: p.id,
          candidate_id: p.candidate_id,
          title: p.title || "(untitled)",
          content_type: p.content_type || "blog_post",
          published_at: p.published_at,
          citations,
          ai_cost_usd: p.candidate_id
            ? costByCandidate.get(p.candidate_id) || 0
            : 0,
        };
      });
    },
  });
}

// --- Content gaps (Beacon questions with no KB source / low confidence) ----
export function useContentGaps() {
  return useQuery({
    queryKey: ["content-analytics", "gaps"],
    queryFn: async (): Promise<ContentGap[]> => {
      const { data, error } = await (supabase as any)
        .from("beacon_interactions")
        .select("question, topic, had_sources, confidence, sources_used")
        .order("timestamp", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const rows = (data || []) as any[];

      const gapRows = rows.filter((r) => {
        const noSource =
          r.had_sources === false ||
          !r.sources_used ||
          r.sources_used === "[]" ||
          r.sources_used === "null";
        const lowConf =
          r.confidence != null && Number(r.confidence) < CONFIDENCE_THRESHOLD;
        return noSource || lowConf;
      });

      const byTopic = new Map<
        string,
        { qs: string[]; confs: number[] }
      >();
      for (const r of gapRows) {
        const topic = (r.topic || "Uncategorized").trim() || "Uncategorized";
        const entry = byTopic.get(topic) || { qs: [], confs: [] };
        if (r.question) entry.qs.push(r.question);
        if (r.confidence != null) entry.confs.push(Number(r.confidence));
        byTopic.set(topic, entry);
      }

      return [...byTopic.entries()]
        .map(([cluster, v]) => ({
          cluster,
          question_count: v.qs.length,
          sample_questions: v.qs.slice(0, 3),
          avg_confidence: v.confs.length
            ? v.confs.reduce((a, b) => a + b, 0) / v.confs.length
            : null,
        }))
        .sort((a, b) => b.question_count - a.question_count)
        .slice(0, 12);
    },
  });
}
