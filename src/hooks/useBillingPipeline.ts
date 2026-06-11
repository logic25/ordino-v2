import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type BillDateSource =
  | "service"
  | "ai"
  | "manual"
  | "project_target"
  | "project_completion"
  | "none";

export interface BillingPipelineRow {
  id: string;
  service_name: string;
  service_status: string;
  estimated_bill_date: string | null;
  bill_date_source: BillDateSource;
  bill_date_reasoning: string | null;
  amount: number;
  project_id: string;
  project_number: string | null;
  project_name: string | null;
  pm_id: string | null;
  pm_name: string | null;
  client_name: string | null;
}

export type PipelineScope = "company" | "self-pm";

/**
 * Upcoming Billing Pipeline:
 * Services on OPEN projects in the "upcoming" lifecycle (not_started or in_progress)
 * with a remaining balance, not yet attached to a pending/approved billing request.
 *
 * Date precedence (effective bill date):
 *   1. services.estimated_bill_date  (source kept as 'ai' | 'manual')
 *   2. projects.estimated_construction_completion  ('project_target')
 *   3. projects.completion_date                   ('project_completion')
 *   4. none → sorted last, rendered as "Undated"
 *
 * 'billed' status is excluded — once a service is fully billed it's no longer upcoming.
 */
export function useBillingPipeline(scope: PipelineScope = "company") {
  const { profile } = useAuth() as any;
  return useQuery({
    queryKey: ["billing-pipeline", scope, profile?.company_id, profile?.id],
    enabled: !!profile?.company_id,
    staleTime: 60_000,
    queryFn: async (): Promise<BillingPipelineRow[]> => {
      const companyId = profile.company_id as string;

      const q = supabase
        .from("services")
        .select(`
          id, name, status, estimated_bill_date, bill_date_source,
          total_amount, billed_amount, fixed_price, is_reimbursable,
          project_id,
          projects!inner(id, project_number, name, assigned_pm_id, company_id, status,
            estimated_construction_completion, completion_date,
            clients!projects_client_id_fkey(name),
            assigned_pm:profiles!projects_assigned_pm_id_fkey(id, first_name, last_name, display_name)
          )
        `)
        .eq("projects.company_id", companyId)
        .eq("projects.status", "open")
        .in("status", ["not_started", "in_progress"]);

      const [{ data, error }, openBR] = await Promise.all([
        q,
        supabase
          .from("billing_requests")
          .select("services")
          .eq("company_id", companyId)
          .in("status", ["pending", "approved"]),
      ]);
      if (error) throw error;

      // Service ids already in an open billing request
      const tiedUp = new Set<string>();
      (openBR.data || []).forEach((br: any) => {
        const list = Array.isArray(br.services) ? br.services : [];
        list.forEach((entry: any) => {
          const id = typeof entry === "string" ? entry : entry?.id || entry?.service_id;
          if (id) tiedUp.add(id);
        });
      });

      // Group services by project so we can ask the AI predictor for
      // missing bill dates in batches (one call per project).
      const byProject = new Map<string, any[]>();
      (data || []).forEach((s: any) => {
        if (!byProject.has(s.project_id)) byProject.set(s.project_id, []);
        byProject.get(s.project_id)!.push(s);
      });

      // Pre-compute AI predictions for any service missing an estimated bill date.
      // This is best-effort: if it fails, we still fall back to project dates.
      const aiByServiceId = new Map<string, string>(); // serviceId -> predicted yyyy-MM-dd
      try {
        const predictionTasks = Array.from(byProject.entries()).map(async ([pid, svcs]) => {
          const input = svcs.map((s: any) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            estimatedBillDate: s.estimated_bill_date,
          }));
          const preds = await predictBillDates(pid, companyId, input);
          preds.forEach((p) => aiByServiceId.set(p.serviceId, p.predictedDate));
          // Cache predictions back to the row so the AI doesn't run again next time
          if (preds.length > 0) applyBillDatePredictions(preds).catch(() => {});
        });
        await Promise.all(predictionTasks);
      } catch {
        // swallow — we'll just fall back to project dates
      }

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

          // Date precedence
          let date: string | null = s.estimated_bill_date || null;
          let source: BillDateSource;
          if (date) {
            source = (s.bill_date_source as BillDateSource) || "manual";
            if (source !== "ai" && source !== "manual") source = "manual";
          } else if (aiByServiceId.has(s.id)) {
            date = aiByServiceId.get(s.id)!;
            source = "ai";
          } else if (s.projects?.estimated_construction_completion) {
            date = s.projects.estimated_construction_completion;
            source = "project_target";
          } else if (s.projects?.completion_date) {
            date = s.projects.completion_date;
            source = "project_completion";
          } else {
            source = "none";
          }

          return {
            id: s.id,
            service_name: s.name,
            service_status: s.status,
            estimated_bill_date: date,
            bill_date_source: source,
            amount: remaining || total,
            project_id: s.project_id,
            project_number: s.projects?.project_number ?? null,
            project_name: s.projects?.name ?? null,
            pm_id: s.projects?.assigned_pm_id ?? null,
            pm_name: pmName,
            client_name: s.projects?.clients?.name ?? null,
          };
        })
        .filter((r) => r.amount > 0 && !tiedUp.has(r.id))
        .sort((a, b) => {
          const da = a.estimated_bill_date || "9999-12-31";
          const db = b.estimated_bill_date || "9999-12-31";
          return da.localeCompare(db);
        });

      if (scope === "self-pm") {
        return rows.filter((r) => r.pm_id === profile.id);
      }
      return rows;
    },
  });
}
