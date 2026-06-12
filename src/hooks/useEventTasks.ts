import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type EventTaskStatus = "open" | "in_progress" | "done";

export interface EventTask {
  id: string;
  company_id: string;
  event_id: string;
  title: string;
  assigned_to: string | null;
  due_date: string | null;
  status: EventTaskStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
  } | null;
  event?: { id: string; name: string; start_date: string | null } | null;
}

const SELECT_WITH_ASSIGNEE =
  "*, assignee:profiles!bd_event_tasks_assigned_to_fkey(id, first_name, last_name, display_name)";

/** Tasks for a single event. */
export function useEventTasks(eventId: string | undefined) {
  return useQuery({
    queryKey: ["bd-event-tasks", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_event_tasks" as any)
        .select(SELECT_WITH_ASSIGNEE)
        .eq("event_id", eventId as string)
        .order("status", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EventTask[];
    },
  });
}

/** Open event prep tasks assigned to the current user across all events. */
export function useMyEventTasks() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["bd-event-tasks", "mine", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_event_tasks" as any)
        .select("*, event:bd_events!bd_event_tasks_event_id_fkey(id, name, start_date)")
        .eq("assigned_to", profile!.id)
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EventTask[];
    },
  });
}

export function useCreateEventTask() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      event_id: string;
      title: string;
      assigned_to?: string | null;
      due_date?: string | null;
    }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await supabase.from("bd_event_tasks" as any).insert({
        company_id: profile.company_id,
        event_id: input.event_id,
        title: input.title,
        assigned_to: input.assigned_to ?? null,
        due_date: input.due_date ?? null,
        created_by: profile.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: async (_d, v) => {
      await qc.invalidateQueries({ queryKey: ["bd-event-tasks", v.event_id] });
      await qc.invalidateQueries({ queryKey: ["bd-event-tasks", "mine"] });
    },
  });
}

export function useUpdateEventTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      event_id: _event_id,
      ...updates
    }: {
      id: string;
      event_id: string;
      title?: string;
      assigned_to?: string | null;
      due_date?: string | null;
      status?: EventTaskStatus;
    }) => {
      const { error } = await supabase
        .from("bd_event_tasks" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_d, v) => {
      await qc.invalidateQueries({ queryKey: ["bd-event-tasks", v.event_id] });
      await qc.invalidateQueries({ queryKey: ["bd-event-tasks", "mine"] });
    },
  });
}

export function useDeleteEventTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, event_id: _event_id }: { id: string; event_id: string }) => {
      const { error } = await supabase.from("bd_event_tasks" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_d, v) => {
      await qc.invalidateQueries({ queryKey: ["bd-event-tasks", v.event_id] });
      await qc.invalidateQueries({ queryKey: ["bd-event-tasks", "mine"] });
    },
  });
}
