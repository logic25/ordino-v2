import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentPrediction {
  id: string;
  invoice_id: string;
  client_id: string | null;
  company_id: string;
  risk_score: number;
  predicted_days_late: number | null;
  predicted_payment_date: string | null;
  confidence_level: string | null;
  factors: Record<string, string>;
  model_version: string;
  created_at: string;
}

export function usePaymentPrediction(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["payment-prediction", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_predictions")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PaymentPrediction | null;
    },
  });
}

export function useRequestRiskScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, companyId }: { invoiceId: string; companyId: string }) => {
      const { data, error } = await supabase.functions.invoke("predict-payment-risk", {
        body: { invoice_id: invoiceId, company_id: companyId },
      });
      if (error) throw error;
      return data as PaymentPrediction;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["payment-prediction", data.invoice_id] });
    },
  });
}
