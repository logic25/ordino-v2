import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OpenServiceRow {
  name: string;
  amount: number;
  qty: number;
  avgDays: number;
  serviceIds: string[];
}

/**
 * Aggregate of open (not-yet-billed) services on open projects, grouped by
 * service name. Mirrors the legacy "Total Open Services" report:
 *   • Amount = sum of remaining balance (total_amount - billed_amount)
 *   • Qty    = number of open service rows
 *   • Avg Days = avg(now - services.created_at) in days
 */
export function useOpenServicesSummary() {
  const { profile } = useAuth() as any;
  return useQuery({
    queryKey: ["open-services-summary", profile?.company_id],
    enabled: !!profile?.company_id,
    staleTime: 60_000,
    queryFn: async (): Promise<OpenServiceRow[]> => {
      const { data, error } = await supabase
        .from("services")
        .select(`
          id, name, status, total_amount, billed_amount, fixed_price, created_at,
          projects!inner(id, status, company_id)
        `)
        .eq("projects.company_id", profile.company_id)
        .eq("projects.status", "open")
        .in("status", ["not_started", "in_progress"]);
      if (error) throw error;

      const now = Date.now();
      const groups = new Map<string, { amt: number; qty: number; days: number; ids: string[] }>();
      (data || []).forEach((s: any) => {
        const total = Number(s.total_amount) || Number(s.fixed_price) || 0;
        const billed = Number(s.billed_amount) || 0;
        const remaining = Math.max(0, total - billed);
        const ageDays = s.created_at
          ? Math.max(0, Math.floor((now - new Date(s.created_at).getTime()) / 86400000))
          : 0;
        const name = (s.name || "Unspecified").trim();
        const g = groups.get(name) || { amt: 0, qty: 0, days: 0, ids: [] };
        g.amt += remaining;
        g.qty += 1;
        g.days += ageDays;
        g.ids.push(s.id);
        groups.set(name, g);
      });

      return Array.from(groups.entries())
        .map(([name, g]) => ({
          name,
          amount: g.amt,
          qty: g.qty,
          avgDays: g.qty ? g.days / g.qty : 0,
          serviceIds: g.ids,
        }))
        .sort((a, b) => b.amount - a.amount);
    },
  });
}
