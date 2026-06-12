import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

export type BdActivityType = Database["public"]["Enums"]["bd_activity_type"];

export interface BdActivity {
  id: string;
  lead_id: string | null;
  event_id: string | null;
  type: BdActivityType;
  content: string | null;
  metadata: Record<string, any>;
  is_pinned: boolean;
  created_at: string;
  created_by: string | null;
  author?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export type BdActivityFilter = { leadId?: string; eventId?: string };

const queryKey = (f: BdActivityFilter) =>
  f.eventId ? ["bd-activities", "event", f.eventId] : ["bd-activities", "lead", f.leadId];

export function useBdActivities(filter: BdActivityFilter) {
  return useQuery({
    queryKey: queryKey(filter),
    enabled: !!(filter.leadId || filter.eventId),
    queryFn: async () => {
      let q = supabase
        .from("bd_activities")
        .select(
          "*, author:profiles!bd_activities_created_by_fkey(id, first_name, last_name, display_name, avatar_url)",
        )
        .order("created_at", { ascending: false });
      if (filter.eventId) q = q.eq("event_id", filter.eventId);
      else if (filter.leadId) q = q.eq("lead_id", filter.leadId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as BdActivity[];
    },
  });
}

export function useCreateBdActivity() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      filter: BdActivityFilter;
      type: BdActivityType;
      content?: string | null;
      metadata?: Record<string, any>;
      mentioned_user_ids?: string[];
    }) => {
      if (!profile?.company_id) throw new Error("No company");
      const mentioned = (input.mentioned_user_ids ?? []).filter((id) => id !== profile.id);
      const { error } = await supabase.from("bd_activities").insert({
        company_id: profile.company_id,
        lead_id: input.filter.leadId ?? null,
        event_id: input.filter.eventId ?? null,
        type: input.type,
        content: input.content ?? null,
        metadata: input.metadata ?? {},
        created_by: profile.id,
        mentioned_user_ids: mentioned,
      } as any);
      if (error) throw error;

      // Fire-and-forget bell notifications for each mentioned teammate
      if (mentioned.length > 0) {
        const link = input.filter.eventId
          ? `/bd/events/${input.filter.eventId}`
          : input.filter.leadId
            ? `/bd/leads/${input.filter.leadId}`
            : null;
        const authorName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "A teammate";
        const rows = mentioned.map((uid) => ({
          company_id: profile.company_id!,
          user_id: uid,
          type: "bd_mention",
          title: `${authorName} mentioned you`,
          body: (input.content ?? "").slice(0, 200),
          link,
          event_id: input.filter.eventId ?? null,
        }));
        await supabase.from("notifications").insert(rows as any);
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: queryKey(v.filter) });
      // Legacy hook cache (BdLeadDetail still uses useLeadActivities).
      if (v.filter.leadId) qc.invalidateQueries({ queryKey: ["lead-activities", v.filter.leadId] });
    },
  });
}

export function useToggleBdActivityPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; filter: BdActivityFilter; is_pinned: boolean }) => {
      const { error } = await supabase
        .from("bd_activities")
        .update({ is_pinned: input.is_pinned } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: queryKey(v.filter) }),
  });
}
