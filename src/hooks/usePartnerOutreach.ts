import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PartnerOutreach {
  id: string;
  company_id: string;
  discovered_rfp_id: string;
  partner_client_id: string;
  contact_name: string | null;
  contact_email: string | null;
  notified_at: string;
  response_status: string; // pending, interested, passed
  responded_at: string | null;
  response_token: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function usePartnerOutreach(discoveredRfpId: string | undefined) {
  return useQuery({
    queryKey: ["partner-outreach", discoveredRfpId],
    enabled: !!discoveredRfpId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfp_partner_outreach")
        .select("*")
        .eq("discovered_rfp_id", discoveredRfpId!)
        .order("notified_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PartnerOutreach[];
    },
  });
}

export function useCreatePartnerOutreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (records: Array<{
      company_id: string;
      discovered_rfp_id: string;
      partner_client_id: string;
      contact_name?: string;
      contact_email?: string;
    }>) => {
      const { data, error } = await supabase
        .from("rfp_partner_outreach")
        .upsert(records as any[], { onConflict: "discovered_rfp_id,partner_client_id" })
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      if (vars.length > 0) {
        qc.invalidateQueries({ queryKey: ["partner-outreach", vars[0].discovered_rfp_id] });
      }
    },
  });
}

export function useUpdatePartnerOutreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<PartnerOutreach>) => {
      const { error } = await supabase
        .from("rfp_partner_outreach")
        .update(fields as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner-outreach"] });
    },
  });
}
