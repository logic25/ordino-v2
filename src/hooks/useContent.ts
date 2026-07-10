import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ContentCandidate {
  id: string;
  title: string;
  content_type: string;
  priority: string;
  status: string;
  relevance_score: number | null;
  demand_score: number | null;
  search_interest: string | null;
  key_topics: string[] | null;
  reasoning: string | null;
  review_question: string | null;
  team_questions: string[] | null;
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
  cover_image_url?: string | null;
  cover_image_attribution?: string | null;
}

// ── Editorial-placeholder scrubber ───────────────────────────────────────
// Beacon's content generator sometimes emits human-review markers like
// "[[CONFIRM: verify the objection rate]]" or "[[TODO: add stat]]". They must
// never reach the live site, so we strip them defensively at three layers:
//   1. right after Beacon returns a draft (useGenerateDraft / useQuickGenerate)
//   2. every time the editor saves (useSaveDraft)
//   3. server-side inside publish-to-blog as a final publish guard
export const EDITORIAL_PLACEHOLDER_RE = /\[\[(?:CONFIRM|TODO|VERIFY|CHECK|FACT-?CHECK)\b[^\]]*\]\]/gi;

export function stripEditorialPlaceholders(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(EDITORIAL_PLACEHOLDER_RE, "")
    // Collapse the whitespace left behind so titles/paragraphs don't get gappy.
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function findEditorialPlaceholders(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.match(EDITORIAL_PLACEHOLDER_RE) || [];
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

// Bulk fetch: latest draft per candidate id, keyed by candidate id.
// Used by the Content pipeline so each card can show an inline excerpt + Copy.
export function useGeneratedForMany(candidateIds: string[]) {
  return useQuery({
    queryKey: ["generated-content-many", [...candidateIds].sort().join(",")],
    enabled: candidateIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("generated_content")
        .select("*")
        .in("candidate_id", candidateIds)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      const byCandidate: Record<string, GeneratedContent> = {};
      for (const row of (data || []) as GeneratedContent[]) {
        if (row.candidate_id && !byCandidate[row.candidate_id]) {
          byCandidate[row.candidate_id] = row;
        }
      }
      return byCandidate;
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

// Compose from scratch: create a manual candidate + a draft pre-filled from a
// template skeleton, landing straight in "drafted" so you can edit & publish it.
export function useComposeContent() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async ({ title, content_type, body }: { title: string; content_type: string; body: string }) => {
      const id = `manual-${Date.now()}`;
      const word_count = body.split(/\s+/).filter(Boolean).length;
      const { error: e1 } = await (supabase as any).from("content_candidates").insert({
        id, title, content_type, priority: "medium", status: "drafted",
        source_type: "manual", reasoning: "Composed from scratch",
        company_id: profile?.company_id,
      });
      if (e1) throw e1;
      const { error: e2 } = await (supabase as any).from("generated_content").insert({
        id: `gen-${id}`, candidate_id: id, content_type, title, content: body, word_count, status: "draft",
        company_id: profile?.company_id,
      });
      if (e2) throw e2;
      return { id, title, content_type, status: "drafted", priority: "medium", source_type: "manual" } as unknown as ContentCandidate;
    },
    onSuccess: (cand) => {
      qc.invalidateQueries({ queryKey: ["content-candidates"] });
      qc.invalidateQueries({ queryKey: ["generated-content", cand.id] });
    },
  });
}

// "+ Write about…" — create an ad-hoc manual candidate (pending) and immediately
// run the same Beacon Generate flow used by the question-cluster cards.
export function useQuickGenerate() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async ({ title, content_type = "blog_post" }: { title: string; content_type?: string }) => {
      const id = `manual-${Date.now()}`;
      const { error: cErr } = await (supabase as any).from("content_candidates").insert({
        id, title, content_type, priority: "medium", status: "pending",
        source_type: "manual", reasoning: "Ad-hoc topic",
        company_id: profile?.company_id,
      });
      if (cErr) throw cErr;

      const { data, error } = await supabase.functions.invoke("beacon-proxy?action=content-generate", {
        body: { candidate_id: id, title, content_type, topics: [], reasoning: "Ad-hoc topic" },
      });
      if (error) throw new Error(error.message);
      const rawContent = (data as any)?.content || "";
      const content = stripEditorialPlaceholders(rawContent);
      const cleanTitle = stripEditorialPlaceholders(title);
      const word_count = content.split(/\s+/).filter(Boolean).length;

      await (supabase as any).from("generated_content").insert({
        id: `gen-${id}-${Date.now()}`,
        candidate_id: id,
        content_type,
        title: cleanTitle,
        content,
        word_count,
        status: "draft",
        company_id: profile?.company_id,
      });
      await (supabase as any).from("content_candidates")
        .update({ status: "drafted", title: cleanTitle, updated_at: new Date().toISOString() }).eq("id", id);

      return { id, title: cleanTitle, content_type, status: "drafted", priority: "medium", source_type: "manual" } as unknown as ContentCandidate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-candidates"] });
      qc.invalidateQueries({ queryKey: ["generated-content-many"] });
    },
  });
}

