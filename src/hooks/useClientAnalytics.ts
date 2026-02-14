import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientPaymentAnalytics {
  id: string;
  client_id: string;
  company_id: string;
  avg_days_to_payment: number | null;
  payment_reliability_score: number | null;
  last_12mo_invoices: number;
  last_12mo_paid_on_time: number;
  last_12mo_late: number;
  longest_days_late: number;
  preferred_contact_method: string | null;
  best_contact_time: string | null;
  responds_to_reminders: boolean | null;
  total_lifetime_value: number;
  last_payment_date: string | null;
  updated_at: string;
}

export function useClientPaymentAnalytics(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-payment-analytics", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_payment_analytics")
        .select("*")
        .eq("client_id", clientId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ClientPaymentAnalytics | null;
    },
  });
}

export function useRefreshClientAnalytics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, companyId }: { clientId: string; companyId: string }) => {
      const { data, error } = await supabase.functions.invoke("analyze-client-payments", {
        body: { client_id: clientId, company_id: companyId },
      });
      if (error) throw error;
      return data as ClientPaymentAnalytics;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-payment-analytics", data.client_id] });
    },
  });
}
