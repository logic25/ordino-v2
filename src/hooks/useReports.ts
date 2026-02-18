import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { startOfMonth, subMonths, format, differenceInDays } from "date-fns";

export function useProjectReports() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["reports-projects", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: projects } = await supabase.from("projects").select("id, status, created_at, updated_at");
      const { data: checklist } = await supabase.from("project_checklist_items").select("id, project_id, status");
      const { data: apps } = await supabase.from("dob_applications").select("id, project_id, app_status, created_at, approved_date");

      const statusCounts: Record<string, number> = {};
      (projects || []).forEach((p: any) => {
        const s = p.status || "unknown";
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      // Checklist completion
      const projectChecklist: Record<string, { total: number; done: number }> = {};
      (checklist || []).forEach((item: any) => {
        if (!projectChecklist[item.project_id]) projectChecklist[item.project_id] = { total: 0, done: 0 };
        projectChecklist[item.project_id].total++;
        if (item.status === "received") projectChecklist[item.project_id].done++;
      });
      const checklistRates = Object.entries(projectChecklist).map(([id, v]) => ({
        projectId: id,
        rate: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
      }));
      const avgChecklistRate = checklistRates.length > 0
        ? Math.round(checklistRates.reduce((a, b) => a + b.rate, 0) / checklistRates.length)
        : 0;

      // App pipeline
      const appStatusCounts: Record<string, number> = {};
      (apps || []).forEach((a: any) => {
        const s = a.app_status || "unknown";
        appStatusCounts[s] = (appStatusCounts[s] || 0) + 1;
      });

      return { statusCounts, avgChecklistRate, checklistRates, appStatusCounts, totalProjects: (projects || []).length };
    },
  });
}

export function useBillingReports() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["reports-billing", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: invoices } = await supabase.from("invoices").select("id, status, total_due, payment_amount, due_date, paid_at, created_at");
      const now = new Date();
      const items = invoices || [];

      // Revenue by month (last 6 months)
      const months: { month: string; collected: number; outstanding: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(now, i));
        const label = format(monthStart, "MMM yyyy");
        let collected = 0, outstanding = 0;
        items.forEach((inv: any) => {
          const created = new Date(inv.created_at);
          if (format(startOfMonth(created), "MMM yyyy") === label) {
            if (inv.status === "paid") {
              collected += inv.payment_amount || inv.total_due || 0;
            } else {
              outstanding += (inv.total_due || 0) - (inv.payment_amount || 0);
            }
          }
        });
        months.push({ month: label, collected, outstanding });
      }

      // Aging
      const aging = { current: 0, "31-60": 0, "61-90": 0, "90+": 0 };
      items.filter((i: any) => i.status !== "paid").forEach((inv: any) => {
        const days = differenceInDays(now, new Date(inv.due_date));
        if (days <= 30) aging.current += inv.total_due || 0;
        else if (days <= 60) aging["31-60"] += inv.total_due || 0;
        else if (days <= 90) aging["61-90"] += inv.total_due || 0;
        else aging["90+"] += inv.total_due || 0;
      });

      // Collections
      const paidInvoices = items.filter((i: any) => i.status === "paid" && i.paid_at);
      const avgDaysToPay = paidInvoices.length > 0
        ? Math.round(paidInvoices.reduce((a: number, i: any) => a + differenceInDays(new Date(i.paid_at), new Date(i.created_at)), 0) / paidInvoices.length)
        : 0;
      const totalCollected = items.filter((i: any) => i.status === "paid").reduce((a: number, i: any) => a + (i.payment_amount || i.total_due || 0), 0);
      const totalBilled = items.reduce((a: number, i: any) => a + (i.total_due || 0), 0);
      const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

      return { months, aging, avgDaysToPay, collectionRate, totalCollected, totalBilled };
    },
  });
}

