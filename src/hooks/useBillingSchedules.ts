import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BillingSchedule {
  id: string;
  company_id: string;
  project_id: string;
  service_id: string | null;
  service_name: string;
  billing_method: string;
  billing_value: number;
  billed_to_contact_id: string | null;
  frequency: string;
  next_bill_date: string;
  last_billed_at: string | null;
  is_active: boolean;
  auto_approve: boolean;
  max_occurrences: number | null;
  occurrences_completed: number;
  end_date: string | null;
  created_by: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingScheduleWithRelations extends BillingSchedule {
  projects?: { id: string; name: string | null; project_number: string | null } | null;
}

export interface BillingScheduleInput {
  project_id: string;
  service_id?: string | null;
  service_name: string;
  billing_method: string;
  billing_value: number;
  billed_to_contact_id?: string | null;
  frequency: string;
  next_bill_date: string;
  auto_approve?: boolean;
  max_occurrences?: number | null;
  end_date?: string | null;
  description?: string | null;
}

export function useBillingSchedules(projectId?: string) {
  return useQuery({
    queryKey: ["billing-schedules", projectId],
    queryFn: async () => {
      let query = supabase
        .from("billing_schedules" as any)
        .select(`*, projects (id, name, project_number)`)
        .order("next_bill_date", { ascending: true });

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as BillingScheduleWithRelations[];
    },
  });
}

export function useCreateBillingSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BillingScheduleInput) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile?.company_id) throw new Error("No company found");

      const { data, error } = await supabase
        .from("billing_schedules" as any)
        .insert({
          company_id: profile.company_id,
          project_id: input.project_id,
          service_id: input.service_id || null,
          service_name: input.service_name,
          billing_method: input.billing_method,
          billing_value: input.billing_value,
          billed_to_contact_id: input.billed_to_contact_id || null,
          frequency: input.frequency,
          next_bill_date: input.next_bill_date,
          auto_approve: input.auto_approve || false,
          max_occurrences: input.max_occurrences || null,
          end_date: input.end_date || null,
          description: input.description || null,
          created_by: profile.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-schedules"] });
    },
  });
}

export function useUpdateBillingSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BillingScheduleInput> & { id: string; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from("billing_schedules" as any)
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-schedules"] });
    },
  });
}

export function useDeleteBillingSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("billing_schedules" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-schedules"] });
    },
  });
}
