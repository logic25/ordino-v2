import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ChangeOrder {
  id: string;
  company_id: string;
  project_id: string;
  co_number: string;
  title: string;
  description: string | null;
  reason: string | null;
  amount: number;
  status: "draft" | "pending_internal" | "pending_client" | "approved" | "rejected" | "voided";
  requested_by: string | null;
  linked_service_names: string[];
  internal_signed_at: string | null;
  internal_signed_by: string | null;
  internal_signature_data: string | null;
  client_signed_at: string | null;
  client_signer_name: string | null;
  client_signature_data: string | null;
  sent_at: string | null;
  approved_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChangeOrderFormInput {
  title: string;
  description?: string;
  reason?: string;
  amount: number;
  requested_by?: string;
  linked_service_names?: string[];
  notes?: string;
}

const QK = (projectId: string) => ["change-orders", projectId];

const cast = <T>(v: unknown): T => v as T;

export function useChangeOrders(projectId: string | undefined) {
  return useQuery({
    queryKey: QK(projectId!),
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("change_orders" as any)
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return cast<ChangeOrder[]>(data ?? []);
    },
  });
}

export function useCreateChangeOrder() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: ChangeOrderFormInput & { project_id: string; company_id: string; status?: ChangeOrder["status"] }) => {
      const { data, error } = await supabase
        .from("change_orders" as any)
        .insert({
          project_id: input.project_id,
          company_id: input.company_id,
          title: input.title,
          description: input.description ?? null,
          reason: input.reason ?? null,
          amount: input.amount,
          requested_by: input.requested_by ?? null,
          linked_service_names: input.linked_service_names ?? [],
          notes: input.notes ?? null,
          status: input.status ?? "draft",
          created_by: profile?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return cast<ChangeOrder>(data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QK(data.project_id) });
    },
  });
}

export function useUpdateChangeOrder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<ChangeOrder> & { id: string; project_id: string }) => {
      const { id, project_id, ...rest } = input;
      const { data, error } = await supabase
        .from("change_orders" as any)
        .update(rest)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return cast<ChangeOrder>(data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QK(data.project_id) });
    },
  });
}

export function useDeleteChangeOrder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase
        .from("change_orders" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id, project_id };
    },
    onSuccess: ({ project_id }) => {
      qc.invalidateQueries({ queryKey: QK(project_id) });
    },
  });
}

export function useSignCOInternal() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id, project_id, signatureData }: { id: string; project_id: string; signatureData: string }) => {
      if (profile) {
        supabase
          .from("profiles")
          .update({ signature_data: signatureData } as any)
          .eq("id", profile.id)
          .then(() => {});
      }

      const { data, error } = await supabase
        .from("change_orders" as any)
        .update({
          internal_signed_at: new Date().toISOString(),
          internal_signed_by: profile?.id ?? null,
          internal_signature_data: signatureData,
          status: "pending_client",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return cast<ChangeOrder>(data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QK(data.project_id) });
    },
  });
}

export function useMarkCOApproved() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, project_id, clientSignerName, clientSignatureData }: {
      id: string;
      project_id: string;
      clientSignerName?: string;
      clientSignatureData?: string;
    }) => {
      const { data, error } = await supabase
        .from("change_orders" as any)
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          ...(clientSignerName ? { client_signer_name: clientSignerName } : {}),
          ...(clientSignatureData ? {
            client_signature_data: clientSignatureData,
            client_signed_at: new Date().toISOString(),
          } : {}),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return cast<ChangeOrder>(data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QK(data.project_id) });
    },
  });
}

export function useSendCOToClient() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { data, error } = await supabase
        .from("change_orders" as any)
        .update({
          sent_at: new Date().toISOString(),
          status: "pending_client",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return cast<ChangeOrder>(data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QK(data.project_id) });
    },
  });
}
