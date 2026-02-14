import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InvoiceStatus = "draft" | "ready_to_send" | "needs_review" | "sent" | "overdue" | "paid";

export interface Invoice {
  id: string;
  company_id: string;
  invoice_number: string;
  project_id: string | null;
  client_id: string | null;
  billing_request_id: string | null;
  line_items: LineItem[];
  subtotal: number;
  retainer_applied: number;
  fees: Record<string, number>;
  total_due: number;
  status: InvoiceStatus;
  review_reason: string | null;
  payment_terms: string | null;
  due_date: string | null;
  billed_to_contact_id: string | null;
  created_by: string | null;
  sent_at: string | null;
  paid_at: string | null;
  payment_amount: number | null;
  payment_method: string | null;
  qbo_invoice_id: string | null;
  qbo_synced_at: string | null;
  qbo_payment_status: string | null;
  gmail_message_id: string | null;
  special_instructions: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithRelations extends Invoice {
  projects?: { id: string; name: string | null; project_number: string | null } | null;
  clients?: { id: string; name: string; phone: string | null; email: string | null; address: string | null } | null;
  billed_to_contact?: { id: string; name: string; email: string | null; phone: string | null; mobile: string | null } | null;
  created_by_profile?: { id: string; first_name: string | null; last_name: string | null } | null;
}

export interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceFormInput {
  project_id?: string | null;
  client_id?: string | null;
  line_items: LineItem[];
  subtotal: number;
  retainer_applied?: number;
  fees?: Record<string, number>;
  total_due: number;
  status?: InvoiceStatus;
  review_reason?: string | null;
  payment_terms?: string;
  due_date?: string | null;
  billed_to_contact_id?: string | null;
  special_instructions?: string | null;
}

export interface InvoiceCounts {
  draft: number;
  ready_to_send: number;
  needs_review: number;
  sent: number;
  overdue: number;
  paid: number;
  total: number;
}

export function useInvoices(statusFilter?: InvoiceStatus | "all") {
  return useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select(`
          *,
          projects (id, name, project_number),
          clients (id, name, phone, email, address),
          billed_to_contact:client_contacts!invoices_billed_to_contact_id_fkey (id, name, email, phone, mobile),
          created_by_profile:profiles!invoices_created_by_fkey (id, first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as InvoiceWithRelations[];
    },
  });
}

export function useInvoiceCounts() {
  return useQuery({
    queryKey: ["invoice-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("status");

      if (error) throw error;

      const counts: InvoiceCounts = {
        draft: 0,
        ready_to_send: 0,
        needs_review: 0,
        sent: 0,
        overdue: 0,
        paid: 0,
        total: 0,
      };

      (data || []).forEach((inv: any) => {
        const s = inv.status as InvoiceStatus;
        if (s in counts) {
          counts[s]++;
        }
        counts.total++;
      });

      return counts;
    },
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InvoiceFormInput) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile?.company_id) {
        throw new Error("No company found for user");
      }

      const { data, error } = await supabase
        .from("invoices")
        .insert({
          company_id: profile.company_id,
          invoice_number: "", // trigger will auto-generate
          project_id: input.project_id || null,
          client_id: input.client_id || null,
          line_items: input.line_items as any,
          subtotal: input.subtotal,
          retainer_applied: input.retainer_applied || 0,
          fees: (input.fees || {}) as any,
          total_due: input.total_due,
          status: input.status || "draft",
          review_reason: input.review_reason || null,
          payment_terms: input.payment_terms || "Net 30",
          due_date: input.due_date || null,
          billed_to_contact_id: input.billed_to_contact_id || null,
          created_by: profile.id,
          special_instructions: input.special_instructions || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from("invoice_activity_log").insert({
        company_id: profile.company_id,
        invoice_id: (data as any).id,
        action: "created",
        details: "Invoice created",
        performed_by: profile.id,
      } as any);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-counts"] });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<InvoiceFormInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.project_id !== undefined) updateData.project_id = input.project_id;
      if (input.client_id !== undefined) updateData.client_id = input.client_id;
      if (input.line_items !== undefined) updateData.line_items = input.line_items;
      if (input.subtotal !== undefined) updateData.subtotal = input.subtotal;
      if (input.retainer_applied !== undefined) updateData.retainer_applied = input.retainer_applied;
      if (input.fees !== undefined) updateData.fees = input.fees;
      if (input.total_due !== undefined) updateData.total_due = input.total_due;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.review_reason !== undefined) updateData.review_reason = input.review_reason;
      if (input.payment_terms !== undefined) updateData.payment_terms = input.payment_terms;
      if (input.due_date !== undefined) updateData.due_date = input.due_date;
      if (input.billed_to_contact_id !== undefined) updateData.billed_to_contact_id = input.billed_to_contact_id;
      if (input.special_instructions !== undefined) updateData.special_instructions = input.special_instructions;

      const { data, error } = await supabase
        .from("invoices")
        .update(updateData as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-counts"] });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-counts"] });
    },
  });
}
