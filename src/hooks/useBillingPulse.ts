import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type BillingPulseScope = "company" | "self-pm" | "self-biller";

export interface BillingPulseData {
  weekBilled: number;
  weekGoal: number;
  weekPacePct: number; // 100 = on pace
  monthBilled: number;
  monthGoal: number;
  monthPacePct: number;
  daysLeftInMonth: number;
  projectedMonthEnd: number;
  sparkline: { weekLabel: string; billed: number }[]; // last 8 weeks
  inboxCount?: number;
  inboxAmount?: number;
  inboxOldestDays?: number;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun..6 Sat
  const diff = (day + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 7);
  return e;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function daysBetween(a: Date, b: Date) {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
}

export function useBillingPulse(scope: BillingPulseScope = "company") {
  const { profile } = useAuth() as any;
  return useQuery({
    queryKey: ["billing-pulse", scope, profile?.company_id, profile?.id],
    enabled: !!profile?.company_id && !!profile?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<BillingPulseData> => {
      const companyId = profile.company_id as string;
      const now = new Date();
      const eightWeeksAgo = startOfWeek(new Date(now.getTime() - 8 * 7 * 86400000));

      // ----- Goals -----
      // Company override
      const { data: companyRow } = await supabase
        .from("companies")
        .select("weekly_billing_goal_override, monthly_billing_goal_override")
        .eq("id", companyId)
        .maybeSingle();

      const { data: activePms } = await supabase.rpc("get_company_goals" as any);

      const companyMonthly =
        (companyRow as any)?.monthly_billing_goal_override ??
        ((activePms as any[]) || [])
          .filter((p: any) => p.is_active && ["pm", "admin", "manager"].includes(p.role))
          .reduce((s: number, p: any) => s + (Number(p.monthly_goal) || 0), 0);

      const companyWeekly =
        (companyRow as any)?.weekly_billing_goal_override ??
        (companyMonthly ? companyMonthly / 4.33 : 0);

      let monthGoal = companyMonthly;
      let weekGoal = companyWeekly;

      if (scope !== "company") {
        const { data: myGoals } = await supabase.rpc("get_my_goals" as any);
        const me = (myGoals as any[] | null)?.[0] || {};
        const m = Number(me?.monthly_goal) || 0;
        const w = Number(me?.weekly_goal) || (m ? m / 4.33 : 0);
        monthGoal = m;
        weekGoal = w;
      }


      // ----- Invoices -----
      let q = supabase
        .from("invoices")
        .select("id, total_due, created_at, created_by, project_id, projects(assigned_pm_id)")
        .eq("company_id", companyId)
        .gte("created_at", eightWeeksAgo.toISOString());

      if (scope === "self-biller") {
        q = q.eq("created_by", profile.id);
      }
      const { data: invoices } = await q;

      const filteredInvoices = (invoices || []).filter((inv: any) => {
        if (scope === "self-pm") {
          return inv.projects?.assigned_pm_id === profile.id;
        }
        return true;
      });

      // ----- Aggregate week / month / sparkline -----
      const weekStart = startOfWeek(now);
      const weekEnd = endOfWeek(now);
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      let weekBilled = 0;
      let monthBilled = 0;
      const weeks: { start: Date; billed: number }[] = [];
      for (let i = 7; i >= 0; i--) {
        const s = new Date(weekStart);
        s.setDate(s.getDate() - i * 7);
        weeks.push({ start: s, billed: 0 });
      }

      for (const inv of filteredInvoices) {
        const created = new Date(inv.created_at);
        const amt = Number(inv.total_due) || 0;
        if (created >= weekStart && created < weekEnd) weekBilled += amt;
        if (created >= monthStart && created < monthEnd) monthBilled += amt;
        for (const w of weeks) {
          const we = new Date(w.start);
          we.setDate(we.getDate() + 7);
          if (created >= w.start && created < we) {
            w.billed += amt;
            break;
          }
        }
      }

      // pace
      const daysIntoWeek = daysBetween(weekStart, now);
      const expectedWeek = weekGoal ? weekGoal * (daysIntoWeek / 7) : 0;
      const weekPacePct = expectedWeek > 0 ? Math.round((weekBilled / expectedWeek) * 100) : 0;

      const daysIntoMonth = now.getDate();
      const totalDaysInMonth = daysBetween(monthStart, monthEnd);
      const expectedMonth = monthGoal ? monthGoal * (daysIntoMonth / totalDaysInMonth) : 0;
      const monthPacePct = expectedMonth > 0 ? Math.round((monthBilled / expectedMonth) * 100) : 0;
      const daysLeftInMonth = Math.max(0, totalDaysInMonth - daysIntoMonth);
      const projectedMonthEnd = daysIntoMonth > 0 ? Math.round((monthBilled / daysIntoMonth) * totalDaysInMonth) : 0;

      const sparkline = weeks.map((w) => ({
        weekLabel: w.start.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
        billed: Math.round(w.billed),
      }));

      // ----- Inbox (self-biller + company) -----
      let inboxCount: number | undefined;
      let inboxAmount: number | undefined;
      let inboxOldestDays: number | undefined;
      if (scope === "self-biller" || scope === "company") {
        const { data: pending } = await supabase
          .from("billing_requests")
          .select("id, total_amount, created_at")
          .eq("status", "pending");
        if (pending && pending.length > 0) {
          inboxCount = pending.length;
          inboxAmount = pending.reduce((s: number, b: any) => s + (Number(b.total_amount) || 0), 0);
          const oldest = pending.reduce((min: number, b: any) => {
            const days = Math.floor((now.getTime() - new Date(b.created_at).getTime()) / 86400000);
            return days > min ? days : min;
          }, 0);
          inboxOldestDays = oldest;
        } else {
          inboxCount = 0;
          inboxAmount = 0;
          inboxOldestDays = 0;
        }
      }

      return {
        weekBilled,
        weekGoal,
        weekPacePct,
        monthBilled,
        monthGoal,
        monthPacePct,
        daysLeftInMonth,
        projectedMonthEnd,
        sparkline,
        inboxCount,
        inboxAmount,
        inboxOldestDays,
      };
    },
  });
}
