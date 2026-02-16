import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SignalViolation {
  id: string;
  property_id: string;
  company_id: string;
  agency: string;
  violation_number: string;
  violation_type: string | null;
  description: string;
  issued_date: string;
  status: string;
  penalty_amount: number | null;
  raw_data: any;
  created_at: string;
}

export interface ViolationSummary {
  agency: string;
  total: number;
  open: number;
  resolved: number;
  totalPenalty: number;
}

export function useSignalViolations(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["signal-violations", propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from("signal_violations")
        .select("*")
        .eq("property_id", propertyId)
        .order("issued_date", { ascending: false });

      if (error) throw error;
      return data as SignalViolation[];
    },
    enabled: !!propertyId,
  });
}

export function useSignalViolationCounts() {
  return useQuery({
    queryKey: ["signal-violation-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signal_violations")
        .select("property_id, agency, status, penalty_amount");

      if (error) throw error;

      // Group by property_id
      const byProperty: Record<string, { open: number; total: number }> = {};
      for (const v of (data || [])) {
        if (!byProperty[v.property_id]) {
          byProperty[v.property_id] = { open: 0, total: 0 };
        }
        byProperty[v.property_id].total++;
        if (v.status === "open") byProperty[v.property_id].open++;
      }
      return byProperty;
    },
  });
}

export function summarizeViolations(violations: SignalViolation[]): ViolationSummary[] {
  const map: Record<string, ViolationSummary> = {};
  for (const v of violations) {
    if (!map[v.agency]) {
      map[v.agency] = { agency: v.agency, total: 0, open: 0, resolved: 0, totalPenalty: 0 };
    }
    map[v.agency].total++;
    if (v.status === "open") map[v.agency].open++;
    if (v.status === "resolved") map[v.agency].resolved++;
    map[v.agency].totalPenalty += v.penalty_amount || 0;
  }
  return Object.values(map).sort((a, b) => b.open - a.open);
}
