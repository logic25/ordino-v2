import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchAllRows } from "@/lib/fetchAllRows";

export interface ClientHealthRow {
  client_id: string;
  company_id: string | null;
  client_name: string | null;
  client_type: string | null;
  expected_annual_value: number | null;
  first_proposal_date: string | null;
  last_activity_date: string | null;
  active_project_count: number;
  proposals_sent_total: number;
  proposals_missing_sent_at: number;
  converted_total: number;
  ytd_proposed_value: number;
  ytd_sent_count: number;
  ytd_converted_count: number;
  ytd_conversion_rate: number | null;
  lifetime_billed_value: number | null;
  payment_reliability_score: number | null;
  avg_days_to_payment: number | null;
  owner_ids: string[] | null;
  lead_sources: string[] | null;
  any_owner_inferred: boolean;
  has_incomplete_data: boolean;
  days_since_last_activity: number | null;
  is_dormant: boolean | null;
  is_concentrated: boolean | null;
  concentration_badge_enabled: boolean;
}

/** Read-only Client Health view. RLS-scoped via security_invoker. */
export function useClientHealth() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["client-health", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async (): Promise<ClientHealthRow[]> => {
      return fetchAllRows<ClientHealthRow>((from, to) =>
        supabase.from("client_health").select("*").order("ytd_proposed_value", { ascending: false }).range(from, to) as any
      );
    },
  });
}

export interface ClientHealthDataQuality {
  totalProposals: number;
  withSentAt: number;
  missingSentAt: number;
  withSalesPerson: number;
  fillRatePct: number | null;
  missingConvertedAt: number;
}

/** Data-quality strip: how well-populated the fields this report depends on are. */
export function useClientHealthDataQuality() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["client-health-data-quality", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async (): Promise<ClientHealthDataQuality> => {
      const rows = await fetchAllRows<any>((from, to) =>
        supabase.from("proposals").select("id, sent_at, converted_at, sales_person_id").order("id").range(from, to)
      );
      const withSentAt = rows.filter((r: any) => r.sent_at).length;
      const withSalesPerson = rows.filter((r: any) => r.sales_person_id).length;
      return {
        totalProposals: rows.length,
        withSentAt,
        missingSentAt: rows.length - withSentAt,
        withSalesPerson,
        fillRatePct: rows.length ? Math.round((withSalesPerson / rows.length) * 1000) / 10 : null,
        missingConvertedAt: rows.filter((r: any) => !r.converted_at).length,
      };
    },
  });
}

/** Owner + lead source options for the filter bar, derived from proposals. */
export function useClientHealthFilterOptions() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["client-health-filter-options", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const [proposals, profiles] = await Promise.all([
        fetchAllRows<any>((from, to) => supabase.from("proposals").select("sales_person_id, created_by, lead_source").order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("profiles").select("id, display_name").order("id").range(from, to)),
      ]);
      const nameById = new Map(profiles.map((p: any) => [p.id, p.display_name || "Unknown"]));
      const ownerIds = new Set<string>();
      const sources = new Set<string>();
      proposals.forEach((p: any) => {
        const owner = p.sales_person_id || p.created_by;
        if (owner) ownerIds.add(owner);
        if (p.lead_source) sources.add(p.lead_source);
      });
      return {
        owners: Array.from(ownerIds)
          .map((id) => ({ id, name: nameById.get(id) || "Unknown" }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        leadSources: Array.from(sources).sort(),
        nameById,
      };
    },
  });
}
