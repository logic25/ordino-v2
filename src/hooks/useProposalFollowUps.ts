import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProposalFollowUp {
  id: string;
  proposal_id: string;
  company_id: string;
  action: string;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
}

export function useProposalsNeedingFollowUp() {
  return useQuery({
    queryKey: ["proposals-needing-followup"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("proposals")
        .select(`
          *,
          properties (id, address, borough),
          assigned_pm:profiles!proposals_assigned_pm_id_fkey (id, first_name, last_name),
          creator:profiles!proposals_created_by_fkey (id, first_name, last_name),
          sales_person:profiles!proposals_sales_person_id_fkey (id, first_name, last_name)
        `)
        .lte("next_follow_up_date", today)
        .is("follow_up_dismissed_at", null)
        .in("status", ["sent", "viewed"])
        .order("next_follow_up_date", { ascending: true });

      if (error) throw error;
      return data as any[];
    },
  });
}

export function useProposalFollowUpLog(proposalId: string | undefined) {
  return useQuery({
    queryKey: ["proposal-follow-ups", proposalId],
    queryFn: async () => {
      if (!proposalId) return [];
      const { data, error } = await supabase
        .from("proposal_follow_ups")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ProposalFollowUp[];
    },
    enabled: !!proposalId,
  });
}

export function useMarkProposalApproved() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      approvalMethod,
      signedDocumentUrl,
      notes,
    }: {
      id: string;
      approvalMethod: string;
      signedDocumentUrl?: string;
      notes?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile) throw new Error("Profile not found");

      // Update proposal
      const { error } = await supabase
        .from("proposals")
        .update({
          status: "accepted",
          approval_method: approvalMethod,
          signed_document_url: signedDocumentUrl || null,
          next_follow_up_date: null,
          follow_up_dismissed_at: null,
        } as any)
        .eq("id", id);

      if (error) throw error;

      // Log the activity
      await supabase.from("proposal_follow_ups").insert({
        proposal_id: id,
        company_id: profile.company_id,
        action: "approved",
        notes: notes || `Approved via ${approvalMethod.replace("_", " ")}`,
        performed_by: profile.id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals-needing-followup"] });
    },
  });
}

export function useDismissFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase
        .from("proposals")
        .update({
          follow_up_dismissed_at: new Date().toISOString(),
          follow_up_dismissed_by: profile.id,
        } as any)
        .eq("id", id);

      if (error) throw error;

      await supabase.from("proposal_follow_ups").insert({
        proposal_id: id,
        company_id: profile.company_id,
        action: "dismissed",
        notes: notes || "Follow-up dismissed",
        performed_by: profile.id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals-needing-followup"] });
    },
  });
}

export function useLogFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      proposalId,
      action,
      notes,
    }: {
      proposalId: string;
      action: string;
      notes?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile) throw new Error("Profile not found");

      // Log activity
      await supabase.from("proposal_follow_ups").insert({
        proposal_id: proposalId,
        company_id: profile.company_id,
        action,
        notes,
        performed_by: profile.id,
      } as any);

      // Bump next follow-up date and count
      const { data: proposal } = await supabase
        .from("proposals")
        .select("follow_up_interval_days, follow_up_count")
        .eq("id", proposalId)
        .single();

      const interval = (proposal as any)?.follow_up_interval_days || 7;
      const count = ((proposal as any)?.follow_up_count || 0) + 1;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + interval);

      await supabase
        .from("proposals")
        .update({
          follow_up_count: count,
          last_follow_up_at: new Date().toISOString(),
          next_follow_up_date: nextDate.toISOString().split("T")[0],
          follow_up_dismissed_at: null,
        } as any)
        .eq("id", proposalId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals-needing-followup"] });
      queryClient.invalidateQueries({ queryKey: ["proposal-follow-ups"] });
    },
  });
}

export function useSnoozeFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + days);

      const { error } = await supabase
        .from("proposals")
        .update({
          next_follow_up_date: nextDate.toISOString().split("T")[0],
          follow_up_dismissed_at: null,
        } as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["proposals-needing-followup"] });
    },
  });
}
