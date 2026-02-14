import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BillingRequestService {
  name: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface BillingRequest {
  id: string;
  company_id: string;
  project_id: string | null;
  created_by: string | null;
  services: BillingRequestService[];
  total_amount: number;
  status: string;
  billed_to_contact_id: string | null;
  invoice_id: string | null;
  created_at: string;
}

export interface BillingRequestWithRelations extends BillingRequest {
  projects?: { id: string; name: string | null; project_number: string | null } | null;
  clients?: { id: string; name: string } | null;
  created_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
}

export interface BillingRequestInput {
  project_id: string;
  client_id?: string | null;
  services: BillingRequestService[];
  total_amount: number;
  billed_to_contact_id?: string | null;
  fees?: Record<string, number>;
  special_instructions?: string | null;
}

export function useBillingRequests(status?: string) {
  return useQuery({
    queryKey: ["billing-requests", status],
    queryFn: async () => {
      let query = supabase
        .from("billing_requests")
        .select(`
          *,
          projects (id, name, project_number),
          created_by_profile:profiles!billing_requests_created_by_fkey (id, first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as BillingRequestWithRelations[];
    },
  });
}

export function useCreateBillingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BillingRequestInput) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile?.company_id) throw new Error("No company found for user");

      // Create billing request
      const { data: billingReq, error: brError } = await supabase
        .from("billing_requests")
        .insert({
          company_id: profile.company_id,
          project_id: input.project_id,
          created_by: profile.id,
          services: input.services as any,
          total_amount: input.total_amount,
          status: "pending",
          billed_to_contact_id: input.billed_to_contact_id || null,
        } as any)
        .select()
        .single();

      if (brError) throw brError;

      // Auto-create invoice from billing request
      const lineItems = input.services.map((s) => ({
        description: s.description || s.name,
        quantity: s.quantity,
        rate: s.rate,
        amount: s.amount,
      }));

      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .insert({
          company_id: profile.company_id,
          invoice_number: "", // trigger generates
          project_id: input.project_id,
          client_id: input.client_id || null,
          billing_request_id: (billingReq as any).id,
          line_items: lineItems as any,
          subtotal: input.total_amount,
          retainer_applied: 0,
          fees: (input.fees || {}) as any,
          total_due: input.total_amount,
          status: "ready_to_send",
          payment_terms: "Net 30",
          billed_to_contact_id: input.billed_to_contact_id || null,
          special_instructions: input.special_instructions || null,
          created_by: profile.id,
        } as any)
        .select()
        .single();

      if (invError) throw invError;

      // Link billing request to invoice
      await supabase
        .from("billing_requests")
        .update({ status: "invoiced", invoice_id: (invoice as any).id } as any)
        .eq("id", (billingReq as any).id);

      // Log activity
      await supabase.from("invoice_activity_log").insert({
        company_id: profile.company_id,
        invoice_id: (invoice as any).id,
        action: "created",
        details: "Auto-created from billing request",
        performed_by: profile.id,
      } as any);

      return { billingRequest: billingReq, invoice };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-requests"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-counts"] });
    },
  });
}
