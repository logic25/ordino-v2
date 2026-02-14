import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface LeadSource {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export function useLeadSources() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["lead-sources"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_sources")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as LeadSource[];
    },
  });
}

export function useCreateLeadSource() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await supabase.from("lead_sources").insert({
        company_id: profile.company_id,
        name: input.name,
        description: input.description || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-sources"] }),
  });
}

export function useUpdateLeadSource() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; name?: string; description?: string; is_active?: boolean; sort_order?: number }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("lead_sources").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-sources"] }),
  });
}

export function useDeleteLeadSource() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-sources"] }),
  });
}
