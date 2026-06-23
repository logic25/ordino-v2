import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CertifiedMailing {
  id: string;
  company_id: string;
  invoice_id: string;
  demand_letter_activity_id: string | null;
  usps_tracking_number: string;
  mailed_date: string;
  delivered_date: string | null;
  return_receipt_storage_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useCertifiedMailings(invoiceId?: string) {
  return useQuery({
    queryKey: ["certified-mailings", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_certified_mailings")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("mailed_date", { ascending: false });
      if (error) throw error;
      return (data || []) as CertifiedMailing[];
    },
  });
}

export function useAddCertifiedMailing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      invoiceId: string;
      trackingNumber: string;
      mailedDate?: string;
      demandLetterActivityId?: string | null;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).single();
      if (!profile?.company_id) throw new Error("No company");

      const { error } = await supabase.from("invoice_certified_mailings").insert({
        company_id: profile.company_id,
        invoice_id: input.invoiceId,
        usps_tracking_number: input.trackingNumber.trim(),
        mailed_date: input.mailedDate || new Date().toISOString().slice(0, 10),
        demand_letter_activity_id: input.demandLetterActivityId || null,
        notes: input.notes || null,
        created_by: user?.id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["certified-mailings", vars.invoiceId] });
    },
  });
}

export function uspsTrackingUrl(num: string) {
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(num.replace(/\s+/g, ""))}`;
}
