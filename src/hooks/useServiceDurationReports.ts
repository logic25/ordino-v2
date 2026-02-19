import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { differenceInDays, startOfMonth, subMonths, format } from "date-fns";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const frac = idx - lower;
  return sorted[lower] + frac * ((sorted[lower + 1] ?? sorted[lower]) - sorted[lower]);
}

export interface ServiceTypeStats {
  name: string;
  count: number;
  median: number;
  avg: number;
  p75: number;
  p90: number;
  min: number;
  max: number;
  lowSample: boolean;
}

export interface ServiceTrendPoint {
  month: string;
  median: number;
  count: number;
}

export interface PMServiceStats {
  pmName: string;
  pmId: string;
  serviceType: string;
  median: number;
  count: number;
  aboveCompanyMedian: boolean;
}

export interface AtRiskService {
  serviceId: string;
  serviceName: string;
  projectId: string;
  daysOpen: number;
  p75Threshold: number;
}

export function useServiceDurationReports() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["service-duration-reports", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: services } = await supabase
        .from("services")
        .select("id, name, status, created_at, completed_date, project_id");

      const { data: projects } = await supabase
        .from("projects")
        .select("id, assigned_pm_id");

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name");

      const allServices = services || [];
      const projectMap = new Map((projects || []).map((p: any) => [p.id, p]));
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const completedStatuses = ["complete", "billed", "paid"];
      const completed = allServices.filter(
        (s: any) => completedStatuses.includes(s.status) && s.completed_date && s.created_at
      );
      const inProgress = allServices.filter((s: any) => s.status === "in_progress");

      // Group by service type
      const byType: Record<string, number[]> = {};
      const byTypeWithMeta: Record<string, { duration: number; projectId: string; completedDate: string }[]> = {};

      completed.forEach((s: any) => {
        const days = differenceInDays(new Date(s.completed_date), new Date(s.created_at));
        if (days < 0) return;
        const name = s.name || "Unknown";
        if (!byType[name]) byType[name] = [];
        if (!byTypeWithMeta[name]) byTypeWithMeta[name] = [];
        byType[name].push(days);
        byTypeWithMeta[name].push({ duration: days, projectId: s.project_id, completedDate: s.completed_date });
      });

      // 1. Summary stats per service type
      const summaryStats: ServiceTypeStats[] = Object.entries(byType)
        .map(([name, durations]) => {
          const sorted = [...durations].sort((a, b) => a - b);
          const avg = Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 10) / 10;
          return {
            name,
            count: sorted.length,
            median: Math.round(percentile(sorted, 50) * 10) / 10,
            avg,
            p75: Math.round(percentile(sorted, 75) * 10) / 10,
            p90: Math.round(percentile(sorted, 90) * 10) / 10,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            lowSample: sorted.length < 3,
          };
        })
        .sort((a, b) => b.count - a.count);

      // 2. Monthly trend data (last 12 months)
      const now = new Date();
      const serviceTypes = Object.keys(byType);
      const trendData: Record<string, ServiceTrendPoint[]> = {};

      serviceTypes.forEach((type) => {
        const points: ServiceTrendPoint[] = [];
        for (let i = 11; i >= 0; i--) {
          const monthStart = startOfMonth(subMonths(now, i));
          const label = format(monthStart, "MMM yy");
          const items = byTypeWithMeta[type].filter(
            (s) => format(startOfMonth(new Date(s.completedDate)), "MMM yy") === label
          );
          if (items.length > 0) {
            const sorted = items.map((s) => s.duration).sort((a, b) => a - b);
            points.push({ month: label, median: Math.round(percentile(sorted, 50) * 10) / 10, count: items.length });
          } else {
            points.push({ month: label, median: 0, count: 0 });
          }
        }
        trendData[type] = points;
      });

      // 3. PM comparison
      const pmStats: PMServiceStats[] = [];
      const companyMedians = new Map(summaryStats.map((s) => [s.name, s.median]));

      // Group by PM + service type
      const pmGroups: Record<string, Record<string, number[]>> = {};
      completed.forEach((s: any) => {
        const proj = projectMap.get(s.project_id);
        const pmId = proj?.assigned_pm_id;
        if (!pmId) return;
        const days = differenceInDays(new Date(s.completed_date), new Date(s.created_at));
        if (days < 0) return;
        const name = s.name || "Unknown";
        if (!pmGroups[pmId]) pmGroups[pmId] = {};
        if (!pmGroups[pmId][name]) pmGroups[pmId][name] = [];
        pmGroups[pmId][name].push(days);
      });

      Object.entries(pmGroups).forEach(([pmId, serviceMap]) => {
        const profile = profileMap.get(pmId);
        const pmName = profile?.display_name || "Unknown";
        Object.entries(serviceMap).forEach(([serviceType, durations]) => {
          const sorted = [...durations].sort((a, b) => a - b);
          const median = Math.round(percentile(sorted, 50) * 10) / 10;
          const compMedian = companyMedians.get(serviceType) || 0;
          pmStats.push({
            pmId,
            pmName,
            serviceType,
            median,
            count: sorted.length,
            aboveCompanyMedian: median > compMedian * 1.25,
          });
        });
      });

      // 4. Active services at risk
      const p75Map = new Map(summaryStats.map((s) => [s.name, s.p75]));
      const atRisk: AtRiskService[] = inProgress
        .map((s: any) => {
          const daysOpen = differenceInDays(now, new Date(s.created_at));
          const threshold = p75Map.get(s.name || "Unknown") || 0;
          return {
            serviceId: s.id,
            serviceName: s.name || "Unknown",
            projectId: s.project_id,
            daysOpen,
            p75Threshold: threshold,
          };
        })
        .filter((s) => s.p75Threshold > 0 && s.daysOpen > s.p75Threshold)
        .sort((a, b) => b.daysOpen - a.daysOpen)
        .slice(0, 20);

      return { summaryStats, trendData, serviceTypes, pmStats, atRisk };
    },
  });
}
