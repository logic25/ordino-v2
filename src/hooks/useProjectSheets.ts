import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ProjectSheet {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  location: string | null;
  completion_date: string | null;
  estimated_value: number | null;
  tags: string[];
  reference_contact_name: string | null;
  reference_contact_title: string | null;
  reference_contact_email: string | null;
  reference_contact_phone: string | null;
  reference_notes: string | null;
  photos: string[];
  documents: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjectSheets() {
  return useQuery({
    queryKey: ["rfp-project-sheets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rfp_project_sheets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProjectSheet[];
    },
  });
}

export function useCreateProjectSheet() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<ProjectSheet, "id" | "company_id" | "created_by" | "created_at" | "updated_at">) => {
      if (!profile?.company_id) throw new Error("No company");
      const { data, error } = await supabase
        .from("rfp_project_sheets")
        .insert({ ...input, company_id: profile.company_id, created_by: profile.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ProjectSheet;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfp-project-sheets"] }),
  });
}

export function useUpdateProjectSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<ProjectSheet>) => {
      const { error } = await supabase
        .from("rfp_project_sheets")
        .update({ ...fields, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfp-project-sheets"] }),
  });
}

export function useDeleteProjectSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sheet: ProjectSheet) => {
      // Clean up photos from storage
      if (sheet.photos.length > 0) {
        await supabase.storage.from("rfp-project-photos").remove(sheet.photos);
      }
      const { error } = await supabase
        .from("rfp_project_sheets")
        .delete()
        .eq("id", sheet.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rfp-project-sheets"] }),
  });
}

export async function uploadProjectPhoto(companyId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("rfp-project-photos").upload(path, file);
  if (error) throw error;
  return path;
}

export function getProjectPhotoUrl(path: string): string {
  const { data } = supabase.storage.from("rfp-project-photos").getPublicUrl(path);
  return data.publicUrl;
}
