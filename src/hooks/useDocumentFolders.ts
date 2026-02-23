import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface DocumentFolder {
  id: string;
  company_id: string;
  name: string;
  parent_id: string | null;
  created_by: string | null;
  created_at: string;
  description: string | null;
  is_system: boolean;
  is_beacon_synced: boolean;
}

export function useDocumentFolders() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["document-folders"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_folders")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as DocumentFolder[];
    },
  });
}

export function useSeedFolders() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await supabase.rpc("seed_document_folders", {
        target_company_id: profile.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-folders"] }),
  });
}

export function useCreateFolder() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; parent_id?: string | null; description?: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { error } = await supabase.from("document_folders").insert({
        company_id: profile.company_id,
        name: input.name,
        parent_id: input.parent_id || null,
        description: input.description || null,
        created_by: profile.user_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-folders"] }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase.from("document_folders").delete().eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-folders"] }),
  });
}

export type FolderTreeNode = DocumentFolder & { children: FolderTreeNode[] };

export function buildFolderTree(folders: DocumentFolder[]): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>();
  folders.forEach((f) => map.set(f.id, { ...f, children: [] }));

  const roots: FolderTreeNode[] = [];
  folders.forEach((f) => {
    const node = map.get(f.id)!;
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}
