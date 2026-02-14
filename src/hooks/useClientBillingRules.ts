import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientBillingRule {
  id: string;
  company_id: string;
  client_id: string;
  vendor_id: string | null;
  property_id: string | null;
  require_waiver: boolean | null;
  require_pay_app: boolean | null;
  wire_fee: number | null;
  cc_markup: number | null;
  special_portal_required: boolean | null;
  portal_url: string | null;
  special_instructions: string | null;
  created_at: string;
  updated_at: string;
  // joined
  clients?: { id: string; name: string } | null;
}

export function useClientBillingRules() {
  return useQuery({
    queryKey: ["client-billing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_billing_rules")
        .select("*, clients(id, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ClientBillingRule[];
    },
  });
}

export function useClientBillingRulesByClient(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ["client-billing-rules", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_billing_rules")
        .select("*")
        .eq("client_id", clientId!);
      if (error) throw error;
      return data as unknown as ClientBillingRule[];
    },
  });
}

export function useCreateClientBillingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Omit<ClientBillingRule, "id" | "created_at" | "updated_at" | "clients">) => {
      const { data, error } = await supabase
        .from("client_billing_rules")
        .insert(rule as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-billing-rules"] }),
  });
}

export function useUpdateClientBillingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClientBillingRule> & { id: string }) => {
      const { error } = await supabase
        .from("client_billing_rules")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-billing-rules"] }),
  });
}

export function useDeleteClientBillingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_billing_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-billing-rules"] }),
  });
}
