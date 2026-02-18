import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Mock PM data for demonstration
const MOCK_PMS = [
  { id: "mock-pm-1", name: "Sarah Chen", role: "pm", projects: 3, billableHours: 5.5, totalHours: 7.3 },
  { id: "mock-pm-2", name: "Marcus Rivera", role: "pm", projects: 2, billableHours: 3.5, totalHours: 4.0 },
  { id: "mock-pm-3", name: "Diana Kowalski", role: "pm", projects: 4, billableHours: 2.5, totalHours: 4.0 },
  { id: "mock-pm-4", name: "James Okonkwo", role: "pm", projects: 2, billableHours: 3.3, totalHours: 4.5 },
];

export function useProjectsByPM() {
  return useQuery({
    queryKey: ["projects-by-pm"],
    queryFn: async () => {
      const { data: projects } = await supabase
        .from("projects")
        .select(`
          id, status, assigned_pm_id,
          assigned_pm:profiles!projects_assigned_pm_id_fkey(id, first_name, last_name, display_name)
        `)
        .eq("status", "open");

      const pmMap: Record<string, { name: string; projects: number }> = {};
      (projects || []).forEach((p: any) => {
        const pmId = p.assigned_pm_id;
        if (!pmId) return;
        if (!pmMap[pmId]) {
          const pm = p.assigned_pm;
          pmMap[pmId] = {
            name: pm ? `${pm.first_name || ""} ${pm.last_name || ""}`.trim() || pm.display_name || "Unknown" : "Unassigned",
            projects: 0,
          };
        }
        pmMap[pmId].projects++;
      });

      const result = Object.entries(pmMap)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.projects - a.projects);

      // If less than 2 real PMs, supplement with mock data
      if (result.length < 2) {
        return MOCK_PMS.map((m) => ({ id: m.id, name: m.name, projects: m.projects }));
      }
      return result;
    },
  });
}

export function useTeamUtilization() {
  return useQuery({
    queryKey: ["team-utilization-dashboard"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

      const { data: activities } = await supabase
        .from("activities")
        .select("user_id, duration_minutes, billable")
        .gte("activity_date", weekAgo)
        .lte("activity_date", today);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name, role")
        .eq("is_active", true);

      const { data: projects } = await supabase
        .from("projects")
        .select("id, assigned_pm_id")
        .eq("status", "open");

      const pmProjectCount: Record<string, number> = {};
      (projects || []).forEach((p: any) => {
        if (p.assigned_pm_id) {
          pmProjectCount[p.assigned_pm_id] = (pmProjectCount[p.assigned_pm_id] || 0) + 1;
        }
      });

      const byUser: Record<string, { name: string; billable: number; nonBillable: number; projects: number }> = {};
      (profiles || []).forEach((p: any) => {
        const name = `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.display_name || "Unknown";
        byUser[p.id] = { name, billable: 0, nonBillable: 0, projects: pmProjectCount[p.id] || 0 };
      });

      (activities || []).forEach((a: any) => {
        if (!a.user_id || !byUser[a.user_id]) return;
        const mins = a.duration_minutes || 0;
        if (a.billable) byUser[a.user_id].billable += mins;
        else byUser[a.user_id].nonBillable += mins;
      });

      let result = Object.entries(byUser)
        .map(([id, data]) => ({
          id,
          name: data.name,
          billableHours: Math.round((data.billable / 60) * 10) / 10,
          totalHours: Math.round(((data.billable + data.nonBillable) / 60) * 10) / 10,
          projects: data.projects,
          rate: data.billable + data.nonBillable > 0
            ? Math.round((data.billable / (data.billable + data.nonBillable)) * 100)
            : 0,
        }))
        .filter((u) => u.totalHours > 0 || u.projects > 0)
        .sort((a, b) => b.totalHours - a.totalHours);

      // Supplement with mock data if sparse
      if (result.length < 2) {
        result = MOCK_PMS.map((m) => ({
          id: m.id,
          name: m.name,
          billableHours: m.billableHours,
          totalHours: m.totalHours,
          projects: m.projects,
          rate: Math.round((m.billableHours / m.totalHours) * 100),
        }));
      }

      return result;
    },
  });
}

export function useAccountingDashboard() {
  return useQuery({
    queryKey: ["accounting-dashboard"],
    queryFn: async () => {
      const [billingRes, invoicesRes, promisesRes] = await Promise.all([
        supabase
          .from("billing_requests")
          .select("id, status, total_amount, created_by, project_id, projects(name, project_number), created_by_profile:profiles!billing_requests_created_by_fkey(first_name, last_name)")
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("invoices")
          .select("id, status, total_due, invoice_number, due_date, client_id, clients(name)")
          .in("status", ["sent", "overdue"]),
        supabase
          .from("payment_promises")
          .select("id, status, promised_amount, promised_date, invoice_id, invoices(invoice_number, total_due, clients(name))")
          .in("status", ["pending", "broken"])
          .order("promised_date", { ascending: true }),
      ]);

      const pendingBilling = billingRes.data || [];
      const outstandingInvoices = invoicesRes.data || [];
      const activePromises = promisesRes.data || [];

      const overdueInvoices = outstandingInvoices.filter((i: any) => i.status === "overdue");
      const sentInvoices = outstandingInvoices.filter((i: any) => i.status === "sent");

      const followUpsByType = {
        overdue: overdueInvoices.length,
        promises_pending: activePromises.filter((p: any) => p.status === "pending").length,
        promises_broken: activePromises.filter((p: any) => p.status === "broken").length,
        sent_outstanding: sentInvoices.length,
      };

      const totalPendingBilling = pendingBilling.reduce((s: number, b: any) => s + (b.total_amount || 0), 0);
      const totalOutstanding = outstandingInvoices.reduce((s: number, i: any) => s + (i.total_due || 0), 0);

      return {
        pendingBilling,
        overdueInvoices,
        sentInvoices,
        activePromises,
        followUpsByType,
        totalPendingBilling,
        totalOutstanding,
      };
    },
  });
}

export function useRevenueTrend(months: number = 6) {
  return useQuery({
    queryKey: ["revenue-trend", months],
    queryFn: async () => {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, status, total_due, payment_amount, created_at, paid_at");

      const now = new Date();
      const result: { month: string; billed: number; collected: number; outstanding: number }[] = [];

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

        let billed = 0, collected = 0, outstanding = 0;
        (invoices || []).forEach((inv: any) => {
          const created = inv.created_at?.substring(0, 7);
          const paidMonth = inv.paid_at?.substring(0, 7);
          if (created === monthStr) {
            billed += inv.total_due || 0;
            if (inv.status !== "paid") {
              outstanding += (inv.total_due || 0) - (inv.payment_amount || 0);
            }
          }
          if (paidMonth === monthStr) {
            collected += inv.payment_amount || inv.total_due || 0;
          }
        });

        result.push({ month: label, billed, collected, outstanding: Math.max(0, outstanding) });
      }

      return result;
    },
  });
}
