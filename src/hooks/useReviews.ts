import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Review {
  id: string;
  company_id: string;
  client_id: string;
  contact_id: string | null;
  project_id: string | null;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
  updated_at: string | null;
  reviewer?: { id: string; first_name: string | null; last_name: string | null; display_name: string | null } | null;
  contact?: { id: string; first_name: string | null; last_name: string | null } | null;
  project?: { id: string; name: string | null; project_number: string | null } | null;
}

export function useClientReviews(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-reviews", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("company_reviews")
        .select(`
          *,
          reviewer:profiles!company_reviews_reviewer_id_fkey (id, first_name, last_name, display_name),
          contact:client_contacts!company_reviews_contact_id_fkey (id, first_name, last_name),
          project:projects!company_reviews_project_id_fkey (id, name, project_number)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as Review[];
    },
    enabled: !!clientId,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      contact_id?: string | null;
      project_id?: string | null;
      rating: number;
      comment?: string | null;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      const { data, error } = await supabase
        .from("company_reviews")
        .insert({
          company_id: profile.company_id,
          client_id: input.client_id,
          contact_id: input.contact_id || null,
          project_id: input.project_id || null,
          reviewer_id: profile.id,
          rating: input.rating,
          comment: input.comment || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-reviews", variables.client_id] });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from("company_reviews")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ["client-reviews", clientId] });
    },
  });
}
