import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KbDocumentVersion {
  id: string;
  source_file: string;
  version: number;
  content: string | null;
  changed_by: string | null;
  created_at: string;
  changer?: { display_name: string | null; first_name: string | null; last_name: string | null } | null;
}

// Version history for Beacon KB docs (Pinecone reference docs edited in
// BeaconDocumentModal). Keyed on source_file. The table isn't in the generated
// Supabase types yet, so we cast through `any`.
export function useKbDocumentVersions(sourceFile: string | null | undefined) {
  return useQuery({
    queryKey: ["kb-document-versions", sourceFile],
    enabled: !!sourceFile,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kb_document_versions")
        .select("*")
        .eq("source_file", sourceFile)
        .order("version", { ascending: false });
      if (error) throw error;
      const versions = (data || []) as KbDocumentVersion[];

      const ids = [...new Set(versions.map((v) => v.changed_by).filter(Boolean))] as string[];
      let map: Record<string, any> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, first_name, last_name")
          .in("id", ids);
        map = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
      }
      return versions.map((v) => ({ ...v, changer: v.changed_by ? map[v.changed_by] : null }));
    },
  });
}

export function kbVersionChangerName(v: KbDocumentVersion): string {
  const c = v.changer;
  if (!c) return "—";
  return c.display_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
}
