import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SignalSubscription {
  id: string;
  property_id: string;
  company_id: string;
  status: string;
  subscribed_at: string | null;
  expires_at: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  notes: string | null;
  is_complimentary: boolean;
  enrolled_by: string | null;
  linked_project_id: string | null;
  monthly_rate: number | null;
  billing_start_date: string | null;
  comp_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  enrolled_by_name?: string | null;
  linked_project_name?: string | null;
  linked_project_phase?: string | null;
}

export interface SignalSubscriptionInput {
  property_id: string;
  status?: string;
  owner_email?: string | null;
  owner_phone?: string | null;
  notes?: string | null;
  subscribed_at?: string | null;
  expires_at?: string | null;
  is_complimentary?: boolean;
  linked_project_id?: string | null;
  monthly_rate?: number | null;
  billing_start_date?: string | null;
  comp_reason?: string | null;
}

export function useSignalSubscriptions() {
  return useQuery({
    queryKey: ["signal-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signal_subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SignalSubscription[];
    },
  });
}

export function useSignalSubscription(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["signal-subscriptions", propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      const { data, error } = await supabase
        .from("signal_subscriptions")
        .select("*")
        .eq("property_id", propertyId)
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      const sub = data as SignalSubscription;

      // Fetch enrolled-by name
      if (sub.enrolled_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", sub.enrolled_by)
          .maybeSingle();
        sub.enrolled_by_name = profile?.display_name || null;
      }

      // Fetch linked project info
      if (sub.linked_project_id) {
        const { data: project } = await supabase
          .from("projects")
          .select("name, phase")
          .eq("id", sub.linked_project_id)
          .maybeSingle();
        sub.linked_project_name = project?.name || null;
        sub.linked_project_phase = project?.phase || null;
      }

      return sub;
    },
    enabled: !!propertyId,
  });
}

export function useEnrollProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SignalSubscriptionInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.company_id) throw new Error("No company found for user");

      const { data, error } = await supabase
        .from("signal_subscriptions")
        .upsert({
          property_id: input.property_id,
          company_id: profile.company_id,
          status: input.status || "prospect",
          owner_email: input.owner_email || null,
          owner_phone: input.owner_phone || null,
          notes: input.notes || null,
          subscribed_at: input.subscribed_at || null,
          expires_at: input.expires_at || null,
          is_complimentary: input.is_complimentary || false,
          enrolled_by: profile.id,
          linked_project_id: input.linked_project_id || null,
          monthly_rate: input.monthly_rate ?? null,
          billing_start_date: input.billing_start_date || null,
          comp_reason: input.comp_reason || null,
        }, { onConflict: "property_id,company_id" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signal-subscriptions"] });
    },
  });
}

export function useDeleteSignalSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("signal_subscriptions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signal-subscriptions"] });
    },
  });
}
