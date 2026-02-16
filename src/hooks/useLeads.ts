import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Lead {
  id: string;
  company_id: string;
  full_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  property_address: string | null;
  subject: string | null;
  client_type: string | null;
  source: string;
  notes: string | null;
  assigned_to: string | null;
  status: string;
  proposal_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  assignee?: { id: string; first_name: string; last_name: string } | null;
  creator?: { id: string; first_name: string; last_name: string } | null;
}

export function useLeads() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["leads"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*, assignee:profiles!leads_assigned_to_fkey(id, first_name, last_name), creator:profiles!leads_created_by_fkey(id, first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Lead[];
    },
  });
}

export function useCreateLead() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      full_name: string;
      contact_phone?: string;
      contact_email?: string;
      property_address?: string;
      subject?: string;
      client_type?: string;
      source: string;
      notes?: string;
      assigned_to?: string;
    }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { data, error } = await supabase
        .from("leads")
        .insert({
          company_id: profile.company_id,
          created_by: profile.id,
          ...input,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; status?: string; assigned_to?: string; notes?: string; proposal_id?: string }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("leads").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}
