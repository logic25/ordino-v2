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

      // Safety net: if BBL is missing after save, try NYC lookup
      if (!data.borough || !data.block || !data.lot) {
        try {
          const { lookupByAddress } = await import("@/hooks/useNYCPropertyLookup").then(m => {
            // We can't use the hook here, so call the API directly
            return { lookupByAddress: null };
          });
          // Use fetch directly to NYC Open Data API
          const address = data.address.trim().toUpperCase();
          const plutoUrl = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$where=upper(address) like '%25${encodeURIComponent(address)}%25'&$limit=5`;
          const response = await fetch(plutoUrl);
          if (response.ok) {
            const results = await response.json();
            if (results?.length > 0) {
              const p = results[0];
              const BORO: Record<string, string> = { "1": "Manhattan", "2": "Bronx", "3": "Brooklyn", "4": "Queens", "5": "Staten Island" };
              const updates: Record<string, string> = {};
              if (!data.borough && p.borocode) updates.borough = BORO[p.borocode] || p.borough;
              if (!data.block && p.block) updates.block = p.block;
              if (!data.lot && p.lot) updates.lot = p.lot;
              if (!data.bin && p.bin) updates.bin = p.bin;
              if (!data.zip_code && p.zipcode) updates.zip_code = p.zipcode;
              if (!data.owner_name && p.ownername) updates.owner_name = p.ownername;
              if (Object.keys(updates).length > 0) {
                await supabase.from("properties").update(updates).eq("id", data.id);
              }
            }
          }
        } catch (e) {
          console.warn("Post-save BBL lookup failed:", e);
        }
      }

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
