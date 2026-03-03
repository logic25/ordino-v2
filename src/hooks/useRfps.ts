import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type Rfp = Tables<"rfps">;

export type RfpStatus = "prospect" | "drafting" | "submitted" | "won" | "lost";

export type RfpWithProfiles = Rfp & {
  created_by_profile?: { first_name: string | null; last_name: string | null; display_name: string | null } | null;
  submitted_by_profile?: { first_name: string | null; last_name: string | null; display_name: string | null } | null;
};

export function useRfps() {
  return useQuery({
    queryKey: ["rfps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfps")
        .select(`
          *,
          created_by_profile:profiles!rfps_created_by_fkey(first_name, last_name, display_name),
          submitted_by_profile:profiles!rfps_submitted_by_fkey(first_name, last_name, display_name)
        `)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as RfpWithProfiles[];
    },
  });
}

export function useUpdateRfpStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, ...extra }: { id: string; status: RfpStatus } & Partial<TablesUpdate<"rfps">>) => {
      const updates: Record<string, any> = { status, ...extra, updated_at: new Date().toISOString() };
      
      // If marking as submitted, record who submitted and when
      if (status === "submitted") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).maybeSingle();
          if (profile) {
            updates.submitted_by = profile.id;
            updates.submitted_at = updates.submitted_at || new Date().toISOString();
          }
        }
      }
      
      const { error } = await supabase
        .from("rfps")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfps"] }),
  });
}

export function useUpdateRfpNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("rfps")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfps"] }),
  });
}

export function useCreateRfp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fields: Record<string, any>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile?.company_id) throw new Error("No company found");

      const { data, error } = await supabase
        .from("rfps")
        .insert({ ...fields, company_id: profile.company_id, created_by: profile.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfps"] }),
  });
}

export function useUpdateRfp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Record<string, any>) => {
      const { error } = await supabase
        .from("rfps")
        .update({ ...fields, updated_at: new Date().toISOString() } as TablesUpdate<"rfps">)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfps"] }),
  });
}

export function useDeleteRfp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rfps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfps"] }),
  });
}
