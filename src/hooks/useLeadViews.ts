import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// Filter DSL stored in filters_json and interpreted by the grid:
//   { stage?: string[]; source_type?: string[]; assigned_to?: string[];
//     hot_opportunity?: boolean; event_id?: string; stage_not?: string[];
//     created_after?: string; created_before?: string;
//     value_min?: number; value_max?: number; created_within_days?: number;
//     stale?: boolean }
export interface LeadViewFilters {
  stage?: string[];
  source_type?: string[];
  assigned_to?: string[];
  hot_opportunity?: boolean;
  event_id?: string | null;
  stage_not?: string[];
  created_after?: string;
  created_before?: string;
  value_min?: number;
  value_max?: number;
  stale?: boolean;
}

export interface LeadView {
  id: string;
  user_id: string;
  company_id: string;
  name: string;
  filters_json: LeadViewFilters;
  columns_json: Record<string, boolean>;
  sort_json: { id: string; desc: boolean };
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useLeadViews() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["lead-views"],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_views")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as LeadView[];
    },
  });
}

/**
 * Seed the three default views the first time a user opens /bd/leads.
 * "My open leads" matches on assigned_to = the user's PROFILE id (leads.assigned_to
 * references profiles.id, not auth.users.id).
 */
export function useSeedDefaultViews() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id || !profile?.company_id) throw new Error("Not ready");
      const base = { user_id: user.id, company_id: profile.company_id, columns_json: {} };
      const sort = { id: "created_at", desc: true };
      const rows = [
        { ...base, name: "All leads", is_default: true, filters_json: {}, sort_json: sort },
        {
          ...base,
          name: "My open leads",
          is_default: false,
          filters_json: { assigned_to: [profile.id], stage_not: ["WON", "LOST"] },
          sort_json: sort,
        },
        {
          ...base,
          name: "Hot opportunities",
          is_default: false,
          filters_json: { hot_opportunity: true },
          sort_json: sort,
        },
      ];
      // Ignore duplicates if a race seeds twice (UNIQUE(user_id, name)).
      const { error } = await supabase.from("lead_views").upsert(rows as any, {
        onConflict: "user_id,name",
        ignoreDuplicates: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-views"] }),
  });
}

export function useCreateLeadView() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      filters_json: LeadViewFilters;
      columns_json?: Record<string, boolean>;
      sort_json?: { id: string; desc: boolean };
    }) => {
      if (!user?.id || !profile?.company_id) throw new Error("Not ready");
      const { data, error } = await supabase
        .from("lead_views")
        .insert({
          user_id: user.id,
          company_id: profile.company_id,
          created_by: user.id,
          name: input.name,
          filters_json: input.filters_json,
          columns_json: input.columns_json ?? {},
          sort_json: input.sort_json ?? { id: "created_at", desc: true },
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-views"] }),
  });
}

export function useUpdateLeadView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; filters_json?: LeadViewFilters; columns_json?: Record<string, boolean>; sort_json?: { id: string; desc: boolean } }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("lead_views").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-views"] }),
  });
}

export function useDeleteLeadView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_views").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-views"] }),
  });
}
