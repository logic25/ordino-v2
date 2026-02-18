import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DashboardStats {
  activeProjects: number;
  pendingProposals: number;
  urgentItems: number;
  totalProperties: number;
  todayHours: number;
  unbilledHours: number;
  teamMembers: number;
  overdueInvoices: number;
  totalOutstanding: number;
  sentProposals: number;
  projectsBilled: number;
  projectsPaid: number;
}

export function useDashboardStats() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["dashboard-stats", profile?.company_id, profile?.id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!profile?.company_id) {
        return {
          activeProjects: 0,
          pendingProposals: 0,
          urgentItems: 0,
          totalProperties: 0,
          todayHours: 0,
          unbilledHours: 0,
          teamMembers: 0,
          overdueInvoices: 0,
          totalOutstanding: 0,
          sentProposals: 0,
          projectsBilled: 0,
          projectsPaid: 0,
        };
      }

      const [projectsRes, propertiesRes, activitiesRes, profilesRes, proposalsRes, invoicesRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, status, assigned_pm_id", { count: "exact" })
          .eq("status", "open"),

        supabase
          .from("properties")
          .select("id", { count: "exact" }),

        supabase
          .from("activities")
          .select("duration_minutes, billable")
          .eq("activity_date", new Date().toISOString().split("T")[0]),

        supabase
          .from("profiles")
          .select("id", { count: "exact" })
          .eq("is_active", true),

        supabase
          .from("proposals")
          .select("id, status"),

        supabase
          .from("invoices")
          .select("id, status, total_due"),
      ]);

      const activeProjects = projectsRes.count || 0;
      const totalProperties = propertiesRes.count || 0;
      const teamMembers = profilesRes.count || 0;

      const todayMinutes = (activitiesRes.data || []).reduce(
        (sum, a) => sum + (a.duration_minutes || 0), 0
      );
      const todayHours = Math.round((todayMinutes / 60) * 10) / 10;

      const unbilledMinutes = (activitiesRes.data || [])
        .filter((a) => a.billable)
        .reduce((sum, a) => sum + (a.duration_minutes || 0), 0);
      const unbilledHours = Math.round((unbilledMinutes / 60) * 10) / 10;

      const proposals = proposalsRes.data || [];
      const pendingProposals = proposals.filter((p) => p.status === "sent" || p.status === "signed_client").length;
      const sentProposals = proposals.filter((p) => p.status === "sent").length;

      const invoices = invoicesRes.data || [];
      const overdueInvoices = invoices.filter((i) => i.status === "overdue").length;
      const totalOutstanding = invoices
        .filter((i) => ["sent", "overdue"].includes(i.status))
        .reduce((sum, i) => sum + (i.total_due || 0), 0);

      const projectsBilled = 0; // Will track via billing_requests
      const projectsPaid = (projectsRes.data || []).filter((p: any) => p.status === "paid").length;

      return {
        activeProjects,
        pendingProposals,
        urgentItems: overdueInvoices,
        totalProperties,
        todayHours,
        unbilledHours,
        teamMembers,
        overdueInvoices,
        totalOutstanding,
        sentProposals,
        projectsBilled,
        projectsPaid,
      };
    },
    enabled: !!profile?.company_id,
  });
}

export function useMyAssignedProjects() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["my-projects-dashboard", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          properties(address, borough),
          clients!projects_client_id_fkey(name),
          proposals!projects_proposal_id_fkey(title, total_amount)
        `)
        .or(`assigned_pm_id.eq.${profile.id},senior_pm_id.eq.${profile.id}`)
        .eq("status", "open")
        .order("updated_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });
}

export function useRecentProjects() {
  return useQuery({
    queryKey: ["recent-projects-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          properties(address, borough),
          clients!projects_client_id_fkey(name),
          assigned_pm:profiles!projects_assigned_pm_id_fkey(first_name, last_name)
        `)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });
}
