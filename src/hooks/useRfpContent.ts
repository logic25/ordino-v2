import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type RfpContent = Tables<"rfp_content">;
export type RfpContentInsert = TablesInsert<"rfp_content">;
export type RfpContentUpdate = TablesUpdate<"rfp_content">;

export type ContentType = "company_info" | "staff_bio" | "pricing" | "narrative_template" | "certification" | "firm_history";

export function useRfpContent(contentType?: ContentType) {
  return useQuery({
    queryKey: ["rfp-content", contentType],
    queryFn: async () => {
      let query = supabase
        .from("rfp_content")
        .select("*")
        .order("created_at", { ascending: false });

      if (contentType) {
        query = query.eq("content_type", contentType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RfpContent[];
    },
  });
}

export function useCreateRfpContent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<RfpContentInsert, "company_id">) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      const { data, error } = await supabase
        .from("rfp_content")
        .insert({ ...input, company_id: profile.company_id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rfp-content"] });
    },
  });
}

export function useUpdateRfpContent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: RfpContentUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("rfp_content")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rfp-content"] });
    },
  });
}

export function useDeleteRfpContent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rfp_content")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rfp-content"] });
    },
  });
}

// Hook for notable applications (used in Notable Projects tab)
export function useNotableApplications() {
  return useQuery({
    queryKey: ["notable-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dob_applications")
        .select(`
          *,
          properties!inner(address, borough),
          profiles(first_name, last_name)
        `)
        .eq("notable", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useToggleNotable() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notable }: { id: string; notable: boolean }) => {
      const { error } = await supabase
        .from("dob_applications")
        .update({ notable })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notable-applications"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

export function useUpdateApplicationRfpInfo() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      rfp_tags?: string[];
      reference_contact_name?: string | null;
      reference_contact_title?: string | null;
      reference_contact_email?: string | null;
      reference_contact_phone?: string | null;
      reference_notes?: string | null;
      reference_last_verified?: string | null;
      notable?: boolean;
    }) => {
      const { error } = await supabase
        .from("dob_applications")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notable-applications"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}
