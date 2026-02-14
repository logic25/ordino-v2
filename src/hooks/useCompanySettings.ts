import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface ServiceCatalogItem {
  id: string;
  name: string;
  description?: string;
  default_price?: number;
  default_hours?: number;
}

export interface CompanySettings {
  service_catalog?: ServiceCatalogItem[];
  default_terms?: string;
  company_types?: string[];
  review_categories?: string[];
  demand_letter_template?: string;
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .single();

      if (!profile?.company_id) return null;

      const { data, error } = await supabase
        .from("companies")
        .select("id, settings")
        .eq("id", profile.company_id)
        .single();

      if (error) throw error;
      return {
        companyId: data.id,
        settings: (data.settings || {}) as CompanySettings,
      };
    },
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, settings }: { companyId: string; settings: CompanySettings }) => {
      // Get current settings first
      const { data: current } = await supabase
        .from("companies")
        .select("settings")
        .eq("id", companyId)
        .single();

      const currentSettings = (current?.settings && typeof current.settings === 'object' && !Array.isArray(current.settings)) 
        ? current.settings as Record<string, Json>
        : {};

      const mergedSettings: Json = {
        ...currentSettings,
        service_catalog: settings.service_catalog as unknown as Json,
        default_terms: settings.default_terms,
        company_types: settings.company_types as unknown as Json,
        review_categories: settings.review_categories as unknown as Json,
        demand_letter_template: settings.demand_letter_template,
      };

      const { error } = await supabase
        .from("companies")
        .update({ settings: mergedSettings })
        .eq("id", companyId);

      if (error) throw error;
      return mergedSettings as unknown as CompanySettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    },
  });
}
