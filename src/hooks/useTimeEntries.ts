import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Activity = Tables<"activities">;
export type ActivityInsert = TablesInsert<"activities">;

// Get time entries for a specific date range
export function useTimeEntries(dateRange?: { from: string; to: string }) {
  const { user, profile } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const from = dateRange?.from ?? today;
  const to = dateRange?.to ?? today;

  return useQuery({
    queryKey: ["time-entries", user?.id, from, to],
    queryFn: async () => {
      if (!user || !profile) return [];

      const { data, error } = await supabase
        .from("activities")
        .select(`
          *,
          services(id, name),
          dob_applications(id, job_number, property_id,
            properties(address)
          )
        `)
        .eq("user_id", profile.id)
        .gte("activity_date", from)
        .lte("activity_date", to)
        .order("activity_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && !!profile,
  });
}

// Get today's summary (total minutes, billable minutes)
export function useTodaySummary() {
  const { user, profile } = useAuth();
  const today = new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: ["time-summary", "today", user?.id],
    queryFn: async () => {
      if (!user || !profile) return { totalMinutes: 0, billableMinutes: 0, entries: 0 };

      const { data, error } = await supabase
        .from("activities")
        .select("duration_minutes, billable")
        .eq("user_id", profile.id)
        .eq("activity_date", today);

      if (error) throw error;

      const totalMinutes = (data ?? []).reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
      const billableMinutes = (data ?? [])
        .filter((e) => e.billable)
        .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);

      return { totalMinutes, billableMinutes, entries: data?.length ?? 0 };
    },
    enabled: !!user && !!profile,
  });
}

// Get this week's summary
export function useWeekSummary() {
  const { user, profile } = useAuth();
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const from = monday.toISOString().split("T")[0];
  const to = sunday.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["time-summary", "week", user?.id, from],
    queryFn: async () => {
      if (!user || !profile) return { totalMinutes: 0, billableMinutes: 0, entries: 0 };

      const { data, error } = await supabase
        .from("activities")
        .select("duration_minutes, billable")
        .eq("user_id", profile.id)
        .gte("activity_date", from)
        .lte("activity_date", to);

      if (error) throw error;

      const totalMinutes = (data ?? []).reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
      const billableMinutes = (data ?? [])
        .filter((e) => e.billable)
        .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);

      return { totalMinutes, billableMinutes, entries: data?.length ?? 0 };
    },
    enabled: !!user && !!profile,
  });
}

// Create a time entry
export function useCreateTimeEntry() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (entry: Partial<ActivityInsert>) => {
      if (!profile) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("activities")
        .insert({
          ...entry,
          user_id: profile.id,
          company_id: profile.company_id,
          activity_type: entry.activity_type ?? "time_log",
          activity_date: entry.activity_date ?? new Date().toISOString().split("T")[0],
        } as ActivityInsert)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time-entries"] });
      qc.invalidateQueries({ queryKey: ["time-summary"] });
    },
  });
}

// Delete a time entry
export function useDeleteTimeEntry() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time-entries"] });
      qc.invalidateQueries({ queryKey: ["time-summary"] });
    },
  });
}

// Format minutes to HH:MM display
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}
