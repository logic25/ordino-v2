import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type CalendarEvent = {
  id: string;
  company_id: string;
  user_id: string;
  google_event_id: string | null;
  google_calendar_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  event_type: string;
  project_id: string | null;
  property_id: string | null;
  client_id: string | null;
  application_id: string | null;
  source_email_id: string | null;
  reminder_minutes: number[] | null;
  status: string;
  sync_status: string;
  metadata: any;
  created_at: string;
  updated_at: string;
};

export function useCalendarEvents(startDate: string, endDate: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["calendar-events", startDate, endDate],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_time", startDate)
        .lte("start_time", endDate)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data as CalendarEvent[];
    },
  });
}

export function useSyncCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ time_min, time_max }: { time_min?: string; time_max?: string } = {}) => {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "sync", time_min, time_max },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: {
      title: string;
      description?: string;
      location?: string;
      start_time: string;
      end_time: string;
      all_day?: boolean;
      event_type?: string;
      project_id?: string;
      property_id?: string;
      client_id?: string;
      application_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "create", ...event },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: {
      event_id: string;
      title: string;
      description?: string;
      location?: string;
      start_time: string;
      end_time: string;
      all_day?: boolean;
      event_type?: string;
      project_id?: string;
      property_id?: string;
      client_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "update", ...event },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "delete", event_id: eventId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}
