import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FilingStage =
  | "pre_filing" | "filed" | "in_review" | "objections"
  | "approved" | "permit_issued" | "sign_off";

export type FilingDiscipline =
  | "building" | "plumbing" | "sprinkler" | "mechanical" | "electrical" | "fire_alarm";

export interface ClientOrg {
  id: string; company_id: string; name: string; type: string;
  primary_contact_name: string | null; primary_contact_email: string | null;
}

export interface Building {
  id: string; client_org_id: string; address: string; bin: string | null;
  pm_name: string | null; pm_email: string | null;
}

export interface PortalProject {
  id: string; name: string | null; project_number: string | null;
  client_org_id: string | null; building_id: string | null;
  portal_overall_stage: FilingStage | null;
  portal_pct_complete: number | null;
  portal_next_action: string | null;
  filing_type: string | null;
  properties?: { address: string | null; borough: string | null } | null;
}

export interface Filing {
  id: string; project_id: string; discipline: FilingDiscipline;
  agency: string; filing_number: string | null;
  current_stage: FilingStage; stage_entered_at: string;
  expected_next_milestone: string | null;
  blocked: boolean; blocked_reason: string | null; blocked_since: string | null;
}

export interface FilingEvent {
  id: string; filing_id: string; stage: FilingStage | null;
  note: string | null; source: "auto" | "manual"; occurred_at: string;
}

export interface ClientActionItem {
  id: string; project_id: string; title: string; description: string | null;
  owner: "gle" | "client" | "agency"; status: "open" | "done"; due_date: string | null;
}

export interface PortalDocument {
  id: string; project_id: string; filing_id: string | null;
  doc_type: string; display_name: string; storage_path: string | null;
  external_url: string | null; uploaded_at: string;
}

export interface PortalNotification {
  id: string; user_id: string; project_id: string | null; filing_id: string | null;
  type: string; title: string; message: string | null; read: boolean; created_at: string;
}

/** Client orgs the current user belongs to (empty = internal staff sees all) */
export function usePortalOrgs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["portal", "orgs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_orgs")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClientOrg[];
    },
  });
}

export function useBuildings(clientOrgId?: string) {
  return useQuery({
    queryKey: ["portal", "buildings", clientOrgId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("buildings").select("*").order("address");
      if (clientOrgId) q = q.eq("client_org_id", clientOrgId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Building[];
    },
  });
}

export function usePortalProjects(filters?: { clientOrgId?: string; buildingId?: string; stage?: FilingStage }) {
  return useQuery({
    queryKey: ["portal", "projects", filters],
    queryFn: async () => {
      let q = supabase
        .from("projects")
        .select("id, name, project_number, filing_type, client_org_id, building_id, portal_overall_stage, portal_pct_complete, portal_next_action, properties(address, borough)")
        .not("client_org_id", "is", null)
        .order("updated_at", { ascending: false });
      if (filters?.clientOrgId) q = q.eq("client_org_id", filters.clientOrgId);
      if (filters?.buildingId) q = q.eq("building_id", filters.buildingId);
      if (filters?.stage) q = q.eq("portal_overall_stage", filters.stage);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PortalProject[];
    },
  });
}

export function usePortalProject(id: string | undefined) {
  return useQuery({
    queryKey: ["portal", "project", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, project_number, filing_type, client_org_id, building_id, portal_overall_stage, portal_pct_complete, portal_next_action, properties(address, borough, block, lot, bin)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PortalProject & { properties: any };
    },
  });
}

export function useFilings(projectId: string | undefined) {
  return useQuery({
    queryKey: ["portal", "filings", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("filings")
        .select("*")
        .eq("project_id", projectId!)
        .order("discipline");
      if (error) throw error;
      return (data ?? []) as Filing[];
    },
  });
}

export function useFilingEvents(projectId: string | undefined) {
  return useQuery({
    queryKey: ["portal", "filing-events", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data: filings } = await supabase.from("filings").select("id").eq("project_id", projectId!);
      const ids = (filings ?? []).map((f: any) => f.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("filing_events")
        .select("*")
        .in("filing_id", ids)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FilingEvent[];
    },
  });
}

export function useClientActionItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ["portal", "action-items", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_action_items")
        .select("*")
        .eq("project_id", projectId!)
        .order("status")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientActionItem[];
    },
  });
}

export function usePortalDocuments(projectId: string | undefined) {
  return useQuery({
    queryKey: ["portal", "documents", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_documents")
        .select("*")
        .eq("project_id", projectId!)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortalDocument[];
    },
  });
}

export function usePortalNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["portal", "notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PortalNotification[];
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("portal_notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal", "notifications"] }),
  });
}

/** Aggregate counters for the portfolio strip */
export function usePortalCounters() {
  const { data: projects = [] } = usePortalProjects();
  return useQuery({
    queryKey: ["portal", "counters", projects.map((p) => p.id).join(",")],
    enabled: true,
    queryFn: async () => {
      const projectIds = projects.map((p) => p.id);
      const active = projects.filter((p) => p.portal_overall_stage !== "sign_off").length;
      const permitsIssued = projects.filter((p) =>
        ["permit_issued", "sign_off"].includes(p.portal_overall_stage ?? "")
      ).length;

      let blocked = 0;
      let actionsNeeded = 0;
      if (projectIds.length) {
        const [b, a] = await Promise.all([
          supabase.from("filings").select("id", { count: "exact", head: true })
            .in("project_id", projectIds).eq("blocked", true),
          supabase.from("client_action_items").select("id", { count: "exact", head: true })
            .in("project_id", projectIds).eq("owner", "client").eq("status", "open"),
        ]);
        blocked = b.count ?? 0;
        actionsNeeded = a.count ?? 0;
      }
      return { active, permitsIssued, blocked, actionsNeeded };
    },
  });
}
