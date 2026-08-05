import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KbOriginal {
  id: string;
  source_file: string;
  folder: string | null;
  storage_path: string;
  content_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
}

/**
 * The retained original file for a Beacon KB document, if one was kept at
 * ingest time. RLS scopes rows to the caller's company.
 */
export function useKbOriginal(sourceFile: string | null | undefined) {
  return useQuery({
    queryKey: ["kb-original", sourceFile],
    enabled: !!sourceFile,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beacon_kb_originals")
        .select("id, source_file, folder, storage_path, content_type, size_bytes, uploaded_at")
        .eq("source_file", sourceFile!)
        .maybeSingle();
      if (error) throw error;
      return (data as KbOriginal | null) ?? null;
    },
  });
}

/** Short-lived signed URL (5 minutes) for a retained original. */
export async function getKbOriginalUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("kb-originals")
    .createSignedUrl(storagePath, 300, { download: true });
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("Could not create a download link");
  return data.signedUrl;
}
