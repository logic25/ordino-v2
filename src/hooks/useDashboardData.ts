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
  month: string;            // YYYY-MM
  label: string;            // e.g. "Jun 2026"
  sent: number;             // total proposals created in month (matches Reports "Sent")
  converted: number;        // won (status = executed) — matches Reports "Won"
  rate: number;             // 0..1
  proposedValue: number;    // Total $ — all proposals' total_amount
  convertedValue: number;   // Won $
  coCount: number;          // change orders signed in month
  convertedCOValue: number; // CO $
}

export function useProposalConversionRates(year: number) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["proposal-conversion-rates", profile?.company_id, year],
    enabled: !!profile?.company_id,
    queryFn: async (): Promise<ProposalConversionRow[]> => {
      const start = `${year}-01-01`;
      const end = `${year + 1}-01-01`;
      const [proposalsRes, cosRes] = await Promise.all([
        supabase
          .from("proposals")
          .select("status, total_amount, created_at")
          .eq("company_id", profile!.company_id!)
          .gte("created_at", start)
          .lt("created_at", end),
        (supabase as any)
          .from("change_orders")
          .select("amount, client_signed_at")
          .eq("company_id", profile!.company_id!)
          .not("client_signed_at", "is", null)
          .gte("client_signed_at", start)
          .lt("client_signed_at", end),
      ]);

      const buckets = new Map<string, ProposalConversionRow>();
      for (let m = 0; m < 12; m++) {
        const key = `${year}-${String(m + 1).padStart(2, "0")}`;
        const label = new Date(year, m, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
        buckets.set(key, { month: key, label, sent: 0, converted: 0, rate: 0, proposedValue: 0, convertedValue: 0, coCount: 0, convertedCOValue: 0 });
      }

      (proposalsRes.data || []).forEach((p: any) => {
        if (!p.created_at) return;
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const row = buckets.get(key);
        if (!row) return;
        const amount = Number(p.total_amount) || 0;
        row.sent += 1;
        row.proposedValue += amount;
        if (p.status === "executed") {
          row.converted += 1;
          row.convertedValue += amount;
        }
      });

      (cosRes.data || []).forEach((co: any) => {
        if (!co.client_signed_at) return;
        const d = new Date(co.client_signed_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const row = buckets.get(key);
        if (!row) return;
        row.coCount += 1;
        row.convertedCOValue += Number(co.amount) || 0;
      });

      const rows = Array.from(buckets.values()).map((r) => ({
        ...r,
        rate: r.sent > 0 ? r.converted / r.sent : 0,
      }));
      return rows.sort((a, b) => a.month.localeCompare(b.month));
    },
  });
}

export interface MonthlyBillingByUserRow {
  userId: string;
  name: string;
  hasGoal: boolean;
  monthlyGoal: number;        // default goal (from profile)
  fee: number[];              // length 12, fee billing per month
  reimbursable: number[];     // length 12, reimbursable billing per month
  total: number;              // YTD fee total
  reimbursableTotal: number;
  requestCount: number;
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

      const [profilesRes, requestsRes, servicesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, first_name, last_name, display_name, role, monthly_goal, is_active")
          .eq("company_id", companyId),
        supabase
          .from("billing_requests")
          .select("id, services, total_amount, created_at, created_by")
          .eq("company_id", companyId)
          .neq("status", "cancelled")
          .gte("created_at", start)
          .lt("created_at", end),
        supabase
          .from("services")
          .select("id, is_reimbursable"),
      ]);

      const profiles = profilesRes.data || [];
      const requests = requestsRes.data || [];
      const reimbursableSet = new Set<string>(
        (servicesRes.data || [])
          .filter((s: any) => s.is_reimbursable)
          .map((s: any) => s.id)
      );

      const byUser = new Map<string, MonthlyBillingByUserRow>();
      const ensure = (uid: string) => {
        if (byUser.has(uid)) return byUser.get(uid)!;
        const p: any = profiles.find((x: any) => x.id === uid);
        const row: MonthlyBillingByUserRow = {
          userId: uid,
          name: p ? nameOf(p) : "Unknown",
          hasGoal: !!(p && Number(p.monthly_goal) > 0),
          monthlyGoal: p ? Number(p.monthly_goal) || 0 : 0,
          fee: Array(12).fill(0),
          reimbursable: Array(12).fill(0),
          total: 0,
          reimbursableTotal: 0,
          requestCount: 0,
        };
        byUser.set(uid, row);
        return row;
      };

      // Always include active goal-holders
      profiles
        .filter((p: any) => p.is_active && Number(p.monthly_goal) > 0)
        .forEach((p: any) => ensure(p.id));

      requests.forEach((req: any) => {
        if (!req.created_by || !req.created_at) return;
        const row = ensure(req.created_by);
        const month = new Date(req.created_at).getMonth();
        const lines: any[] = Array.isArray(req.services) ? req.services : [];
        let feeAmt = 0;
        let reimbAmt = 0;
        if (lines.length === 0) {
          feeAmt = Number(req.total_amount) || 0;
        } else {
          for (const line of lines) {
            const amt = Number(line.billed_amount) || Number(line.amount) || 0;
            const sid = line.service_id || line.serviceId;
            const isReimb = sid ? reimbursableSet.has(sid) : false;
            if (isReimb) reimbAmt += amt;
            else feeAmt += amt;
          }
        }
        row.fee[month] += feeAmt;
        row.reimbursable[month] += reimbAmt;
        row.total += feeAmt;
        row.reimbursableTotal += reimbAmt;
        row.requestCount += 1;
      });

      return Array.from(byUser.values()).sort((a, b) => b.total - a.total);
    },
  });
}

