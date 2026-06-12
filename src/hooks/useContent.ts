import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContentCandidate {
  id: string;
  title: string;
  content_type: string;
  priority: string;
  status: string;
  relevance_score: number | null;
  key_topics: string[] | null;
  reasoning: string | null;
  team_questions_count: number | null;
  source_type: string | null;
  source_url: string | null;
  content_preview: string | null;
  recommended_format: string | null;
  estimated_minutes: number | null;
  created_at: string;
}

export interface GeneratedContent {
  id: string;
  candidate_id: string | null;
  title: string | null;
  content: string | null;
  word_count: number | null;
  status: string;
  content_type: string;
  generated_at: string;
  published_url: string | null;
}

export function useContentCandidates() {
  return useQuery({
    queryKey: ["content-candidates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_candidates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ContentCandidate[];
    },
  });
}

export function useGeneratedFor(candidateId: string | null) {
  return useQuery({
    queryKey: ["generated-content", candidateId],
    enabled: !!candidateId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("generated_content")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as GeneratedContent) || null;
    },
  });
}

export function usePublishedContent() {
  return useQuery({
    queryKey: ["published-content"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("generated_content")
        .select("*")
        .eq("status", "published")
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as GeneratedContent[];
    },
  });
}

export function useUpdateCandidateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("content_candidates")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-candidates"] }),
  });
}

// Draft a candidate via Beacon's real LLM (beacon-proxy → /api/content/generate),
// save the draft, and advance the candidate to 'drafted'.
export function useGenerateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (candidate: ContentCandidate) => {
      const { data, error } = await supabase.functions.invoke("beacon-proxy?action=content-generate", {
        body: {
          candidate_id: candidate.id,
          title: candidate.title,
          content_type: candidate.content_type,
          topics: candidate.key_topics,
          reasoning: candidate.reasoning,
        },
      });
      if (error) throw new Error(error.message);
      const content = (data as any)?.content || "";
      const word_count = (data as any)?.word_count || content.split(/\s+/).filter(Boolean).length;

      await (supabase as any).from("generated_content").insert({
        id: `gen-${candidate.id}-${Date.now()}`,
        candidate_id: candidate.id,
        content_type: candidate.content_type,
        title: candidate.title,
        content,
        word_count,
        status: "draft",
      });
      await (supabase as any)
        .from("content_candidates")
        .update({ status: "drafted", updated_at: new Date().toISOString() })
        .eq("id", candidate.id);
      return { content, word_count };
    },
    onSuccess: (_d, candidate) => {
      qc.invalidateQueries({ queryKey: ["content-candidates"] });
      qc.invalidateQueries({ queryKey: ["generated-content", candidate.id] });
    },
  });
}
