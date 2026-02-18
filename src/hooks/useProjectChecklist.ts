import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings } from "@/hooks/useCompanySettings";

export interface ChecklistItem {
  id: string;
  company_id: string;
  project_id: string;
  label: string;
  category: string;
  from_whom: string | null;
  source_service_id: string | null;
  source_catalog_name: string | null;
  status: string;
  requested_date: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useProjectChecklist(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-checklist", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_checklist_items" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as ChecklistItem[];
    },
    enabled: !!projectId,
  });
}

export function useAddChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      label: string;
      category: string;
      from_whom?: string;
      source_service_id?: string;
      source_catalog_name?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .limit(1)
        .maybeSingle();

      if (!profile?.company_id) throw new Error("No company");

      const { data, error } = await supabase
        .from("project_checklist_items" as any)
        .insert({
          company_id: profile.company_id,
          project_id: input.project_id,
          label: input.label,
          category: input.category,
          from_whom: input.from_whom || null,
          source_service_id: input.source_service_id || null,
          source_catalog_name: input.source_catalog_name || null,
          status: "open",
          requested_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-checklist", variables.project_id] });
    },
  });
}

export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projectId, ...updates }: {
      id: string;
      projectId: string;
      status?: string;
      label?: string;
      from_whom?: string;
      category?: string;
      completed_at?: string | null;
    }) => {
      const payload: Record<string, any> = { ...updates };
      if (updates.status === "done" && !updates.completed_at) {
        payload.completed_at = new Date().toISOString();
      }
      if (updates.status === "open") {
        payload.completed_at = null;
      }
      delete payload.projectId;

      const { error } = await supabase
        .from("project_checklist_items" as any)
        .update(payload)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-checklist", variables.projectId] });
    },
  });
}

export function useDeleteChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from("project_checklist_items" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-checklist", variables.projectId] });
    },
  });
}

/**
 * Auto-populate checklist items from service catalog templates.
 * Deduplicates by source_catalog_name — if multiple services share the same
 * catalog entry, only one set of template requirements is created.
 */
export function useAutoPopulateChecklist() {
  const queryClient = useQueryClient();
  const { data: companyData } = useCompanySettings();

  return useMutation({
    mutationFn: async ({ projectId, services }: {
      projectId: string;
      services: Array<{ id: string; name: string }>;
    }) => {
      if (!companyData?.settings?.service_catalog) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .limit(1)
        .maybeSingle();

      if (!profile?.company_id) throw new Error("No company");

      // Get existing checklist items for dedup
      const { data: existing } = await supabase
        .from("project_checklist_items" as any)
        .select("source_catalog_name")
        .eq("project_id", projectId);

      const existingCatalogNames = new Set(
        (existing || []).map((e: any) => e.source_catalog_name).filter(Boolean)
      );

      const catalog = companyData.settings.service_catalog || [];
      const seenCatalogNames = new Set<string>();
      const itemsToInsert: any[] = [];

      for (const svc of services) {
        // Find matching catalog entry
        const catalogEntry = catalog.find(c => c.name === svc.name);
        if (!catalogEntry?.default_requirements?.length) continue;

        const catalogName = catalogEntry.name;

        // Dedup: skip if already populated or already seen in this batch
        if (existingCatalogNames.has(catalogName) || seenCatalogNames.has(catalogName)) continue;
        seenCatalogNames.add(catalogName);

        for (const req of catalogEntry.default_requirements) {
          itemsToInsert.push({
            company_id: profile.company_id,
            project_id: projectId,
            label: req.label,
            category: req.category || "missing_document",
            from_whom: req.from_whom_role || null,
            source_service_id: svc.id,
            source_catalog_name: catalogName,
            status: "open",
            requested_date: new Date().toISOString(),
          });
        }
      }

      if (itemsToInsert.length > 0) {
        const { error } = await supabase
          .from("project_checklist_items" as any)
          .insert(itemsToInsert);

        if (error) throw error;
      }

      return itemsToInsert.length;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-checklist", variables.projectId] });
    },
  });
}
