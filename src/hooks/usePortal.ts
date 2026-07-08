import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";


export type FilingStage =
  | "pre_filing" | "filed" | "in_review" | "objections"
  | "approved" | "permit_issued" | "sign_off";

export type FilingDiscipline =
  | "building" | "plumbing" | "sprinkler" | "mechanical" | "electrical" | "fire_alarm";

export interface ClientOrg {
  id: string; company_id: string; name: string; type: string;
  client_id: string | null;
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

/**
 * Resolve the current user's portal scope: which client_ids and client_org_ids
 * they can see projects for. Empty arrays = internal staff (see all — RLS still applies).
 */
async function resolvePortalScope(userId: string): Promise<{
  clientIds: string[];
  clientOrgIds: string[];
  clientIdByOrgId: Record<string, string>;
  isInternal: boolean;
}> {
  // 1. Which client_orgs does this user belong to?
  const { data: mems } = await supabase
    .from("client_org_memberships")
    .select("client_org_id")
    .eq("user_id", userId);
  const clientOrgIds = Array.from(new Set((mems ?? []).map((m: any) => m.client_org_id).filter(Boolean)));

  if (clientOrgIds.length === 0) {
    // No memberships → internal staff. RLS decides what they see.
    return { clientIds: [], clientOrgIds: [], clientIdByOrgId: {}, isInternal: true };
  }

  // 2. Which client (customer) records are those orgs linked to?
  const { data: orgs } = await supabase
    .from("client_orgs")
    .select("id, client_id")
    .in("id", clientOrgIds);
  const clientIds = Array.from(new Set((orgs ?? []).map((o: any) => o.client_id).filter(Boolean)));
  const clientIdByOrgId = Object.fromEntries(
    (orgs ?? [])
      .filter((o: any) => o.id && o.client_id)
      .map((o: any) => [o.id, o.client_id]),
  );

  return { clientIds, clientOrgIds, clientIdByOrgId, isInternal: false };
}

async function resolveClientIdForOrg(clientOrgId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("client_orgs")
    .select("client_id")
    .eq("id", clientOrgId)
    .maybeSingle();
  if (error) throw error;
  return (data as any)?.client_id ?? null;
}

export function usePortalProjects(filters?: { clientOrgId?: string; buildingId?: string; stage?: FilingStage }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["portal", "projects", user?.id, filters],
    enabled: !!user,
    queryFn: async () => {
      const scope = await resolvePortalScope(user!.id);

      let q = supabase
        .from("projects")
        .select("id, name, project_number, filing_type, client_id, client_org_id, building_id, building_owner_id, portal_overall_stage, portal_pct_complete, portal_next_action, properties(address, borough)")
        .order("updated_at", { ascending: false });

      // For portal users: OR across (client_id, client_org_id, building_owner_id).
      // Legacy data lives on client_id; new portal-native data on client_org_id.
      if (!scope.isInternal) {
        const ors: string[] = [];
        if (scope.clientIds.length) {
          const list = scope.clientIds.join(",");
          ors.push(`client_id.in.(${list})`);
          ors.push(`building_owner_id.in.(${list})`);
        }
        if (scope.clientOrgIds.length) {
          ors.push(`client_org_id.in.(${scope.clientOrgIds.join(",")})`);
        }
        if (ors.length === 0) return [] as PortalProject[];
        q = q.or(ors.join(","));
      }

      if (filters?.clientOrgId) {
        const filteredClientId =
          scope.clientIdByOrgId[filters.clientOrgId] ??
          (await resolveClientIdForOrg(filters.clientOrgId));
        const ors = [`client_org_id.eq.${filters.clientOrgId}`];
        if (filteredClientId) {
          ors.push(`client_id.eq.${filteredClientId}`);
          ors.push(`building_owner_id.eq.${filteredClientId}`);
        }
        q = q.or(ors.join(","));
      }
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
        .select("id, name, project_number, filing_type, client_id, client_org_id, building_id, building_owner_id, portal_overall_stage, portal_pct_complete, portal_next_action, properties(address, borough, block, lot, bin)")
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

export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("portal_notifications")
        .update({ read: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal", "notifications"] }),
  });
}

/** Realtime subscription — refresh notifications list on any INSERT for this user */
export function usePortalNotificationsRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`portal-notifs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "portal_notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["portal", "notifications"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);
}

/** Upload a portal document (staff only, enforced by storage RLS) */
export function useUploadPortalDocument() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: { projectId: string; file: File; docType?: string; filingId?: string | null }) => {
      const { projectId, file, docType = "general", filingId = null } = args;
      const ext = file.name.split(".").pop() || "bin";
      const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("portal-documents").upload(path, file, {
        contentType: file.type || undefined, upsert: false,
      });
      if (upErr) throw upErr;
      const { data: prof } = await supabase.from("profiles").select("id").eq("user_id", user!.id).maybeSingle();
      const { error } = await supabase.from("portal_documents").insert({
        project_id: projectId, filing_id: filingId,
        doc_type: docType, display_name: file.name,
        storage_path: path, uploaded_by: prof?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: ["portal", "documents", v.projectId] }),
  });
}

export function useDeletePortalDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: PortalDocument) => {
      if (doc.storage_path) {
        await supabase.storage.from("portal-documents").remove([doc.storage_path]);
      }
      const { error } = await supabase.from("portal_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: ["portal", "documents", v.project_id] }),
  });
}

export async function getPortalDocumentUrl(doc: PortalDocument): Promise<string | null> {
  if (doc.external_url) return doc.external_url;
  if (!doc.storage_path) return null;
  const { data, error } = await supabase.storage
    .from("portal-documents")
    .createSignedUrl(doc.storage_path, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
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
