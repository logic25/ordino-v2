import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { ReferralStage, ReferralSourceType } from "@/components/bd/referralConstants";
import { STAGE_META } from "@/components/bd/referralConstants";

export interface BdReferral {
  id: string;
  company_id: string;
  source_contact_id: string | null;
  source_label: string | null;
  source_type: ReferralSourceType;
  referred_name: string;
  referred_company: string | null;
  referred_email: string | null;
  referred_phone: string | null;
  assigned_to: string | null;
  stage: ReferralStage;
  next_action_at: string | null;
  next_action_note: string | null;
  notes: string | null;
  lead_id: string | null;
  proposal_id: string | null;
  won_value: number | null;
  lost_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  assignee?: { id: string; first_name: string | null; last_name: string | null } | null;
  source_contact?: { id: string; name: string; company_name: string | null } | null;
  creator?: { id: string; first_name: string | null; last_name: string | null } | null;
}

const SELECT =
  "*, assignee:profiles!bd_referrals_assigned_to_fkey(id, first_name, last_name), " +
  "source_contact:client_contacts!bd_referrals_source_contact_id_fkey(id, name, company_name), " +
  "creator:profiles!bd_referrals_created_by_fkey(id, first_name, last_name)";

export interface ReferralFilters {
  assignedTo?: string | null;
}

export function useBdReferrals(filters: ReferralFilters = {}) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-referrals", profile?.company_id, filters],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      let q = supabase
        .from("bd_referrals" as any)
        .select(SELECT)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (filters.assignedTo) q = q.eq("assigned_to", filters.assignedTo);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as BdReferral[];
    },
  });
}

export type CreateBdReferralInput = {
  source_contact_id: string | null;
  source_label: string | null;
  source_type: ReferralSourceType;
  referred_name: string;
  referred_company?: string | null;
  referred_email?: string | null;
  referred_phone?: string | null;
  assigned_to: string | null;
  stage: ReferralStage;
  next_action_at?: string | null;
  notes?: string | null;
};

export function useCreateBdReferral() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBdReferralInput) => {
      if (!profile?.company_id) throw new Error("No company");
      const { data, error } = await supabase
        .from("bd_referrals" as any)
        .insert({
          company_id: profile.company_id,
          created_by: profile.id,
          ...input,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      const refId = (data as any).id as string;
      // Activity: system-style create
      await supabase.from("bd_activities").insert({
        company_id: profile.company_id,
        referral_id: refId,
        type: "SYSTEM",
        content: `Referral created at "${STAGE_META[input.stage].label}".`,
        created_by: profile.id,
      } as any);
      return refId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bd-referrals"] }),
  });
}

export type UpdateBdReferralInput = {
  id: string;
  patch: Partial<{
    stage: ReferralStage;
    assigned_to: string | null;
    next_action_at: string | null;
    next_action_note: string | null;
    notes: string | null;
    won_value: number | null;
    lost_reason: string | null;
  }>;
  activity?: {
    type: "STAGE_CHANGE" | "STATUS_CHANGE" | "NOTE" | "SYSTEM";
    content: string;
  } | null;
};

export function useUpdateBdReferral() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch, activity }: UpdateBdReferralInput) => {
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await supabase
        .from("bd_referrals" as any)
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;

      if (activity) {
        await supabase.from("bd_activities").insert({
          company_id: profile.company_id,
          referral_id: id,
          type: activity.type,
          content: activity.content,
          created_by: profile.id,
        } as any);
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["bd-referrals"] });
      qc.invalidateQueries({ queryKey: ["bd-referral-activities", v.id] });
    },
  });
}

export interface BdReferralActivity {
  id: string;
  type: string;
  content: string | null;
  created_at: string;
  created_by: string | null;
  author?: { id: string; first_name: string | null; last_name: string | null } | null;
}

export function useBdReferralActivities(referralId: string | null | undefined) {
  return useQuery({
    queryKey: ["bd-referral-activities", referralId],
    enabled: !!referralId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_activities")
        .select(
          "id, type, content, created_at, created_by, author:profiles!bd_activities_created_by_fkey(id, first_name, last_name)",
        )
        .eq("referral_id", referralId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as BdReferralActivity[];
    },
  });
}

export function useCreateBdReferralNote() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { referralId: string; content: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await supabase.from("bd_activities").insert({
        company_id: profile.company_id,
        referral_id: input.referralId,
        type: "NOTE",
        content: input.content,
        created_by: profile.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["bd-referral-activities", v.referralId] }),
  });
}
