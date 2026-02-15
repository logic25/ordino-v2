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
  ach_authorization_template?: string;
  // Company info for PDF header
  company_address?: string;
  company_phone?: string;
  company_fax?: string;
  company_email?: string;
  company_website?: string;
  // Payment methods
  payment_check_address?: string;
  payment_wire_bank_name?: string;
  payment_wire_routing?: string;
  payment_wire_account?: string;
  payment_zelle_id?: string;
  payment_cc_enabled?: boolean;
  payment_cc_url?: string;
  // Collections settings
  collections_first_reminder_days?: number;
  collections_second_reminder_days?: number;
  collections_demand_letter_days?: number;
  collections_auto_reminders?: boolean;
  collections_early_payment_discount?: boolean;
  collections_early_payment_discount_percent?: number;
  // Email templates
  invoice_email_subject_template?: string;
  invoice_email_body_template?: string;
  // QBO sync
  qbo_sync_frequency?: string;
  // Logo & PDF branding
  company_logo_url?: string;
  invoice_header_text?: string;
  invoice_footer_text?: string;
  // Bonus tiers
  bonus_tiers?: { min_pct: number; max_pct: number; amount: number }[];
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
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
        ...Object.fromEntries(
          Object.entries(settings).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v as unknown as Json])
        ),
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
