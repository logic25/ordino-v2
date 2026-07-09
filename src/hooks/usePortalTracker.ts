import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TrackerStatus =
  | "not_filed" | "filed" | "in_review" | "objections"
  | "approved" | "permit_issued";

export interface TrackerRow {
  service_id: string;
  project_id: string;
  project_name: string | null;
  project_number: string | null;
  address: string | null;
  tenant: string | null;
  service_name: string;
  disciplines: string[];
  filing_type: "new_job" | "paa";
  parent_service_id: string | null;
  app_number: string | null;
  contractor: string | null;
  sia: string | null;
  status: TrackerStatus;
  status_updated_at: string | null;
  signed: boolean;
  callout: string | null;
  filed_at: string | null;
  approved_at: string | null;
  permit_issued_at: string | null;
  objections_received_at: string | null;
}

function deriveStatus(s: {
  filed_at: string | null;
  objections_received_at: string | null;
  approved_at: string | null;
  permit_issued_at: string | null;
}): { status: TrackerStatus; updated_at: string | null } {
  if (s.permit_issued_at) return { status: "permit_issued", updated_at: s.permit_issued_at };
  if (s.approved_at) return { status: "approved", updated_at: s.approved_at };
  if (s.objections_received_at) return { status: "objections", updated_at: s.objections_received_at };
  if (s.filed_at) return { status: "filed", updated_at: s.filed_at };
  return { status: "not_filed", updated_at: null };
}

export const STATUS_LABEL: Record<TrackerStatus, string> = {
  not_filed: "Not filed",
  filed: "Filed",
  in_review: "In Review",
  objections: "Objections",
  approved: "Approved",
  permit_issued: "Permit Issued",
};

export const STATUS_TONE: Record<TrackerStatus, string> = {
  not_filed: "bg-slate-100 text-slate-700 ring-slate-200",
  filed: "bg-sky-50 text-sky-800 ring-sky-200",
  in_review: "bg-sky-50 text-sky-800 ring-sky-200",
  objections: "bg-amber-50 text-amber-800 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  permit_issued: "bg-emerald-100 text-emerald-900 ring-emerald-300",
};

async function resolveScope(userId: string) {
  const { data: mems } = await supabase
    .from("client_org_memberships").select("client_org_id").eq("user_id", userId);
  const orgIds = Array.from(new Set((mems ?? []).map((m: any) => m.client_org_id).filter(Boolean)));
  if (orgIds.length === 0) return { isInternal: true, orgIds: [], clientIds: [] };
  const { data: orgs } = await supabase.from("client_orgs").select("id, client_id").in("id", orgIds);
  const clientIds = Array.from(new Set((orgs ?? []).map((o: any) => o.client_id).filter(Boolean)));
  return { isInternal: false, orgIds, clientIds };
}