export function useUserMonthlyGoals(year: number) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["user-monthly-goals", profile?.company_id, year],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("user_monthly_goals")
        .select("user_id, year, month, goal_amount")
        .eq("company_id", profile!.company_id!)
        .eq("year", year);
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        map[`${r.user_id}:${r.month}`] = Number(r.goal_amount) || 0;
      });
      return map;
    },
  });
}

export function useUserBacklog() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["user-backlog", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const companyId = profile!.company_id!;
      const { data: projects } = await supabase
        .from("projects")
        .select("id, assigned_pm_id, status")
        .eq("company_id", companyId)
        .eq("status", "open");
      const projectIds = (projects || []).map((p: any) => p.id);
      if (projectIds.length === 0) return {} as Record<string, number>;

      const { data: services } = await supabase
        .from("services")
        .select("project_id, total_amount, fixed_price, billed_amount, is_reimbursable")
        .in("project_id", projectIds);

      const remainingByProject = new Map<string, number>();
      (services || []).forEach((s: any) => {
        if (s.is_reimbursable) return;
        const contract = Number(s.total_amount) || Number(s.fixed_price) || 0;
        const billed = Number(s.billed_amount) || 0;
        const remaining = Math.max(0, contract - billed);
        remainingByProject.set(
          s.project_id,
          (remainingByProject.get(s.project_id) || 0) + remaining
        );
      });

      const byUser: Record<string, number> = {};
      (projects || []).forEach((p: any) => {
        if (!p.assigned_pm_id) return;
        const v = remainingByProject.get(p.id) || 0;
        byUser[p.assigned_pm_id] = (byUser[p.assigned_pm_id] || 0) + v;
      });
      return byUser;
    },
  });
}

// =====================================================================
// Momentum KPI aggregators (dashboard refresh)
// =====================================================================

function monthBounds(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const prevStart = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return { start, end, prevStart };
}

/** Active Projects + delta vs prior month-end count */
export function useActiveProjectsKpi() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["kpi-active-projects", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const companyId = profile!.company_id!;
      const { start } = monthBounds();
      const [{ count: current }, { count: lastMonth }] = await Promise.all([
        supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("status", "open"),
        supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("status", "open")
          .lt("created_at", start.toISOString()),
      ]);
      const value = current ?? 0;
      const prior = lastMonth ?? 0;
      return { value, delta: value - prior };
    },
  });
}

/**
 * Proposals Written momentum: count created this calendar month vs last month,
 * plus dollars currently in flight (sent + signed) as a secondary signal.
 */
export function useActiveProposalsKpi() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["kpi-active-proposals", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const companyId = profile!.company_id!;
      const { start, end, prevStart } = monthBounds();
      const [thisMonth, lastMonth, inFlightRes] = await Promise.all([
        supabase
          .from("proposals")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString()),
        supabase
          .from("proposals")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .gte("created_at", prevStart.toISOString())
          .lt("created_at", start.toISOString()),
        supabase
          .from("proposals")
          .select("total_amount")
          .eq("company_id", companyId)
          .in("status", ["sent", "signed_client"]),
      ]);
      const value = thisMonth.count ?? 0;
      const prior = lastMonth.count ?? 0;
      const inFlight = (inFlightRes.data || []).reduce(
        (s: number, p: any) => s + (Number(p.total_amount) || 0),
        0
      );
      return { value, delta: value - prior, inFlight };
    },
  });
}

