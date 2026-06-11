import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

async function fetchActiveTeam(companyId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, display_name, role")
    .eq("company_id", companyId)
    .eq("is_active", true);
  return data || [];
}

function nameOf(p: any) {
  return (
    `${p.first_name || ""} ${p.last_name || ""}`.trim() ||
    p.display_name ||
    "Unknown"
  );
}

const PM_ROLES = new Set(["admin", "pm", "senior_pm"]);

export function useProjectsByPM() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["projects-by-pm", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const companyId = profile!.company_id!;
      const team = await fetchActiveTeam(companyId);

      const { data: projects } = await supabase
        .from("projects")
        .select("id, assigned_pm_id")
        .eq("company_id", companyId)
        .eq("status", "open");

      const counts: Record<string, number> = {};
      (projects || []).forEach((p: any) => {
        if (p.assigned_pm_id) counts[p.assigned_pm_id] = (counts[p.assigned_pm_id] || 0) + 1;
      });

      return team
        .filter((p: any) => PM_ROLES.has(p.role) || (counts[p.id] || 0) > 0)
        .map((p: any) => ({ id: p.id, name: nameOf(p), projects: counts[p.id] || 0 }))
        .filter((row) => row.projects > 0)
        .sort((a, b) => b.projects - a.projects);
    },
  });
}

export interface StaleProjectsByPMRow {
  id: string;
  name: string;
  fresh: number;     // 0-7 days
  warming: number;   // 8 to threshold-1
  stale: number;     // >= threshold
  total: number;
}

export function useStaleProjectsByPM(thresholdDays: number = 14) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["stale-projects-by-pm", profile?.company_id, thresholdDays],
    enabled: !!profile?.company_id,
    queryFn: async (): Promise<StaleProjectsByPMRow[]> => {
      const companyId = profile!.company_id!;
      const team = await fetchActiveTeam(companyId);

      const { data: projects } = await supabase
        .from("projects")
        .select("id, assigned_pm_id, last_activity_at, status")
        .eq("company_id", companyId)
        .eq("status", "open");

      const byPm = new Map<string, StaleProjectsByPMRow>();
      team
        .filter((p: any) => PM_ROLES.has(p.role))
        .forEach((p: any) =>
          byPm.set(p.id, { id: p.id, name: nameOf(p), fresh: 0, warming: 0, stale: 0, total: 0 })
        );

      const now = Date.now();
      (projects || []).forEach((p: any) => {
        if (!p.assigned_pm_id) return;
        let row = byPm.get(p.assigned_pm_id);
        if (!row) {
          const t = team.find((m: any) => m.id === p.assigned_pm_id);
          row = { id: p.assigned_pm_id, name: t ? nameOf(t) : "Unknown", fresh: 0, warming: 0, stale: 0, total: 0 };
          byPm.set(p.assigned_pm_id, row);
        }
        const days = p.last_activity_at
          ? Math.floor((now - new Date(p.last_activity_at).getTime()) / 86400000)
          : 9999;
        if (days >= thresholdDays) row.stale += 1;
        else if (days >= 8) row.warming += 1;
        else row.fresh += 1;
        row.total += 1;
      });

      return Array.from(byPm.values())
        .filter((r) => r.total > 0)
        .sort((a, b) => b.stale - a.stale || b.total - a.total);
    },
  });
}

export function useCompanyDashboardSettings() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["company-dashboard-settings", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("settings")
        .eq("id", profile!.company_id!)
        .single();
      const settings = (data?.settings as Record<string, any>) || {};
      return {
        staleProjectDays: Number(settings.stale_project_days) || 14,
      };
    },
  });
}

export function useUserBillingGoals() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["user-billing-goals", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, monthly_goal")
        .eq("company_id", profile!.company_id!)
        .eq("is_active", true);
      const map: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = Number(p.monthly_goal) || 0;
      });
      return map;
    },
  });
}

export interface RecentProposalEvent {
  id: string;
  title: string | null;
  clientName: string | null;
  amount: number;
  status: string;
  eventDate: string;   // ISO
  eventType: "sent" | "signed" | "executed";
}

