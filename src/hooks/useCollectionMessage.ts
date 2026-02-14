import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CollectionMessageResult {
  subject: string;
  body: string;
  tone: string;
  urgency: string;
}

export function useGenerateCollectionMessage() {
  return useMutation({
    mutationFn: async (input: {
      invoiceId: string;
      companyId: string;
      tone?: string;
      urgency?: string;
      offerPaymentPlan?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("generate-collection-message", {
        body: {
          invoice_id: input.invoiceId,
          company_id: input.companyId,
          tone: input.tone,
          urgency: input.urgency,
          offer_payment_plan: input.offerPaymentPlan,
        },
      });
      if (error) throw error;
      return data as CollectionMessageResult;
    },
  });
}
