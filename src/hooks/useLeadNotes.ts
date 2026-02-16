import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface LeadNote {
  id: string;
  lead_id: string;
  company_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  author?: { id: string; first_name: string; last_name: string } | null;
}

export function useLeadNotes(leadId: string | null) {
  return useQuery({
    queryKey: ["lead_notes", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_notes")
        .select("*, author:profiles!lead_notes_created_by_fkey(id, first_name, last_name)")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LeadNote[];
    },
  });
}

export function useCreateLeadNote() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { lead_id: string; content: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await supabase.from("lead_notes").insert({
        lead_id: input.lead_id,
        company_id: profile.company_id,
        content: input.content,
        created_by: profile.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["lead_notes", variables.lead_id] });
    },
  });
}
