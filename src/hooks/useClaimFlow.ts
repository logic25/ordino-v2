import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClaimFlowReferral {
  id: string;
  company_id: string;
  invoice_id: string;
  client_id: string | null;
  case_notes: string | null;
  status: "pending" | "filed" | "resolved" | "dismissed";
  package_storage_path: string | null;
  package_generated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useClaimFlowReferral(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["claimflow-referral", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claimflow_referrals")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ClaimFlowReferral | null;
    },
  });
}

export function useCreateClaimFlowReferral() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      invoice_id: string;
      client_id?: string | null;
      case_notes?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();
      if (!profile?.company_id) throw new Error("No company found");

      const { data, error } = await supabase
        .from("claimflow_referrals")
        .insert({
          company_id: profile.company_id,
          invoice_id: input.invoice_id,
          client_id: input.client_id || null,
          case_notes: input.case_notes || null,
          status: "pending",
          created_by: profile.id,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Update invoice status to legal_hold
      await supabase
        .from("invoices")
        .update({ status: "legal_hold" } as any)
        .eq("id", input.invoice_id);

      // Log activity
      await supabase.from("invoice_activity_log").insert({
        company_id: profile.company_id,
        invoice_id: input.invoice_id,
        action: "claimflow_referral",
        details: `Sent to ClaimCurrent for small claims referral${input.case_notes ? `. Notes: ${input.case_notes}` : ""}`,
        performed_by: profile.id,
      } as any);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["claimflow-referral", variables.invoice_id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-counts"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-activity-log"] });
    },
  });
}

export function useGenerateClaimFlowPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (referralId: string) => {
      const { data, error } = await supabase.functions.invoke("generate-claimflow-package", {
        body: { referral_id: referralId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as { success: boolean; package_path: string; download_url: string | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claimflow-referral"] });
    },
  });
}