export function usePortalTrackerRows(clientOrgId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["portal", "tracker", user?.id, clientOrgId ?? "all"],
    enabled: !!user,
    queryFn: async (): Promise<TrackerRow[]> => {
      const scope = await resolveScope(user!.id);

      // 1. Projects in scope
      let projectQuery = supabase
        .from("projects")
        .select("id, name, project_number, tenant_name, gc_company_name, sia_name, client_id, client_org_id, building_owner_id, proposal_id, properties(address)");
      if (!scope.isInternal) {
        const ors: string[] = [];
        if (scope.clientIds.length) {
          const list = scope.clientIds.join(",");
          ors.push(`client_id.in.(${list})`);
          ors.push(`building_owner_id.in.(${list})`);
        }
        if (scope.orgIds.length) ors.push(`client_org_id.in.(${scope.orgIds.join(",")})`);
        if (ors.length === 0) return [];
        projectQuery = projectQuery.or(ors.join(","));
      }
      if (clientOrgId) {
        // Resolve client_id for this org for legacy rows
        const { data: co } = await supabase.from("client_orgs").select("client_id").eq("id", clientOrgId).maybeSingle();
        const cid = (co as any)?.client_id;
        const ors = [`client_org_id.eq.${clientOrgId}`];
        if (cid) {
          ors.push(`client_id.eq.${cid}`);
          ors.push(`building_owner_id.eq.${cid}`);
        }
        projectQuery = projectQuery.or(ors.join(","));
      }
      const { data: projects, error: pErr } = await projectQuery;
      if (pErr) throw pErr;
      const projectIds = (projects ?? []).map((p: any) => p.id);
      if (projectIds.length === 0) return [];
      const projById = new Map<string, any>((projects ?? []).map((p: any) => [p.id, p]));

      // 2. Services + application join
      const { data: services, error: sErr } = await supabase
        .from("services")
        .select(`
          id, name, disciplines, filing_type, parent_service_id, project_id,
          filed_at, objections_received_at, approved_at, permit_issued_at,
          application:dob_applications(job_number, filed_date, approved_date, permit_issued_date)
        `)
        .in("project_id", projectIds);
      if (sErr) throw sErr;

      // 3. Proposals: which project_ids have a signed proposal?
      const proposalIds = Array.from(new Set(
        (projects ?? []).map((p: any) => p.proposal_id).filter(Boolean),
      ));
      let signedProposalIds = new Set<string>();
      if (proposalIds.length) {
        const { data: props } = await supabase
          .from("proposals").select("id, client_signed_at").in("id", proposalIds);
        signedProposalIds = new Set((props ?? [])
          .filter((p: any) => p.client_signed_at)
          .map((p: any) => p.id));
      }

      // 4. Client-visible notes → latest per (service_id, project_id)
      const { data: notes } = await supabase
        .from("project_notes")
        .select("service_id, project_id, body, created_at")
        .in("project_id", projectIds)
        .eq("client_visible", true)
        .order("created_at", { ascending: false });
      const noteBySvc = new Map<string, string>();
      const noteByProj = new Map<string, string>();
      (notes ?? []).forEach((n: any) => {
        if (n.service_id && !noteBySvc.has(n.service_id)) noteBySvc.set(n.service_id, n.body);
        if (!n.service_id && !noteByProj.has(n.project_id)) noteByProj.set(n.project_id, n.body);
      });

      const rows: TrackerRow[] = (services ?? []).map((s: any) => {
        const proj = projById.get(s.project_id) ?? {};
        const app = s.application ?? {};
        const status = deriveStatus({
          filed_at: s.filed_at ?? (app.filed_date ? new Date(app.filed_date).toISOString() : null),
          objections_received_at: s.objections_received_at,
          approved_at: s.approved_at ?? (app.approved_date ? new Date(app.approved_date).toISOString() : null),
          permit_issued_at: s.permit_issued_at ?? (app.permit_issued_date ? new Date(app.permit_issued_date).toISOString() : null),
        });
        return {
          service_id: s.id,
          project_id: s.project_id,
          project_name: proj.name ?? null,
          project_number: proj.project_number ?? null,
          address: proj.properties?.address ?? null,
          tenant: proj.tenant_name ?? null,
          service_name: s.name,
          disciplines: s.disciplines ?? [],
          filing_type: (s.filing_type ?? "new_job") as "new_job" | "paa",
          parent_service_id: s.parent_service_id ?? null,
          app_number: app.job_number ?? null,
          contractor: proj.gc_company_name ?? null,
          sia: proj.sia_name ?? null,
          status: status.status,
          status_updated_at: status.updated_at,
          signed: proj.proposal_id ? signedProposalIds.has(proj.proposal_id) : false,
          callout: noteBySvc.get(s.id) ?? noteByProj.get(s.project_id) ?? null,
          filed_at: s.filed_at,
          approved_at: s.approved_at,
          permit_issued_at: s.permit_issued_at,
          objections_received_at: s.objections_received_at,
        };
      });

      // Sort by address, then project, then app # (new_job before paa)
      rows.sort((a, b) => {
        const c1 = (a.address ?? "").localeCompare(b.address ?? "");
        if (c1) return c1;
        const c2 = (a.project_name ?? "").localeCompare(b.project_name ?? "");
        if (c2) return c2;
        if (a.filing_type !== b.filing_type) return a.filing_type === "new_job" ? -1 : 1;
        return (a.app_number ?? "").localeCompare(b.app_number ?? "");
      });

      return rows;
    },
  });
}
