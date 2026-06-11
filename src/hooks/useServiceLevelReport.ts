import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ServiceLevelRow {
  name: string;
  avgDays: number;       // avg days from created_at → completed_date
  avgTimelogHrs: number; // avg total hours logged per service
  totalDays: number;
  qty: number;
  amount: number;
}

/**
 * Service Level / cycle-time report.
 * For every completed service (status='billed' OR completed_date IS NOT NULL):
 *   • Avg Days     = avg(completed_date - created_at)
 *   • Avg Timelog  = avg(sum(activities.duration_minutes)/60) per service
 *   • Total Days   = sum of per-service days
 *   • Qty          = count of completed service rows
 *   • Amount       = sum(total_amount)
 */
export function useServiceLevelReport() {
  const { profile } = useAuth() as any;
  return useQuery({
    queryKey: ["service-level-report", profile?.company_id],
    enabled: !!profile?.company_id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ServiceLevelRow[]> => {
      const { data: services, error } = await supabase
        .from("services")
        .select(`
          id, name, status, total_amount, fixed_price, created_at, completed_date, billed_at,
          projects!inner(id, company_id)
        `)
        .eq("projects.company_id", profile.company_id)
        .or("status.eq.billed,completed_date.not.is.null");
      if (error) throw error;

      const svcList = services || [];
      const ids = svcList.map((s: any) => s.id);

      // Sum minutes per service in one batched query
      const minutesByService = new Map<string, number>();
      if (ids.length) {
        const chunkSize = 200;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { data: acts } = await supabase
            .from("activities")
            .select("service_id, duration_minutes")
            .in("service_id", chunk);
          (acts || []).forEach((a: any) => {
            if (!a.service_id) return;
            minutesByService.set(
              a.service_id,
              (minutesByService.get(a.service_id) || 0) + (Number(a.duration_minutes) || 0)
            );
          });
        }
      }

      const groups = new Map<string, { days: number; hrs: number; qty: number; amt: number; daysCount: number }>();
      svcList.forEach((s: any) => {
        const end = s.completed_date || s.billed_at;
        const start = s.created_at;
        let days = 0;
        let daysCount = 0;
        if (start && end) {
          days = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
          daysCount = 1;
        }
        const hrs = (minutesByService.get(s.id) || 0) / 60;
        const amt = Number(s.total_amount) || Number(s.fixed_price) || 0;
        const name = (s.name || "Unspecified").trim();

        const g = groups.get(name) || { days: 0, hrs: 0, qty: 0, amt: 0, daysCount: 0 };
        g.days += days;
        g.hrs += hrs;
        g.qty += 1;
        g.amt += amt;
        g.daysCount += daysCount;
        groups.set(name, g);
      });

      return Array.from(groups.entries())
        .map(([name, g]) => ({
          name,
          avgDays: g.daysCount ? g.days / g.daysCount : 0,
          avgTimelogHrs: g.qty ? g.hrs / g.qty : 0,
          totalDays: g.days,
          qty: g.qty,
          amount: g.amt,
        }))
        .sort((a, b) => b.avgDays - a.avgDays);
    },
  });
}
