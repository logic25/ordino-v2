import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type CalendarFunctionErrorPayload = {
  error?: string;
  error_code?: string;
  details?: string;
  needs_reauth?: boolean;
};

async function readCalendarFunctionError(error: any): Promise<CalendarFunctionErrorPayload | null> {
  try {
    if (typeof error?.context?.json === "function") {
      return (await error.context.json()) as CalendarFunctionErrorPayload;
    }
  } catch {
    // Ignore JSON parsing failures and fall back to the generic error message.
  }

  return null;
}

function formatCalendarFunctionError(payload: CalendarFunctionErrorPayload | null, fallback?: string) {
  if (!payload?.error) return fallback || "Calendar request failed.";

  switch (payload.error_code) {
    case "calendar_api_disabled":
      return "Google Calendar API is disabled for the connected Google project. Enable it in Google Cloud, then try again.";
    case "calendar_reauth_required":
      return "Reconnect Gmail and approve Calendar permissions, then try again.";
    default:
      return payload.details ? `${payload.error} ${payload.details}` : payload.error;
  }
}

async function unwrapCalendarFunctionResult<T>(result: { data: T | null; error: any }) {
  if (result.error) {
    const payload = await readCalendarFunctionError(result.error);
    throw new Error(formatCalendarFunctionError(payload, result.error.message));
  }

  const payload = result.data as CalendarFunctionErrorPayload | null;
  if (payload?.error) {
    throw new Error(formatCalendarFunctionError(payload));
  }

  return result.data as T;
}

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
      const result = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "sync", time_min, time_max },
      });
      return unwrapCalendarFunctionResult(result);
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
      attendee_ids?: string[];
      reminder_minutes?: number[];
      recurrence_rule?: string;
    }) => {
      const result = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "create", ...event },
      });
      return unwrapCalendarFunctionResult(result);
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
      attendee_ids?: string[];
      reminder_minutes?: number[];
      recurrence_rule?: string;
    }) => {
      const result = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "update", ...event },
      });
      return unwrapCalendarFunctionResult(result);
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
      const result = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "delete", event_id: eventId },
      });
      return unwrapCalendarFunctionResult(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}
