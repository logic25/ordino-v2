import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { ReferralStage, ReferralSourceType } from "@/components/bd/referralConstants";

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
  assignedTo?: string | null; // profile id, or null for "all"
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
