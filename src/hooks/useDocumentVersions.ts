import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DocumentVersion {
  id: string;
  document_id: string;
  version: number;
  title: string | null;
  description: string | null;
  storage_path: string | null;
  category: string | null;
  jurisdiction: string | null;
  changed_by: string | null;
  created_at: string;
  changer?: { display_name: string | null; first_name: string | null; last_name: string | null } | null;
}

// document_versions is populated by a DB trigger (metadata edits) and by
// DocumentPreviewSheet's save (file-content snapshots). The table isn't in the
// generated Supabase types yet, so we cast through `any`.
export function useDocumentVersions(documentId: string | null | undefined) {
  return useQuery({
    queryKey: ["document-versions", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("document_versions")
        .select("*")
        .eq("document_id", documentId)
        .order("version", { ascending: false });
      if (error) throw error;
      const versions = (data || []) as DocumentVersion[];

      // Resolve changer names (changed_by -> profiles.id). No FK embed, so look up separately.
      const ids = [...new Set(versions.map((v) => v.changed_by).filter(Boolean))] as string[];
      let profMap: Record<string, any> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, first_name, last_name")
          .in("id", ids);
        profMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
      }
      return versions.map((v) => ({ ...v, changer: v.changed_by ? profMap[v.changed_by] : null }));
    },
  });
}

export function versionChangerName(v: DocumentVersion): string {
  const c = v.changer;
  if (!c) return "—";
  return c.display_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
}
