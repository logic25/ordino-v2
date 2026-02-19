import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Type definitions matching the new projects table
export interface Project {
  id: string;
  company_id: string;
  property_id: string;
  proposal_id: string | null;
  name: string | null;
  project_number: string | null;
  project_type: string | null;
  floor_number: string | null;
  status: "open" | "on_hold" | "closed" | "paid";
  phase: string;
  assigned_pm_id: string | null;
  senior_pm_id: string | null;
  client_id: string | null;
  building_owner_id: string | null;
  building_owner_name: string | null;
  is_external: boolean;
  notable: boolean;
  unit_number: string | null;
  tenant_name: string | null;
  completion_date: string | null;
  created_by: string | null;
  last_editor_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
  // Timeline & performance fields
  expected_construction_start: string | null;
  estimated_construction_completion: string | null;
  actual_construction_start: string | null;
  actual_construction_completion: string | null;
  project_complexity_tier: string | null;
  // GC fields
  gc_company_name: string | null;
  gc_contact_name: string | null;
  gc_phone: string | null;
  gc_email: string | null;
  // Architect fields
  architect_company_name: string | null;
  architect_contact_name: string | null;
  architect_phone: string | null;
  architect_email: string | null;
}

export interface ProjectWithRelations extends Project {
  properties?: { id: string; address: string; borough: string | null; block?: string | null; lot?: string | null; bin?: string | null; zip_code?: string | null; owner_name?: string | null } | null;
  proposals?: { id: string; proposal_number: string | null; title: string; total_amount: number | null; status?: string; internal_signed_at?: string | null; client_signed_at?: string | null } | null;
  assigned_pm?: { id: string; first_name: string | null; last_name: string | null } | null;
  senior_pm?: { id: string; first_name: string | null; last_name: string | null } | null;
  clients?: { id: string; name: string } | null;
  building_owner?: { id: string; name: string } | null;
}

export interface ProjectFormInput {
  property_id: string;
  name?: string | null;
  project_type?: string | null;
  floor_number?: string | null;
  status?: "open" | "on_hold" | "closed" | "paid";
  phase?: string;
  assigned_pm_id?: string | null;
  senior_pm_id?: string | null;
  client_id?: string | null;
  building_owner_id?: string | null;
  building_owner_name?: string | null;
  is_external?: boolean;
  notable?: boolean;
  unit_number?: string | null;
  tenant_name?: string | null;
  completion_date?: string | null;
  notes?: string | null;
  // Timeline & performance
  expected_construction_start?: string | null;
  estimated_construction_completion?: string | null;
  actual_construction_start?: string | null;
  actual_construction_completion?: string | null;
  project_complexity_tier?: string | null;
  // GC
  gc_company_name?: string | null;
  gc_contact_name?: string | null;
  gc_phone?: string | null;
  gc_email?: string | null;
  // Architect
  architect_company_name?: string | null;
  architect_contact_name?: string | null;
  architect_phone?: string | null;
  architect_email?: string | null;
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          properties (id, address, borough, block, lot, bin),
          proposals!projects_proposal_id_fkey (id, proposal_number, title, total_amount, status, internal_signed_at, client_signed_at),
          assigned_pm:profiles!projects_assigned_pm_id_fkey (id, first_name, last_name),
          senior_pm:profiles!projects_senior_pm_id_fkey (id, first_name, last_name),
          clients!projects_client_id_fkey (id, name),
          building_owner:clients!projects_building_owner_id_fkey (id, name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as ProjectWithRelations[];
    },
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          properties (id, address, borough, block, lot, bin, zip_code, owner_name),
          proposals!projects_proposal_id_fkey (id, proposal_number, title, total_amount, status, internal_signed_at, client_signed_at),
          assigned_pm:profiles!projects_assigned_pm_id_fkey (id, first_name, last_name),
          senior_pm:profiles!projects_senior_pm_id_fkey (id, first_name, last_name),
          clients!projects_client_id_fkey (id, name, email, phone),
          building_owner:clients!projects_building_owner_id_fkey (id, name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as ProjectWithRelations;
    },
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProjectFormInput) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile?.company_id) {
        throw new Error("No company found for user");
      }

      const { data, error } = await supabase
        .from("projects")
        .insert({
          company_id: profile.company_id,
          property_id: input.property_id,
          name: input.name || null,
          project_type: input.project_type || null,
          floor_number: input.floor_number || null,
          status: input.status || "open",
          assigned_pm_id: input.assigned_pm_id || null,
          senior_pm_id: input.senior_pm_id || null,
          client_id: input.client_id || null,
          building_owner_id: input.building_owner_id || null,
          building_owner_name: input.building_owner_name || null,
          is_external: input.is_external || false,
          notable: input.notable || false,
          unit_number: input.unit_number || null,
          tenant_name: input.tenant_name || null,
          completion_date: input.completion_date || null,
          notes: input.notes || null,
          created_by: profile.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: ProjectFormInput & { id: string }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .single();

      const { data, error } = await supabase
        .from("projects")
        .update({
          property_id: input.property_id,
          name: input.name || null,
          project_type: input.project_type || null,
          floor_number: input.floor_number || null,
          status: input.status || "open",
          assigned_pm_id: input.assigned_pm_id || null,
          senior_pm_id: input.senior_pm_id || null,
          client_id: input.client_id || null,
          building_owner_id: input.building_owner_id || null,
          building_owner_name: input.building_owner_name || null,
          is_external: input.is_external ?? false,
          notable: input.notable ?? false,
          unit_number: input.unit_number || null,
          tenant_name: input.tenant_name || null,
          completion_date: input.completion_date || null,
          notes: input.notes || null,
          last_editor_id: profile?.id || null,
        } as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", data.id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
