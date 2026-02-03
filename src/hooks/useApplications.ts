import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Application = Tables<"dob_applications">;
export type ApplicationInsert = TablesInsert<"dob_applications">;

export type ApplicationStatus = 
  | "draft"
  | "filed"
  | "under_review"
  | "objection"
  | "approved"
  | "permit_issued"
  | "inspection"
  | "complete"
  | "closed";

export const APPLICATION_STATUSES: { value: ApplicationStatus; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "bg-muted text-muted-foreground" },
  { value: "filed", label: "Filed", color: "bg-blue-500/10 text-blue-600" },
  { value: "under_review", label: "Under Review", color: "bg-yellow-500/10 text-yellow-600" },
  { value: "objection", label: "Objection", color: "bg-red-500/10 text-red-600" },
  { value: "approved", label: "Approved", color: "bg-green-500/10 text-green-600" },
  { value: "permit_issued", label: "Permit Issued", color: "bg-emerald-500/10 text-emerald-600" },
  { value: "inspection", label: "Inspection", color: "bg-purple-500/10 text-purple-600" },
  { value: "complete", label: "Complete", color: "bg-green-600/10 text-green-700" },
  { value: "closed", label: "Closed", color: "bg-gray-500/10 text-gray-600" },
];

// Type for application with joined property data
export type ApplicationWithProperty = Application & {
  properties: { address: string; borough: string | null } | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
};

export interface ApplicationFormInput {
  property_id: string;
  job_number?: string | null;
  application_type?: string | null;
  description?: string | null;
  status?: ApplicationStatus | null;
  assigned_pm_id?: string | null;
  filed_date?: string | null;
  approved_date?: string | null;
  permit_issued_date?: string | null;
  estimated_value?: number | null;
  notes?: string | null;
}

export function useApplications() {
  return useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dob_applications")
        .select(`
          *,
          properties!inner(address, borough),
          profiles(first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ApplicationWithProperty[];
    },
  });
}

export function useApplicationsByProperty(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["applications", "property", propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from("dob_applications")
        .select(`
          *,
          properties(address, borough),
          profiles(first_name, last_name)
        `)
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ApplicationWithProperty[];
    },
    enabled: !!propertyId,
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (application: ApplicationFormInput) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) {
        throw new Error("No company found for user");
      }

      const { data, error } = await supabase
        .from("dob_applications")
        .insert({
          property_id: application.property_id,
          company_id: profile.company_id,
          job_number: application.job_number || null,
          application_type: application.application_type || null,
          description: application.description || null,
          status: application.status || "draft",
          assigned_pm_id: application.assigned_pm_id || null,
          filed_date: application.filed_date || null,
          approved_date: application.approved_date || null,
          permit_issued_date: application.permit_issued_date || null,
          estimated_value: application.estimated_value || null,
          notes: application.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

export function useUpdateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ApplicationFormInput & { id: string }) => {
      const { data, error } = await supabase
        .from("dob_applications")
        .update({
          property_id: updates.property_id,
          job_number: updates.job_number || null,
          application_type: updates.application_type || null,
          description: updates.description || null,
          status: updates.status || "draft",
          assigned_pm_id: updates.assigned_pm_id || null,
          filed_date: updates.filed_date || null,
          approved_date: updates.approved_date || null,
          permit_issued_date: updates.permit_issued_date || null,
          estimated_value: updates.estimated_value || null,
          notes: updates.notes || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["applications", data.id] });
    },
  });
}

export function useDeleteApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dob_applications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}
