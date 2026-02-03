import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DashboardStats {
  activeApplications: number;
  pendingProposals: number;
  urgentItems: number;
  totalProperties: number;
  todayHours: number;
  unbilledHours: number;
  teamMembers: number;
}

export function useDashboardStats() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["dashboard-stats", profile?.company_id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!profile?.company_id) {
        return {
          activeApplications: 0,
          pendingProposals: 0,
          urgentItems: 0,
          totalProperties: 0,
          todayHours: 0,
          unbilledHours: 0,
          teamMembers: 0,
        };
      }

      // Fetch all counts in parallel
      const [applicationsRes, propertiesRes, activitiesRes, profilesRes] = await Promise.all([
        // Active applications (not closed/complete)
        supabase
          .from("dob_applications")
          .select("id, status", { count: "exact" })
          .not("status", "in", '("closed","complete")'),
        
        // Total properties
        supabase
          .from("properties")
          .select("id", { count: "exact" }),
        
        // Today's activities for time calculation
        supabase
          .from("activities")
          .select("duration_minutes, billable")
          .eq("activity_date", new Date().toISOString().split("T")[0]),
        
        // Team members
        supabase
          .from("profiles")
          .select("id", { count: "exact" })
          .eq("is_active", true),
      ]);

      // Calculate stats
      const activeApplications = applicationsRes.count || 0;
      const totalProperties = propertiesRes.count || 0;
      const teamMembers = profilesRes.count || 0;

      // Calculate hours from activities
      const todayMinutes = (activitiesRes.data || []).reduce(
        (sum, a) => sum + (a.duration_minutes || 0),
        0
      );
      const todayHours = Math.round((todayMinutes / 60) * 10) / 10;

      // Unbilled hours (billable activities without qb_invoice_id on their service)
      const unbilledMinutes = (activitiesRes.data || [])
        .filter((a) => a.billable)
        .reduce((sum, a) => sum + (a.duration_minutes || 0), 0);
      const unbilledHours = Math.round((unbilledMinutes / 60) * 10) / 10;

      // Urgent items (applications with objection status)
      const urgentItems = (applicationsRes.data || []).filter(
        (a) => a.status === "objection"
      ).length;

      return {
        activeApplications,
        pendingProposals: 0, // Will implement with proposals feature
        urgentItems,
        totalProperties,
        todayHours,
        unbilledHours,
        teamMembers,
      };
    },
    enabled: !!profile?.company_id,
  });
}

export function useMyAssignedApplications() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["my-applications", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from("dob_applications")
        .select(`
          *,
          properties(address, borough)
        `)
        .eq("assigned_pm_id", profile.id)
        .not("status", "in", '("closed","complete")')
        .order("updated_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });
}

export function useRecentApplications() {
  return useQuery({
    queryKey: ["recent-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dob_applications")
        .select(`
          *,
          properties(address, borough),
          profiles(first_name, last_name)
        `)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });
}