/** AR Outstanding split: sent vs overdue (count + $) + MoM delta vs AR at month start */
export function useArOutstandingKpi() {
  return useQuery({
    queryKey: ["kpi-ar-outstanding"],
    queryFn: async () => {
      const { start } = monthBounds();
      const [currentRes, priorRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, status, total_due, payment_amount")
          .in("status", ["sent", "overdue"]),
        // AR snapshot at the start of this month: invoices sent before month start
        // and either still unpaid, or paid after month start.
        supabase
          .from("invoices")
          .select("total_due, payment_amount, sent_at, paid_at")
          .not("sent_at", "is", null)
          .lt("sent_at", start.toISOString())
          .or(`paid_at.is.null,paid_at.gte.${start.toISOString()}`),
      ]);
      let sent = 0, overdue = 0, sentCount = 0, overdueCount = 0;
      (currentRes.data || []).forEach((i: any) => {
        const remaining = Math.max(0, (Number(i.total_due) || 0) - (Number(i.payment_amount) || 0));
        if (i.status === "overdue") { overdue += remaining; overdueCount += 1; }
        else { sent += remaining; sentCount += 1; }
      });
      const priorTotal = (priorRes.data || []).reduce((s: number, i: any) => {
        // If invoice was paid after month start, its remaining at start = total_due.
        // If still unpaid, remaining at start ≈ total_due - payment_amount (best available).
        const paidAfter = i.paid_at && new Date(i.paid_at) >= start;
        const remaining = paidAfter
          ? Number(i.total_due) || 0
          : Math.max(0, (Number(i.total_due) || 0) - (Number(i.payment_amount) || 0));
        return s + remaining;
      }, 0);
      const total = sent + overdue;
      return { sent, overdue, sentCount, overdueCount, total, delta: total - priorTotal };
    },
  });
}

/** Month-to-goal: billed MTD ÷ company monthly goal */
export function useMonthGoalKpi() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["kpi-month-goal", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const companyId = profile!.company_id!;
      const { start, end } = monthBounds();
      const now = new Date();
      // Same-day-of-month cutoff for last month so the comparison is apples-to-apples
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevCutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), now.getHours(), now.getMinutes());

      const [companyRow, pmGoals, brRows, prevBrRows] = await Promise.all([
        supabase
          .from("companies")
          .select("monthly_billing_goal_override")
          .eq("id", companyId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("monthly_goal, role")
          .eq("company_id", companyId)
          .eq("is_active", true),
        supabase
          .from("billing_requests")
          .select("total_amount, created_at, status")
          .eq("company_id", companyId)
          .neq("status", "cancelled")
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString()),
        supabase
          .from("billing_requests")
          .select("total_amount, created_at, status")
          .eq("company_id", companyId)
          .neq("status", "cancelled")
          .gte("created_at", prevStart.toISOString())
          .lte("created_at", prevCutoff.toISOString()),
      ]);

      const monthGoal =
        (companyRow.data as any)?.monthly_billing_goal_override ??
        (pmGoals.data || [])
          .filter((p: any) => ["pm", "admin", "manager"].includes(p.role))
          .reduce((s: number, p: any) => s + (Number(p.monthly_goal) || 0), 0);

      const billed = (brRows.data || []).reduce(
        (s: number, b: any) => s + (Number(b.total_amount) || 0),
        0
      );
      const priorBilled = (prevBrRows.data || []).reduce(
        (s: number, b: any) => s + (Number(b.total_amount) || 0),
        0
      );

      const pct = monthGoal > 0 ? billed / monthGoal : 0;
      const priorPct = monthGoal > 0 ? priorBilled / monthGoal : 0;
      return { billed, monthGoal, pct, deltaPct: pct - priorPct, priorBilled };
    },
  });
}

/** Cycle times (last 90 days): proposal sent→signed avg, invoice issued→paid avg */
export function useCycleTimes() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["cycle-times", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const companyId = profile!.company_id!;

      const [props, invs] = await Promise.all([
        supabase
          .from("proposals")
          .select("sent_at, client_signed_at")
          .eq("company_id", companyId)
          .not("sent_at", "is", null)
          .not("client_signed_at", "is", null)
          .gte("client_signed_at", since),
        supabase
          .from("invoices")
          .select("created_at, paid_at")
          .not("paid_at", "is", null)
          .gte("paid_at", since),
      ]);

      const avg = (xs: number[]) =>
        xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0;

      const propDays = (props.data || [])
        .map((p: any) =>
          (new Date(p.client_signed_at).getTime() - new Date(p.sent_at).getTime()) / 86400000
        )
        .filter((n) => n >= 0 && n < 365);
      const invDays = (invs.data || [])
        .map((i: any) =>
          (new Date(i.paid_at).getTime() - new Date(i.created_at).getTime()) / 86400000
        )
        .filter((n) => n >= 0 && n < 365);

      return {
        proposalSignDays: avg(propDays),
        invoicePaidDays: avg(invDays),
        proposalSample: propDays.length,
        invoiceSample: invDays.length,
      };
    },
  });
}

