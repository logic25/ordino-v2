import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type ObjectionItem = Tables<"objection_items">;
export type ObjectionItemInsert = TablesInsert<"objection_items">;
export type ObjectionItemUpdate = TablesUpdate<"objection_items">;

export function useObjectionItems(projectId: string | undefined) {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const queryClient = useQueryClient();
  const queryKey = ["objection_items", projectId];

  const query = useQuery({
    queryKey,
    enabled: !!projectId && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("objection_items")
        .select("*")
        .eq("project_id", projectId!)
        .eq("company_id", companyId!)
        .order("item_number", { ascending: true });
      if (error) throw error;
      return data as ObjectionItem[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (item: ObjectionItemInsert) => {
      const { data, error } = await supabase
        .from("objection_items")
        .upsert({ ...item, company_id: companyId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: ObjectionItemUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("objection_items")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const bulkInsert = useMutation({
    mutationFn: async (items: ObjectionItemInsert[]) => {
      const rows = items.map((item) => ({ ...item, company_id: companyId! }));
      const { data, error } = await supabase
        .from("objection_items")
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("objection_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const removeAll = useMutation({
    mutationFn: async () => {
      if (!projectId || !companyId) return;
      const { error } = await supabase
        .from("objection_items")
        .delete()
        .eq("project_id", projectId)
        .eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    upsert: upsert.mutateAsync,
    update: update.mutateAsync,
    bulkInsert: bulkInsert.mutateAsync,
    remove: remove.mutateAsync,
  };
}
