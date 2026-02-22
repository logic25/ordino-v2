import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEffect } from "react";

export interface ActionItem {
  id: string;
  company_id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  attachment_ids: any;
  completion_note: string | null;
  completion_attachments: any;
  completed_at: string | null;
  gchat_thread_id: string | null;
  gchat_space_id: string | null;
  created_at: string;
  updated_at: string;
  assignee?: { id: string; display_name: string | null; first_name: string | null; last_name: string | null } | null;
  assigner?: { id: string; display_name: string | null; first_name: string | null; last_name: string | null } | null;
}

export function useActionItems(projectId: string | undefined) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["action-items", projectId],
    enabled: !!profile?.company_id && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_action_items")
        .select(`
          *,
          assignee:profiles!project_action_items_assigned_to_fkey(id, display_name, first_name, last_name),
          assigner:profiles!project_action_items_assigned_by_fkey(id, display_name, first_name, last_name)
        `)
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ActionItem[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`action-items-${projectId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "project_action_items",
        filter: `project_id=eq.${projectId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["action-items", projectId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, queryClient]);

  return query;
}

export function useMyActionItems() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["my-action-items", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_action_items")
        .select(`
          *,
          assignee:profiles!project_action_items_assigned_to_fkey(id, display_name, first_name, last_name),
          assigner:profiles!project_action_items_assigned_by_fkey(id, display_name, first_name, last_name),
          projects!project_action_items_project_id_fkey(id, name, project_number)
        `)
        .eq("assigned_to", profile!.id)
        .eq("status", "open")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as (ActionItem & { projects: { id: string; name: string | null; project_number: string | null } })[];
    },
  });
}

export function useCreateActionItem() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      project_id: string;
      title: string;
      description?: string;
      assigned_to?: string;
      priority?: string;
      due_date?: string;
      attachment_ids?: any[];
    }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { data, error } = await supabase.from("project_action_items").insert({
        company_id: profile.company_id,
        project_id: input.project_id,
        title: input.title,
        description: input.description || null,
        assigned_to: input.assigned_to || null,
        assigned_by: profile.id,
        priority: input.priority || "normal",
        due_date: input.due_date || null,
        attachment_ids: input.attachment_ids || [],
      } as any).select("id").single();
      if (error) throw error;

      // Fire-and-forget GChat notification
      if (data?.id) {
        supabase.functions.invoke("send-gchat-action-item", {
          body: { action_item_id: data.id },
        }).catch((err) => console.warn("GChat notification failed:", err));
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["action-items", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["my-action-items"] });
    },
  });
}

export function useCompleteActionItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      project_id: string;
      completion_note?: string;
      completion_attachments?: { name: string; storage_path: string }[];
    }) => {
      const { error } = await supabase
        .from("project_action_items")
        .update({
          status: "done",
          completion_note: input.completion_note || null,
          completion_attachments: input.completion_attachments || [],
        } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["action-items", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["my-action-items"] });
    },
  });
}

export function useCancelActionItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; project_id: string }) => {
      const { error } = await supabase
        .from("project_action_items")
        .update({ status: "cancelled" } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["action-items", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["my-action-items"] });
    },
  });
}
