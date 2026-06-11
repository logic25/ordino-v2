import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface BillingPipelineRow {
  id: string;
  service_name: string;
  service_status: string;
  estimated_bill_date: string | null;
  bill_date_source: string | null;
  amount: number;
  project_id: string;
  project_number: string | null;
  project_name: string | null;
  pm_id: string | null;
  pm_name: string | null;
  client_name: string | null;
}

export type PipelineScope = "company" | "self-pm";

export function useBillingPipeline(scope: PipelineScope = "company") {
  const { profile } = useAuth() as any;
  return useQuery({
    queryKey: ["billing-pipeline", scope, profile?.company_id, profile?.id],
    enabled: !!profile?.company_id,
    staleTime: 60_000,
    queryFn: async (): Promise<BillingPipelineRow[]> => {
      const companyId = profile.company_id as string;

      // "Upcoming billing" = deliverables marked `billed` (ready-to-invoice)
      // with remaining balance and no open billing request yet.
      const q = supabase
        .from("services")
        .select(`
          id, name, status, estimated_bill_date, bill_date_source,
          total_amount, billed_amount, fixed_price,
          project_id,
          projects!inner(id, project_number, name, assigned_pm_id, company_id,
            clients(name),
            assigned_pm:profiles!projects_assigned_pm_id_fkey(id, first_name, last_name, display_name)
          )
        `)
        .eq("projects.company_id", companyId)
        .eq("status", "billed");

      const [{ data, error }, openBR] = await Promise.all([
        q,
        supabase
          .from("billing_requests")
          .select("services")
          .eq("company_id", companyId)
          .in("status", ["pending", "approved"]),
      ]);
      if (error) throw error;

      // Build set of service ids already attached to an open billing request
      const tiedUp = new Set<string>();
      (openBR.data || []).forEach((br: any) => {
        const list = Array.isArray(br.services) ? br.services : [];
        list.forEach((entry: any) => {
          const id = typeof entry === "string" ? entry : entry?.id || entry?.service_id;
          if (id) tiedUp.add(id);
        });
      });

      const rows: BillingPipelineRow[] = (data || [])
        .map((s: any): BillingPipelineRow => {
          const total = Number(s.total_amount) || Number(s.fixed_price) || 0;
          const billed = Number(s.billed_amount) || 0;
          const remaining = Math.max(0, total - billed);
          const pmRel = s.projects?.assigned_pm;
          const pmName =
            pmRel
              ? `${pmRel.first_name || ""} ${pmRel.last_name || ""}`.trim() ||
                pmRel.display_name ||
                "Unassigned"
              : "Unassigned";
          return {
            id: s.id,
            service_name: s.name,
            service_status: s.status,
            estimated_bill_date: s.estimated_bill_date,
            bill_date_source: s.bill_date_source,
            amount: remaining || total,
            project_id: s.project_id,
            project_number: s.projects?.project_number ?? null,
            project_name: s.projects?.name ?? null,
            pm_id: s.projects?.assigned_pm_id ?? null,
            pm_name: pmName,
            client_name: s.projects?.clients?.name ?? null,
          };
        })
        .filter((r) => r.amount > 0);

      if (scope === "self-pm") {
        return rows.filter((r) => r.pm_id === profile.id);
      }
      return rows;
    },
  });
}
