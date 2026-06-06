import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

export type ActivityType = Database["public"]["Enums"]["bd_activity_type"];

export interface LeadActivity {
  id: string;
  lead_id: string | null;
  type: ActivityType;
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

/** Activity thread for a lead — newest first; pinned rows are surfaced by the UI. */
export function useLeadActivities(leadId: string | undefined) {
  return useQuery({
    queryKey: ["lead-activities", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_activities")
        .select(
          "*, author:profiles!bd_activities_created_by_fkey(id, first_name, last_name, display_name, avatar_url)",
        )
        .eq("lead_id", leadId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LeadActivity[];
    },
  });
}

/** Insert a NOTE / CALL / MEETING (or any) activity row on a lead. */
export function useCreateLeadActivity() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      lead_id: string;
      type: ActivityType;
      content?: string | null;
      metadata?: Record<string, any>;
    }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await supabase.from("bd_activities").insert({
        company_id: profile.company_id,
        lead_id: input.lead_id,
        type: input.type,
        content: input.content ?? null,
        metadata: input.metadata ?? {},
        created_by: profile.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["lead-activities", v.lead_id] }),
  });
}

/** Pin / unpin an activity row. */
export function useToggleActivityPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; lead_id: string; is_pinned: boolean }) => {
      const { error } = await supabase
        .from("bd_activities")
        .update({ is_pinned: input.is_pinned } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["lead-activities", v.lead_id] }),
  });
}
