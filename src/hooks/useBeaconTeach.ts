import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────────────
export type KbGap = {
  id: number;
  question: string;
  topic: string | null;
  asked_count: number;
  last_asked_at: string;
  member_ids: number[];
};

export type NegativeFeedback = {
  id: number;
  timestamp: string;
  user_name: string | null;
  feedback_text: string;
  feedback_type: string | null;
  status: string;
};

export type PendingSuggestion = {
  id: number;
  timestamp: string;
  user_name: string | null;
  wrong_answer: string | null;
  correct_answer: string | null;
  topics: string | string[] | null;
};


// Parser for the 👍/👎 widget feedback_text format:
//   "👎 on Beacon answer — Q: <question> | A: <first 200 chars>"
// Known debt: this only works while the chat widget hard-codes that exact
// string. If parse misses, callers render the raw text and leave the
// answer-textarea empty.
export function parseFeedbackText(text: string): { question: string; answer: string } {
  if (!text) return { question: "", answer: "" };
  const qIdx = text.indexOf(" — Q: ");
  if (qIdx === -1) return { question: "", answer: "" };
  const rest = text.slice(qIdx + " — Q: ".length);
  const aIdx = rest.indexOf(" | A: ");
  if (aIdx === -1) return { question: rest.trim(), answer: "" };
  return { question: rest.slice(0, aIdx).trim(), answer: rest.slice(aIdx + " | A: ".length).trim() };
}

// ── Reads ───────────────────────────────────────────────────────────
export function useKbGaps() {
  return useQuery({
    queryKey: ["beacon-teach", "gaps"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("beacon-proxy?action=get_kb_gaps", {
        body: { data: { days: 60, limit: 50 } },
      });
      if (error) throw error;
      return ((data as any)?.gaps ?? []) as KbGap[];
    },
  });
}

export function useNegativeFeedback() {
  return useQuery({
    queryKey: ["beacon-teach", "feedback-negative"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beacon_feedback")
        .select("id, timestamp, user_name, feedback_text, feedback_type, status")
        .eq("status", "new")
        .eq("feedback_type", "negative")
        .order("timestamp", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as NegativeFeedback[];
    },
  });
}

export function usePendingSuggestionsForTeach() {
  return useQuery({
    queryKey: ["beacon-teach", "suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beacon_suggestions")
        .select("id, timestamp, user_name, wrong_answer, correct_answer, topics")
        .eq("status", "pending")
        .order("timestamp", { ascending: false });
      if (error) throw error;
      return (data || []) as PendingSuggestion[];
    },
  });
}

// ── Writes ──────────────────────────────────────────────────────────
async function postCorrection(args: { wrong_answer: string; correct_answer: string; topics: string[] }) {
  const { error } = await supabase.functions.invoke("beacon-proxy?action=correction", {
    body: { data: args },
  });
  if (error) throw error;
}

export function useTeachGap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { gap: KbGap; correctAnswer: string; topic?: string }) => {
      await postCorrection({
        wrong_answer: args.gap.question,
        correct_answer: args.correctAnswer,
        topics: args.topic ? [args.topic] : (args.gap.topic ? [args.gap.topic] : []),
      });
      const { error } = await supabase.functions.invoke("beacon-proxy?action=dismiss_kb_gap", {
        body: { data: { member_ids: args.gap.member_ids } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Taught Beacon — gap closed");
      qc.invalidateQueries({ queryKey: ["beacon-teach", "gaps"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to teach Beacon"),
  });
}

export function useDismissGap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (member_ids: number[]) => {
      const { error } = await supabase.functions.invoke("beacon-proxy?action=dismiss_kb_gap", {
        body: { data: { member_ids } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dismissed");
      qc.invalidateQueries({ queryKey: ["beacon-teach", "gaps"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to dismiss"),
  });
}

export function useTeachFromFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      feedback: NegativeFeedback;
      question: string;
      correctAnswer: string;
      topic?: string;
    }) => {
      await postCorrection({
        wrong_answer: args.question || args.feedback.feedback_text,
        correct_answer: args.correctAnswer,
        topics: args.topic ? [args.topic] : [],
      });
      const { error } = await supabase.functions.invoke("beacon-proxy?action=update_feedback_roadmap", {
        body: { data: { feedback_id: args.feedback.id, status: "resolved" } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Taught Beacon — flagged answer resolved");
      qc.invalidateQueries({ queryKey: ["beacon-teach", "feedback-negative"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to teach Beacon"),
  });
}

export function useDismissFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (feedback_id: number) => {
      const { error } = await supabase.functions.invoke("beacon-proxy?action=update_feedback_roadmap", {
        body: { data: { feedback_id, status: "resolved" } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dismissed");
      qc.invalidateQueries({ queryKey: ["beacon-teach", "feedback-negative"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to dismiss"),
  });
}

export function useApproveSuggestionTeach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { suggestion: PendingSuggestion; correctAnswer: string; topic?: string }) => {
      // Write the correction so Beacon learns it, then flip suggestion to approved.
      await postCorrection({
        wrong_answer: args.suggestion.wrong_answer || "",
        correct_answer: args.correctAnswer,
        topics: args.topic ? [args.topic] : (args.suggestion.topics ?? []),
      });
      const { error } = await supabase
        .from("beacon_suggestions")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", args.suggestion.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Approved — Beacon learned it");
      qc.invalidateQueries({ queryKey: ["beacon-teach", "suggestions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to approve"),
  });
}

export function useRejectSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (suggestion_id: number) => {
      const { error } = await supabase
        .from("beacon_suggestions")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", suggestion_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dismissed");
      qc.invalidateQueries({ queryKey: ["beacon-teach", "suggestions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to dismiss"),
  });
}

export function useQuickTeach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { question: string; answer: string; topic?: string }) => {
      await postCorrection({
        wrong_answer: args.question,
        correct_answer: args.answer,
        topics: args.topic ? [args.topic] : [],
      });
    },
    onSuccess: () => {
      toast.success("Added to Beacon's knowledge");
      qc.invalidateQueries({ queryKey: ["beacon-teach"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });
}
