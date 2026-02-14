import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InvoiceFollowUp {
  id: string;
  invoice_id: string;
  follow_up_date: string;
  contact_method: string | null;
  notes: string | null;
  contacted_by: string | null;
  created_at: string;
}

export interface InvoiceActivity {
  id: string;
  invoice_id: string;
  action: string;
  details: string | null;
  performed_by: string | null;
  created_at: string;
}

export function useInvoiceFollowUps(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice-follow-ups", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_follow_ups")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as InvoiceFollowUp[];
    },
  });
}

export function useInvoiceActivityLog(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice-activity-log", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_activity_log")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as InvoiceActivity[];
    },
  });
}
