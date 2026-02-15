import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PartnerEmailTemplate {
  id: string;
  company_id: string;
  name: string;
  template_key: string;
  subject_template: string;
  body_template: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function usePartnerEmailTemplates() {
  return useQuery({
    queryKey: ["partner-email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_email_templates" as any)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PartnerEmailTemplate[];
    },
  });
}

export function useCreatePartnerEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: {
      company_id: string;
      name: string;
      template_key?: string;
      subject_template: string;
      body_template: string;
      is_default?: boolean;
      sort_order?: number;
    }) => {
      const { data, error } = await supabase
        .from("partner_email_templates" as any)
        .insert(template as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as PartnerEmailTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-email-templates"] }),
  });
}

export function useUpdatePartnerEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<PartnerEmailTemplate>) => {
      const { error } = await supabase
        .from("partner_email_templates" as any)
        .update(fields as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-email-templates"] }),
  });
}

export function useDeletePartnerEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("partner_email_templates" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-email-templates"] }),
  });
}
