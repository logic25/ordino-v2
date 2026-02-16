import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Property = Tables<"properties">;
export type PropertyInsert = TablesInsert<"properties">;
export type PropertyUpdate = TablesUpdate<"properties">;

export function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Property[];
    },
  });
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ["properties", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

// Type for property form input (what the UI sends)
export interface PropertyFormInput {
  address: string;
  borough?: string | null;
  block?: string | null;
  lot?: string | null;
  bin?: string | null;
  zip_code?: string | null;
  owner_name?: string | null;
  owner_contact?: string | null;
  notes?: string | null;
}

export function useCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (property: PropertyFormInput) => {
      // Get user's company_id from their profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) {
        throw new Error("No company found for user");
      }

      const { data, error } = await supabase
        .from("properties")
        .insert({ 
          address: property.address,
          borough: property.borough || null,
          block: property.block || null,
          lot: property.lot || null,
          bin: property.bin || null,
          zip_code: property.zip_code || null,
          owner_name: property.owner_name || null,
          owner_contact: property.owner_contact || null,
          notes: property.notes || null,
          company_id: profile.company_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: PropertyFormInput & { id: string }) => {
      const { data, error } = await supabase
        .from("properties")
        .update({
          address: updates.address,
          borough: updates.borough || null,
          block: updates.block || null,
          lot: updates.lot || null,
          bin: updates.bin || null,
          zip_code: updates.zip_code || null,
          owner_name: updates.owner_name || null,
          owner_contact: updates.owner_contact || null,
          notes: updates.notes || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["properties", data.id] });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("properties")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}
