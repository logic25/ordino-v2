import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type Rfp = Tables<"rfps">;

export type RfpStatus = "prospect" | "drafting" | "submitted" | "won" | "lost";

export function useRfps() {
  return useQuery({
    queryKey: ["rfps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfps")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as Rfp[];
    },
  });
}

export function useUpdateRfpStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, ...extra }: { id: string; status: RfpStatus } & Partial<TablesUpdate<"rfps">>) => {
      const { error } = await supabase
        .from("rfps")
        .update({ status, ...extra, updated_at: new Date().toISOString() })
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
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile?.company_id) throw new Error("No company found");

      const { data, error } = await supabase
        .from("rfps")
        .insert({ ...fields, company_id: profile.company_id } as any)
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
