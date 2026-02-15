import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface RfpDraft {
  id: string;
  rfp_id: string;
  company_id: string;
  created_by: string | null;
  selected_sections: string[];
  section_order: string[];
  cover_letter: string | null;
  submit_email: string | null;
  wizard_step: number;
  created_at: string;
  updated_at: string;
}

export function useRfpDraft(rfpId: string | undefined) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["rfp-draft", rfpId],
    enabled: !!rfpId && !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfp_response_drafts" as any)
        .select("*")
        .eq("rfp_id", rfpId!)
        .eq("company_id", profile!.company_id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown) as RfpDraft | null;
    },
  });
}

export function useUpsertRfpDraft() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (draft: {
      rfp_id: string;
      selected_sections: string[];
      section_order: string[];
      cover_letter?: string | null;
      submit_email?: string | null;
      wizard_step?: number;
    }) => {
      if (!profile?.company_id) throw new Error("No company");
      const payload = {
        ...draft,
        company_id: profile.company_id,
        created_by: profile.id,
      };
      const { data, error } = await supabase
        .from("rfp_response_drafts" as any)
        .upsert(payload as any, { onConflict: "rfp_id,company_id" })
        .select()
        .single();
      if (error) throw error;
      return (data as unknown) as RfpDraft;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["rfp-draft", vars.rfp_id] });
    },
  });
}

export function useDeleteRfpDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rfpId: string) => {
      const { error } = await supabase
        .from("rfp_response_drafts" as any)
        .delete()
        .eq("rfp_id", rfpId);
      if (error) throw error;
    },
    onSuccess: (_, rfpId) => {
      qc.invalidateQueries({ queryKey: ["rfp-draft", rfpId] });
    },
  });
}
