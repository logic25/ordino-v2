import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface TimelineEvent {
  id: string;
  company_id: string;
  project_id: string;
  event_type: string;
  description: string | null;
  actor_id: string | null;
  metadata: any;
  created_at: string;
  actor?: { display_name: string | null; first_name: string | null; last_name: string | null } | null;
}

export function useTimelineEvents(projectId: string | undefined) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["timeline-events", projectId],
    enabled: !!profile?.company_id && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_timeline_events")
        .select(`
          *,
          actor:profiles!project_timeline_events_actor_id_fkey(display_name, first_name, last_name)
        `)
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TimelineEvent[];
    },
  });
}
