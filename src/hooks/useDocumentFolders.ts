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

export function useRenameFolder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("document_folders")
        .update({ name } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-folders"] }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, parent_id }: { id: string; parent_id: string | null }) => {
      // 1. Re-parent child folders
      const { error: e1 } = await supabase
        .from("document_folders")
        .update({ parent_id: parent_id } as any)
        .eq("parent_id", id);
      if (e1) throw e1;

      // 2. Re-parent documents
      const { error: e2 } = await supabase
        .from("universal_documents")
        .update({ folder_id: parent_id } as any)
        .eq("folder_id", id);
      if (e2) throw e2;

      // 3. Delete the folder
      const { error: e3 } = await supabase
        .from("document_folders")
        .delete()
        .eq("id", id);
      if (e3) throw e3;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["document-folders"] });
      qc.invalidateQueries({ queryKey: ["universal-documents"] });
    },
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

/** Flatten folders into an indented list for selector dropdowns */
export function flattenFolders(folders: DocumentFolder[]): { id: string; name: string; depth: number }[] {
  const tree = buildFolderTree(folders);
  const result: { id: string; name: string; depth: number }[] = [];

  function walk(nodes: FolderTreeNode[], depth: number) {
    for (const node of nodes) {
      result.push({ id: node.id, name: node.name, depth });
      walk(node.children, depth + 1);
    }
  }
  walk(tree, 0);
  return result;
}
