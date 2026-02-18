import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FollowupDraft {
  id: string;
  company_id: string;
  project_id: string;
  draft_body: string;
  prompt_system: string | null;
  prompt_user: string | null;
  status: string;
  triggered_by: string;
  trigger_threshold_days: number | null;
  items_snapshot: any;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export function useChecklistFollowupDrafts(projectId?: string) {
  return useQuery({
    queryKey: ["checklist-followup-drafts", projectId || "all"],
    queryFn: async () => {
      let query = supabase
        .from("checklist_followup_drafts" as any)
        .select("*")
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false });

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FollowupDraft[];
    },
  });
}

export function usePendingDraftsCount() {
  return useQuery({
    queryKey: ["checklist-followup-drafts-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("checklist_followup_drafts" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_approval");
      if (error) throw error;
      return count || 0;
    },
  });
}

export function useApproveDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const { error } = await supabase
        .from("checklist_followup_drafts" as any)
        .update({
          status: "approved",
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-followup-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-followup-drafts-count"] });
    },
  });
}

export function useDismissDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase
        .from("checklist_followup_drafts" as any)
        .update({ status: "dismissed" })
        .eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-followup-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-followup-drafts-count"] });
    },
  });
}
