import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UniversalDocument } from "./useUniversalDocuments";

export function useDocumentsByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["entity-documents", "project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("universal_documents")
        .select("*, uploader:profiles!universal_documents_uploaded_by_fkey(display_name, first_name, last_name)")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as UniversalDocument[];
    },
  });
}

export function useDocumentsByProperty(propertyId: string | undefined) {
  return useQuery({
    queryKey: ["entity-documents", "property", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("universal_documents")
        .select("*, uploader:profiles!universal_documents_uploaded_by_fkey(display_name, first_name, last_name)")
        .eq("property_id", propertyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as UniversalDocument[];
    },
  });
}