export function useRecentProposalActivity(year: number) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["recent-proposal-activity", profile?.company_id, year],
    enabled: !!profile?.company_id,
    queryFn: async (): Promise<RecentProposalEvent[]> => {
      const start = `${year}-01-01`;
      const end = `${year + 1}-01-01`;
      const { data } = await supabase
        .from("proposals")
        .select("id, title, status, total_amount, sent_at, client_signed_at, converted_at, clients(name)")
        .eq("company_id", profile!.company_id!)
        .or(
          `and(sent_at.gte.${start},sent_at.lt.${end}),` +
          `and(client_signed_at.gte.${start},client_signed_at.lt.${end}),` +
          `and(converted_at.gte.${start},converted_at.lt.${end})`
        );

      const events: RecentProposalEvent[] = [];
      (data || []).forEach((p: any) => {
        const base = {
          id: p.id,
          title: p.title,
          clientName: p.clients?.name ?? null,
          amount: Number(p.total_amount) || 0,
          status: p.status,
        };
        if (p.converted_at && p.converted_at >= start && p.converted_at < end) {
          events.push({ ...base, eventDate: p.converted_at, eventType: "executed" });
        } else if (p.client_signed_at && p.client_signed_at >= start && p.client_signed_at < end) {
          events.push({ ...base, eventDate: p.client_signed_at, eventType: "signed" });
        } else if (p.sent_at && p.sent_at >= start && p.sent_at < end) {
          events.push({ ...base, eventDate: p.sent_at, eventType: "sent" });
        }
      });

      return events
        .sort((a, b) => (a.eventDate < b.eventDate ? 1 : -1))
        .slice(0, 25);
    },
  });
}



export function useTeamUtilization() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["team-utilization-dashboard", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const companyId = profile!.company_id!;
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

      const team = await fetchActiveTeam(companyId);

      const { data: activities } = await supabase
        .from("activities")
        .select("user_id, duration_minutes, billable")
        .gte("activity_date", weekAgo)
        .lte("activity_date", today);

      const { data: projects } = await supabase
        .from("projects")
        .select("id, assigned_pm_id")
        .eq("company_id", companyId)
        .eq("status", "open");

      const projectCount: Record<string, number> = {};
      (projects || []).forEach((p: any) => {
        if (p.assigned_pm_id) projectCount[p.assigned_pm_id] = (projectCount[p.assigned_pm_id] || 0) + 1;
      });

      const byUser: Record<string, { name: string; billable: number; nonBillable: number; projects: number }> = {};
      team.forEach((p: any) => {
        byUser[p.id] = { name: nameOf(p), billable: 0, nonBillable: 0, projects: projectCount[p.id] || 0 };
      });

      (activities || []).forEach((a: any) => {
        if (!a.user_id || !byUser[a.user_id]) return;
        const mins = a.duration_minutes || 0;
        if (a.billable) byUser[a.user_id].billable += mins;
        else byUser[a.user_id].nonBillable += mins;
      });

      return Object.entries(byUser)
        .map(([id, d]) => ({
          id,
          name: d.name,
          billableHours: Math.round((d.billable / 60) * 10) / 10,
          totalHours: Math.round(((d.billable + d.nonBillable) / 60) * 10) / 10,
          projects: d.projects,
          rate: d.billable + d.nonBillable > 0
            ? Math.round((d.billable / (d.billable + d.nonBillable)) * 100)
            : 0,
        }))
        .sort((a, b) => b.totalHours - a.totalHours);
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
          .select("id, status, total_amount, created_by, project_id, projects(name, project_number, properties(address)), created_by_profile:profiles!billing_requests_created_by_fkey(first_name, last_name), expenses:project_expenses!project_expenses_billing_request_id_fkey(id, description, vendor)")
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

export interface ProposalsPipelineStage {
  status: string;
  label: string;
  count: number;
  value: number;
}

const PIPELINE_STAGES: { status: string; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "sent", label: "Sent" },
  { status: "signed_client", label: "Signed" },
  { status: "executed", label: "Won" },
  { status: "lost", label: "Lost" },
];