/** Collected vs Billed (MTD) */
export function useCollectedVsBilledMtd() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["collected-vs-billed-mtd", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const companyId = profile!.company_id!;
      const { start, end } = monthBounds();
      const [brRes, invRes] = await Promise.all([
        supabase
          .from("billing_requests")
          .select("total_amount, created_at, status")
          .eq("company_id", companyId)
          .neq("status", "cancelled")
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString()),
        supabase
          .from("invoices")
          .select("payment_amount, total_due, paid_at")
          .gte("paid_at", start.toISOString())
          .lt("paid_at", end.toISOString()),
      ]);
      const billed = (brRes.data || []).reduce(
        (s: number, b: any) => s + (Number(b.total_amount) || 0),
        0
      );
      const collected = (invRes.data || []).reduce(
        (s: number, i: any) => s + (Number(i.payment_amount) || Number(i.total_due) || 0),
        0
      );
      return { billed, collected };
    },
  });
}

/** Total stale-project count across the company (uses configured threshold) */
export function useStaleProjectsTotal(thresholdDays: number = 14) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["stale-projects-total", profile?.company_id, thresholdDays],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - thresholdDays * 86400000).toISOString();
      const [{ count: stale }, { count: total }] = await Promise.all([
        supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("company_id", profile!.company_id!)
          .eq("status", "open")
          .lt("last_activity_at", cutoff),
        supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("company_id", profile!.company_id!)
          .eq("status", "open"),
      ]);
      return { stale: stale ?? 0, total: total ?? 0 };
    },
  });
}

export interface SalesHealthBucket {
  status: string;
  label: string;
  count: number;
  value: number;
}

export interface SalesHealthWinRow {
  month: string;
  label: string;
  sent: number;
  won: number;
  rate: number;
}

/** Sales Health: active funnel (windowed) + 6-month rolling win rate + avg sign days */
export function useSalesHealth(windowDays: 30 | 60 | 90 | null = 60) {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["sales-health", profile?.company_id, windowDays],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const companyId = profile!.company_id!;
      const since = windowDays
        ? new Date(Date.now() - windowDays * 86400000).toISOString()
        : null;

      let funnelQ = supabase
        .from("proposals")
        .select("status, total_amount, created_at, sent_at, client_signed_at")
        .eq("company_id", companyId);
      if (since) funnelQ = funnelQ.gte("created_at", since);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setDate(1);

      const [funnelRes, historyRes] = await Promise.all([
        funnelQ,
        supabase
          .from("proposals")
          .select("status, sent_at, client_signed_at")
          .eq("company_id", companyId)
          .gte("sent_at", sixMonthsAgo.toISOString()),
      ]);

      const STAGES: { status: string; label: string }[] = [
        { status: "draft", label: "Draft" },
        { status: "sent", label: "Sent" },
        { status: "signed_client", label: "Signed" },
        { status: "executed", label: "Won" },
        { status: "lost", label: "Lost" },
      ];

      const buckets: Record<string, SalesHealthBucket> = {};
      STAGES.forEach((s) => (buckets[s.status] = { ...s, count: 0, value: 0 }));
      (funnelRes.data || []).forEach((p: any) => {
        const b = buckets[p.status];
        if (!b) return;
        b.count += 1;
        b.value += Number(p.total_amount) || 0;
      });

      // 6-month win rate
      const WON = new Set(["signed_client", "executed", "won"]);
      const byMonth = new Map<string, SalesHealthWinRow>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        d.setDate(1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth.set(key, {
          month: key,
          label: d.toLocaleString("en-US", { month: "short" }),
          sent: 0,
          won: 0,
          rate: 0,
        });
      }
      const signDays: number[] = [];
      (historyRes.data || []).forEach((p: any) => {
        if (!p.sent_at) return;
        const d = new Date(p.sent_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const row = byMonth.get(key);
        if (row) {
          row.sent += 1;
          if (WON.has(p.status)) row.won += 1;
        }
        if (p.client_signed_at) {
          const diff = (new Date(p.client_signed_at).getTime() - d.getTime()) / 86400000;
          if (diff >= 0 && diff < 365) signDays.push(diff);
        }
      });
      const winRate = Array.from(byMonth.values()).map((r) => ({
        ...r,
        rate: r.sent > 0 ? r.won / r.sent : 0,
      }));

      const avgSignDays = signDays.length
        ? Math.round((signDays.reduce((a, b) => a + b, 0) / signDays.length) * 10) / 10
        : 0;

      return {
        funnel: STAGES.map((s) => buckets[s.status]),
        winRate,
        avgSignDays,
        signSample: signDays.length,
      };
    },
  });
}

