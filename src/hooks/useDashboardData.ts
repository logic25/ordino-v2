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
        .map((p: any) => ({ id: p.id, name: nameOf(p), projects: counts[p.id] || 0 }))
        .sort((a, b) => b.projects - a.projects);
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