// Save an edited draft body back to generated_content (re-counts words).
// Optionally updates the title too — used by the "Remove placeholders" cleanup
// action so it can scrub the title in the same round-trip.
export function useSaveDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, candidateId, content, title }: { id: string; candidateId: string; content: string; title?: string }) => {
      const cleanedContent = stripEditorialPlaceholders(content);
      const word_count = cleanedContent.split(/\s+/).filter(Boolean).length;
      const patch: Record<string, unknown> = { content: cleanedContent, word_count };
      if (typeof title === "string") patch.title = stripEditorialPlaceholders(title);
      const { error } = await (supabase as any)
        .from("generated_content")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      // Mirror any title change onto the candidate row so the pipeline card
      // and Published tab don't keep showing the old placeholder-laden title.
      if (typeof title === "string") {
        await (supabase as any)
          .from("content_candidates")
          .update({ title: stripEditorialPlaceholders(title), updated_at: new Date().toISOString() })
          .eq("id", candidateId);
      }
      return { candidateId };
    },
    onSuccess: ({ candidateId }) => {
      qc.invalidateQueries({ queryKey: ["generated-content", candidateId] });
      qc.invalidateQueries({ queryKey: ["generated-content-many"] });
      qc.invalidateQueries({ queryKey: ["content-candidates"] });
      qc.invalidateQueries({ queryKey: ["published-content"] });
    },
  });
}


// Hard-delete a candidate and ALL of its generated drafts. Used by the trash
// icon on each idea card (admin/manager gated in the UI). The "skip" status
// remains the soft-hide path; this one is for actually removing junk ideas.
export function useDeleteCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (candidateId: string) => {
      // Drafts first (no FK cascade is assumed) so we don't orphan rows.
      const { error: dErr } = await (supabase as any)
        .from("generated_content").delete().eq("candidate_id", candidateId);
      if (dErr) throw dErr;
      const { error: cErr } = await (supabase as any)
        .from("content_candidates").delete().eq("id", candidateId);
      if (cErr) throw cErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-candidates"] });
      qc.invalidateQueries({ queryKey: ["generated-content-many"] });
      qc.invalidateQueries({ queryKey: ["published-content"] });
    },
  });
}

// Persist the chosen cover image (Unsplash/Pexels/manual upload) on the draft.
// Stored alongside the content so we can re-render the post anywhere later.
export function useSetCoverImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ draftId, candidateId, url, attribution }: { draftId: string; candidateId: string; url: string; attribution: string }) => {
      const { error } = await (supabase as any)
        .from("generated_content")
        .update({ cover_image_url: url, cover_image_attribution: attribution })
        .eq("id", draftId);
      if (error) throw error;
      return { candidateId };
    },
    onSuccess: ({ candidateId }) => {
      qc.invalidateQueries({ queryKey: ["generated-content", candidateId] });
      qc.invalidateQueries({ queryKey: ["generated-content-many"] });
    },
  });
}


// Publish: push an approved draft to the marketing site and mark both the
// draft row and its candidate as published. The server-side edge function does
// the marketing-site POST + database updates so the shared secret never leaves
// the backend.
export function usePublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ draftId, candidateId }: { draftId: string; candidateId: string }) => {
      const { data, error } = await supabase.functions.invoke("publish-to-blog", {
        body: { draft_id: draftId, candidate_id: candidateId },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any) || null;
    },
    onSuccess: (_d, { candidateId }) => {
      qc.invalidateQueries({ queryKey: ["content-candidates"] });
      qc.invalidateQueries({ queryKey: ["published-content"] });
      qc.invalidateQueries({ queryKey: ["generated-content", candidateId] });
      qc.invalidateQueries({ queryKey: ["generated-content-many"] });
    },
  });
}


// Draft a candidate via Beacon's real LLM (beacon-proxy → /api/content/generate),
// save the draft, and advance the candidate to 'drafted'.
export function useGenerateDraft() {
  const qc = useQueryClient();
  const { profile } = useAuth();
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
      const content = stripEditorialPlaceholders((data as any)?.content || "");
      const cleanTitle = stripEditorialPlaceholders(candidate.title);
      const word_count = content.split(/\s+/).filter(Boolean).length;

      await (supabase as any).from("generated_content").insert({
        id: `gen-${candidate.id}-${Date.now()}`,
        candidate_id: candidate.id,
        content_type: candidate.content_type,
        title: cleanTitle,
        content,
        word_count,
        status: "draft",
        company_id: profile?.company_id,
      });
      await (supabase as any)
        .from("content_candidates")
        .update({ status: "drafted", title: cleanTitle, updated_at: new Date().toISOString() })
        .eq("id", candidate.id);
      return { content, word_count };
    },
    onSuccess: (_d, candidate) => {
      qc.invalidateQueries({ queryKey: ["content-candidates"] });
      qc.invalidateQueries({ queryKey: ["generated-content", candidate.id] });
      qc.invalidateQueries({ queryKey: ["generated-content-many"] });
    },
  });
}
