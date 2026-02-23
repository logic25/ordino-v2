import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UniversalDocument {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  category: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  project_id: string | null;
  property_id: string | null;
  proposal_id: string | null;
  uploader?: { display_name: string | null; first_name: string | null; last_name: string | null };
}

export function useUniversalDocuments() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["universal-documents"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("universal_documents")
        .select("*, uploader:profiles!universal_documents_uploaded_by_fkey(display_name, first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as UniversalDocument[];
    },
  });
}

export function useUploadDocument() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { file: File; title: string; description?: string; category: string; tags?: string[]; folder_id?: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      const ext = input.file.name.split(".").pop();
      const path = `${profile.company_id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("universal-documents")
        .upload(path, input.file);
      if (uploadError) throw uploadError;

      const { error } = await supabase.from("universal_documents").insert({
        company_id: profile.company_id,
        title: input.title,
        description: input.description || null,
        category: input.category,
        filename: input.file.name,
        storage_path: path,
        mime_type: input.file.type || null,
        size_bytes: input.file.size,
        uploaded_by: profile.id,
        tags: input.tags || [],
        folder_id: input.folder_id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["universal-documents"] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (doc: { id: string; storage_path: string }) => {
      await supabase.storage.from("universal-documents").remove([doc.storage_path]);
      const { error } = await supabase.from("universal_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["universal-documents"] }),
  });
}