export function useProposalsPipeline() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["proposals-pipeline", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async (): Promise<ProposalsPipelineStage[]> => {
      const { data } = await supabase
        .from("proposals")
        .select("status, total_amount")
        .eq("company_id", profile!.company_id!);

      const buckets: Record<string, { count: number; value: number }> = {};
      PIPELINE_STAGES.forEach((s) => (buckets[s.status] = { count: 0, value: 0 }));

      (data || []).forEach((p: any) => {
        const key = p.status;
        if (!buckets[key]) return;
        buckets[key].count += 1;
        buckets[key].value += Number(p.total_amount) || 0;
      });

      return PIPELINE_STAGES.map((s) => ({
        status: s.status,
        label: s.label,
        count: buckets[s.status].count,
        value: buckets[s.status].value,
      }));
    },
  });
}

export interface ProposalConversionRow {
  month: string;        // YYYY-MM
  label: string;        // e.g. "Jun 2026"
  sent: number;
  converted: number;
  rate: number;         // 0..1
  proposedValue: number;
  convertedValue: number;
}

const WON_STATUSES = new Set(["signed_client", "executed", "won"]);
const SENT_STATUSES = new Set(["sent", "signed_client", "executed", "won", "lost"]);

export function useProposalConversionRates(year: number) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["proposal-conversion-rates", profile?.company_id, year],
    enabled: !!profile?.company_id,
    queryFn: async (): Promise<ProposalConversionRow[]> => {
      const start = `${year}-01-01`;
      const end = `${year + 1}-01-01`;
      const { data } = await supabase
        .from("proposals")
        .select("status, total_amount, sent_at, created_at")
        .eq("company_id", profile!.company_id!)
        .gte("sent_at", start)
        .lt("sent_at", end);

      const buckets = new Map<string, ProposalConversionRow>();
      for (let m = 0; m < 12; m++) {
        const key = `${year}-${String(m + 1).padStart(2, "0")}`;
        const label = new Date(year, m, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
        buckets.set(key, { month: key, label, sent: 0, converted: 0, rate: 0, proposedValue: 0, convertedValue: 0 });
      }

      (data || []).forEach((p: any) => {
        if (!p.sent_at) return;
        if (!SENT_STATUSES.has(p.status)) return;
        const d = new Date(p.sent_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const row = buckets.get(key);
        if (!row) return;
        const amount = Number(p.total_amount) || 0;
        row.sent += 1;
        row.proposedValue += amount;
        if (WON_STATUSES.has(p.status)) {
          row.converted += 1;
          row.convertedValue += amount;
        }
      });

      const rows = Array.from(buckets.values()).map((r) => ({
        ...r,
        rate: r.sent > 0 ? r.converted / r.sent : 0,
      }));
      // Chronological: Jan first
      return rows.sort((a, b) => a.month.localeCompare(b.month));
    },
  });
}

export interface MonthlyBillingByUserRow {
  userId: string;
  name: string;
  months: number[];   // length 12, index 0 = Jan
  total: number;
  invoiceCount: number;
}

export function useMonthlyBillingByUser(year: number) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["monthly-billing-by-user", profile?.company_id, year],
    enabled: !!profile?.company_id,
    queryFn: async (): Promise<MonthlyBillingByUserRow[]> => {
      const companyId = profile!.company_id!;
      const start = `${year}-01-01`;
      const end = `${year + 1}-01-01`;

      const team = await fetchActiveTeam(companyId);

      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, total_due, created_at, created_by, company_id")
        .eq("company_id", companyId)
        .gte("created_at", start)
        .lt("created_at", end);

      const byUser = new Map<string, MonthlyBillingByUserRow>();
      const ensure = (id: string, name: string) => {
        if (!byUser.has(id)) {
          byUser.set(id, { userId: id, name, months: Array(12).fill(0), total: 0, invoiceCount: 0 });
        }
        return byUser.get(id)!;
      };
      team.forEach((p: any) => ensure(p.id, nameOf(p)));

      (invoices || []).forEach((inv: any) => {
        if (!inv.created_at) return;
        const uid = inv.created_by || "unassigned";
        const teamMember = team.find((t: any) => t.id === uid);
        const name = uid === "unassigned"
          ? "Unassigned"
          : (teamMember ? nameOf(teamMember) : "Other");
        const row = ensure(uid, name);
        const d = new Date(inv.created_at);
        const m = d.getMonth();
        const amt = Number(inv.total_due) || 0;
        row.months[m] += amt;
        row.total += amt;
        row.invoiceCount += 1;
      });

      return Array.from(byUser.values())
        .sort((a, b) => b.total - a.total);
    },
  });
}

