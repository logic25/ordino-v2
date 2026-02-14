import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentPromise {
  id: string;
  invoice_id: string;
  client_id: string | null;
  company_id: string;
  follow_up_id: string | null;
  promised_amount: number;
  promised_date: string;
  payment_method: string | null;
  source: string;
  captured_by: string | null;
  notes: string | null;
  status: "pending" | "kept" | "broken" | "rescheduled";
  actual_payment_date: string | null;
  actual_amount: number | null;
  reminder_sent_at: string | null;
  created_at: string;
}

export function usePaymentPromises(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["payment-promises", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_promises")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PaymentPromise[];
    },
  });
}

export function useAllPaymentPromises(status?: string) {
  return useQuery({
    queryKey: ["all-payment-promises", status],
    queryFn: async () => {
      let query = supabase
        .from("payment_promises")
        .select("*, invoices(id, invoice_number, total_due, clients(id, name))")
        .order("promised_date", { ascending: true });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as (PaymentPromise & {
        invoices: { id: string; invoice_number: string; total_due: number; clients: { id: string; name: string } | null } | null;
      })[];
    },
  });
}

export function useCreatePaymentPromise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      invoice_id: string;
      client_id?: string | null;
      promised_amount: number;
      promised_date: string;
      payment_method?: string;
      source: string;
      notes?: string;
      follow_up_id?: string | null;
    }) => {
      const { data: profile } = await supabase.from("profiles").select("id, company_id").single();
      if (!profile) throw new Error("No profile found");

      const { data, error } = await supabase
        .from("payment_promises")
        .insert({
          ...input,
          company_id: profile.company_id,
          captured_by: profile.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payment-promises", variables.invoice_id] });
      queryClient.invalidateQueries({ queryKey: ["all-payment-promises"] });
    },
  });
}

export function useUpdatePaymentPromise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; actual_payment_date?: string; actual_amount?: number }) => {
      const { data, error } = await supabase
        .from("payment_promises")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-promises"] });
      queryClient.invalidateQueries({ queryKey: ["all-payment-promises"] });
    },
  });
}
