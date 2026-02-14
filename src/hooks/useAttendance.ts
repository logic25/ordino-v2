import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCallback } from "react";

export interface AttendanceLog {
  id: string;
  user_id: string;
  company_id: string;
  log_date: string;
  clock_in: string;
  clock_out: string | null;
  clock_in_location: string | null;
  ip_address: string | null;
  total_minutes: number | null;
  auto_closed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceWithProfile extends AttendanceLog {
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
  };
}

// Get today's attendance log for the current user
export function useTodayAttendance() {
  const { user, profile } = useAuth();
  const today = new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: ["attendance", "today", user?.id],
    queryFn: async () => {
      if (!user || !profile) return null;
      const { data, error } = await (supabase as any)
        .from("attendance_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("log_date", today)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as AttendanceLog | null;
    },
    enabled: !!user && !!profile,
    refetchInterval: 60_000, // refresh every minute for live timer
  });
}

// Get attendance logs for the company (team view)
export function useAttendanceLogs(dateRange?: { from: string; to: string }) {
  const { profile } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const from = dateRange?.from ?? today;
  const to = dateRange?.to ?? today;

  return useQuery({
    queryKey: ["attendance", "logs", profile?.company_id, from, to],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await (supabase as any)
        .from("attendance_logs")
        .select("*, profiles(first_name, last_name, display_name)")
        .eq("company_id", profile.company_id)
        .gte("log_date", from)
        .lte("log_date", to)
        .order("log_date", { ascending: false })
        .order("clock_in", { ascending: false });

      if (error) throw error;
      return (data ?? []) as AttendanceWithProfile[];
    },
    enabled: !!profile?.company_id,
  });
}

// Clock in mutation
export function useClockIn() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (location?: string) => {
      if (!user || !profile) throw new Error("Not authenticated");

      // Try to get IP for location context
      let ipAddress: string | null = null;
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const json = await res.json();
        ipAddress = json.ip;
      } catch {
        // non-critical
      }

      const { data, error } = await (supabase as any)
        .from("attendance_logs")
        .insert({
          user_id: user.id,
          company_id: profile.company_id,
          clock_in_location: location ?? "Remote",
          ip_address: ipAddress,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") return null;
        throw error;
      }
      return data as AttendanceLog;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

// Clock out mutation
export function useClockOut() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      if (!user) throw new Error("Not authenticated");

      const clockOut = new Date().toISOString();
      const { data: log } = await (supabase as any)
        .from("attendance_logs")
        .select("clock_in")
        .eq("id", id)
        .single();

      let totalMinutes: number | null = null;
      if ((log as any)?.clock_in) {
        totalMinutes = Math.round(
          (new Date(clockOut).getTime() - new Date((log as any).clock_in).getTime()) / 60000
        );
      }

      const { data, error } = await (supabase as any)
        .from("attendance_logs")
        .update({
          clock_out: clockOut,
          total_minutes: totalMinutes,
          notes: notes ?? null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as AttendanceLog;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

// Auto clock-in on login (called from auth flow)
export function useAutoClockIn() {
  const clockIn = useClockIn();

  return useCallback(async () => {
    try {
      await clockIn.mutateAsync("Auto");
    } catch {
      // silently fail - non-critical
    }
  }, [clockIn]);
}
