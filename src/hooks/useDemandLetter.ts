import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DemandLetterInvoiceRow {
  invoice_number: string;
  scope_label: string;
  principal: number;
  accrued_interest: number;
  rate_apr: number;
  days_overdue: number;
  proposal_number: string | null;
  proposal_signed_at: string | null;
}

export interface DemandLetterPropertyGroup {
  property: string;
  subtotal: number;
  rows: DemandLetterInvoiceRow[];
}

export interface DemandLetterResult {
  subject: string;
  body: string;
  grand_principal: number;
  grand_interest: number;
  grand_total: number;
  invoice_ids: string[];
  property_count: number;
  invoice_count: number;
  interest_enabled: boolean;
  property_groups: DemandLetterPropertyGroup[];
  recipient: { name: string; address: string; email: string | null };
  company: { name?: string; address?: string; phone?: string; email?: string; managing_member?: string };
  letter_date: string;
  warning?: string;
}

export function useGenerateDemandLetter() {
  return useMutation({
    mutationFn: async (input: { invoiceId: string; scope?: "client" | "property" }) => {
      const { data, error } = await supabase.functions.invoke("generate-demand-letter", {
        body: { invoice_id: input.invoiceId, scope: input.scope || "client" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as DemandLetterResult;
    },
  });
}
