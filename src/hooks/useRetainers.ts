import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientRetainer {
  id: string;
  company_id: string;
  client_id: string;
  original_amount: number;
  current_balance: number;
  status: "active" | "depleted" | "refunded" | "cancelled";
  notes: string | null;
  qbo_credit_memo_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  clients?: { name: string } | null;
}

export interface RetainerTransaction {
  id: string;
  company_id: string;
  retainer_id: string;
  invoice_id: string | null;
  type: "deposit" | "draw_down" | "refund" | "adjustment";
  amount: number;
  balance_after: number;
  description: string | null;
  performed_by: string | null;
  created_at: string;
  invoices?: { invoice_number: string } | null;
  profiles?: { display_name: string } | null;
}

export function useRetainers() {
  return useQuery({
    queryKey: ["client-retainers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_retainers")
        .select("*, clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ClientRetainer[];
    },
  });
}

export function useClientRetainer(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ["client-retainer", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_retainers")
        .select("*")
        .eq("client_id", clientId!)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ClientRetainer | null;
    },
  });
}

export function useRetainerTransactions(retainerId: string | null | undefined) {
  return useQuery({
    queryKey: ["retainer-transactions", retainerId],
    enabled: !!retainerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retainer_transactions")
        .select("*, invoices(invoice_number), profiles(display_name)")
        .eq("retainer_id", retainerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RetainerTransaction[];
    },
  });
}

export function useCreateRetainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      client_id: string;
      original_amount: number;
      notes?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, id")
        .single();
      if (!profile) throw new Error("No profile");

      const { data, error } = await supabase
        .from("client_retainers")
        .insert({
          company_id: profile.company_id,
          client_id: payload.client_id,
          original_amount: payload.original_amount,
          current_balance: payload.original_amount,
          notes: payload.notes || null,
          created_by: profile.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Record deposit transaction
      await supabase.from("retainer_transactions").insert({
        company_id: profile.company_id,
        retainer_id: data.id,
        type: "deposit",
        amount: payload.original_amount,
        balance_after: payload.original_amount,
        description: "Initial retainer deposit",
        performed_by: profile.id,
      });

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-retainers"] });
      qc.invalidateQueries({ queryKey: ["client-retainer"] });
    },
  });
}

export function useApplyRetainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      retainer_id: string;
      invoice_id: string;
      amount: number;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, id")
        .single();
      if (!profile) throw new Error("No profile");

      // Get current retainer balance
      const { data: retainer, error: rErr } = await supabase
        .from("client_retainers")
        .select("current_balance")
        .eq("id", payload.retainer_id)
        .single();
      if (rErr || !retainer) throw new Error("Retainer not found");

      const newBalance = retainer.current_balance - payload.amount;
      if (newBalance < 0) throw new Error("Insufficient retainer balance");

      // Update retainer balance
      const newStatus = newBalance === 0 ? "depleted" : "active";
      const { error: uErr } = await supabase
        .from("client_retainers")
        .update({ current_balance: newBalance, status: newStatus })
        .eq("id", payload.retainer_id);
      if (uErr) throw uErr;

      // Record transaction
      const { error: tErr } = await supabase
        .from("retainer_transactions")
        .insert({
          company_id: profile.company_id,
          retainer_id: payload.retainer_id,
          invoice_id: payload.invoice_id,
          type: "draw_down",
          amount: payload.amount,
          balance_after: newBalance,
          description: `Applied to invoice`,
          performed_by: profile.id,
        });
      if (tErr) throw tErr;

      // Update invoice with retainer info
      const { error: iErr } = await supabase
        .from("invoices")
        .update({
          retainer_applied: payload.amount,
          retainer_id: payload.retainer_id,
        })
        .eq("id", payload.invoice_id);
      if (iErr) throw iErr;

      return { newBalance, newStatus };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-retainers"] });
      qc.invalidateQueries({ queryKey: ["client-retainer"] });
      qc.invalidateQueries({ queryKey: ["retainer-transactions"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useAddRetainerFunds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      retainer_id: string;
      amount: number;
      description?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, id")
        .single();
      if (!profile) throw new Error("No profile");

      const { data: retainer } = await supabase
        .from("client_retainers")
        .select("current_balance")
        .eq("id", payload.retainer_id)
        .single();
      if (!retainer) throw new Error("Retainer not found");

      const newBalance = retainer.current_balance + payload.amount;

      await supabase
        .from("client_retainers")
        .update({ current_balance: newBalance, status: "active" })
        .eq("id", payload.retainer_id);

      await supabase.from("retainer_transactions").insert({
        company_id: profile.company_id,
        retainer_id: payload.retainer_id,
        type: "deposit",
        amount: payload.amount,
        balance_after: newBalance,
        description: payload.description || "Additional deposit",
        performed_by: profile.id,
      });

      return { newBalance };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-retainers"] });
      qc.invalidateQueries({ queryKey: ["client-retainer"] });
      qc.invalidateQueries({ queryKey: ["retainer-transactions"] });
    },
  });
}
