import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
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

// Bucket is private — fetch a short-lived signed URL for in-app viewing,
// or a long-lived one for outbound emails (see getProjectPhotoSignedUrls).
const PHOTO_URL_TTL_SECONDS = 60 * 60; // 1 hour — covers any reasonable session
const EMAIL_PHOTO_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year — outbound RFP emails

export async function getProjectPhotoSignedUrls(
  paths: string[],
  expiresIn: number = PHOTO_URL_TTL_SECONDS,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  const { data, error } = await supabase.storage
    .from("rfp-project-photos")
    .createSignedUrls(paths, expiresIn);
  if (error) {
    console.warn("createSignedUrls failed", error);
    return map;
  }
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) map.set(row.path, row.signedUrl);
  }
  return map;
}

export async function getProjectPhotoEmailUrls(paths: string[]): Promise<Map<string, string>> {
  return getProjectPhotoSignedUrls(paths, EMAIL_PHOTO_URL_TTL_SECONDS);
}

/** Hook: returns a Map of path -> signed URL, refreshed when paths change. */
export function useProjectPhotoUrls(paths: string[]): Map<string, string> {
  const key = paths.join("|");
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let cancelled = false;
    getProjectPhotoSignedUrls(paths).then((m) => {
      if (!cancelled) setUrls(m);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}