export function useTimeReports() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["reports-time", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: entries } = await supabase.from("activities").select("id, user_id, duration_minutes, billable, activity_date, application_id");
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, user_id");
      const items = entries || [];

      // Utilization by team member
      const byUser: Record<string, { name: string; billable: number; nonBillable: number }> = {};
      items.forEach((e: any) => {
        const uid = e.user_id || "unknown";
        if (!byUser[uid]) {
          const profile = (profiles || []).find((p: any) => p.id === uid);
          byUser[uid] = { name: profile?.display_name || "Unknown", billable: 0, nonBillable: 0 };
        }
        const mins = e.duration_minutes || 0;
        if (e.billable) byUser[uid].billable += mins;
        else byUser[uid].nonBillable += mins;
      });
      const utilization = Object.values(byUser).map((u) => ({
        ...u,
        totalHours: Math.round((u.billable + u.nonBillable) / 60 * 10) / 10,
        billableHours: Math.round(u.billable / 60 * 10) / 10,
        rate: u.billable + u.nonBillable > 0 ? Math.round((u.billable / (u.billable + u.nonBillable)) * 100) : 0,
      }));

      const totalHours = Math.round(items.reduce((a: number, e: any) => a + (e.duration_minutes || 0), 0) / 60 * 10) / 10;
      const billableHours = Math.round(items.filter((e: any) => e.billable).reduce((a: number, e: any) => a + (e.duration_minutes || 0), 0) / 60 * 10) / 10;

      return { utilization, totalHours, billableHours };
    },
  });
}

export function useProposalReports() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["reports-proposals", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: proposals } = await supabase.from("proposals").select("id, status, total_amount, follow_up_count, created_at");
      const items = proposals || [];

      const statusCounts: Record<string, number> = {};
      items.forEach((p: any) => {
        const s = p.status || "draft";
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      const sent = statusCounts["sent"] || 0;
      const executed = statusCounts["executed"] || 0;
      const lost = statusCounts["lost"] || 0;
      const winRate = sent + executed + lost > 0 ? Math.round((executed / (sent + executed + lost)) * 100) : 0;

      const pendingValue = items
        .filter((p: any) => ["draft", "sent"].includes(p.status))
        .reduce((a: number, p: any) => a + (p.total_amount || 0), 0);

      const executedProposals = items.filter((p: any) => p.status === "executed");
      const avgFollowUps = executedProposals.length > 0
        ? Math.round(executedProposals.reduce((a: number, p: any) => a + (p.follow_up_count || 0), 0) / executedProposals.length * 10) / 10
        : 0;

      return { statusCounts, winRate, pendingValue, avgFollowUps, total: items.length };
    },
  });
}

export function useProposalDetailedReports() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["reports-proposals-detailed", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: proposals } = await supabase
        .from("proposals")
        .select("id, status, total_amount, created_at, lead_source, sales_person_id");
      return { allProposals: proposals || [] };
    },
  });
}

export function useOperationsReports() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["reports-operations", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: projects } = await supabase.from("projects").select("id, client_id, assigned_to, status, due_date");
      const { data: clients } = await supabase.from("clients").select("id, name");
      const { data: invoices } = await supabase.from("invoices").select("id, client_id, total_due, payment_amount, status");
      const { data: profiles } = await supabase.from("profiles").select("id, display_name");

      // Client activity
      const clientMap: Record<string, { name: string; projects: number; revenue: number }> = {};
      (clients || []).forEach((c: any) => {
        clientMap[c.id] = { name: c.name, projects: 0, revenue: 0 };
      });
      (projects || []).forEach((p: any) => {
        if (p.client_id && clientMap[p.client_id]) clientMap[p.client_id].projects++;
      });
      (invoices || []).forEach((i: any) => {
        if (i.client_id && clientMap[i.client_id]) clientMap[i.client_id].revenue += i.status === "paid" ? (i.payment_amount || i.total_due || 0) : 0;
      });
      const clientActivity = Object.values(clientMap)
        .filter((c) => c.projects > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 15);

      // Team workload
      const teamMap: Record<string, { name: string; active: number; upcoming: number }> = {};
      (profiles || []).forEach((p: any) => {
        teamMap[p.id] = { name: p.display_name || "Unknown", active: 0, upcoming: 0 };
      });
      const now = new Date();
      (projects || []).forEach((p: any) => {
        if (p.assigned_to && teamMap[p.assigned_to]) {
          if (p.status === "active") teamMap[p.assigned_to].active++;
          if (p.due_date && differenceInDays(new Date(p.due_date), now) <= 14 && differenceInDays(new Date(p.due_date), now) >= 0) {
            teamMap[p.assigned_to].upcoming++;
          }
        }
      });
      const teamWorkload = Object.values(teamMap).filter((t) => t.active > 0).sort((a, b) => b.active - a.active);

      return { clientActivity, teamWorkload };
    },
  });
}
