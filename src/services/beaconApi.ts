import { supabase } from "@/integrations/supabase/client";

export interface BeaconSource {
  title: string;
  score: number;
  chunk_preview: string;
}

export interface BeaconChatResponse {
  response: string;
  confidence: number;
  sources: BeaconSource[];
  flow_type: string;
  cached: boolean;
  response_time_ms: number;
}

export interface BeaconProjectContext {
  projectId?: string;
  projectAddress?: string;
  codeSection?: string;
}

export async function askBeacon(
  message: string,
  userId: string,
  userName: string,
  projectContext?: BeaconProjectContext
): Promise<BeaconChatResponse> {
  const { data, error } = await supabase.functions.invoke("beacon-proxy?action=chat", {
    body: {
      message,
      user_id: userId,
      user_name: userName,
      space_id: "ordino-web",
      ...(projectContext && { project_context: projectContext }),
    },
  });
  if (error) throw new Error(`Beacon API error: ${error.message}`);
  return data as BeaconChatResponse;
}

export async function syncDocumentToBeacon(
  file: File | Blob,
  filename: string,
  folderName: string
): Promise<{ success: boolean; chunks_created: number }> {
  const formData = new FormData();
  formData.append("file", file, filename);
  formData.append("folder", folderName);

  // Use raw fetch for FormData since supabase.functions.invoke doesn't support it well
  const { data: { session } } = await supabase.auth.getSession();
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/beacon-proxy?action=ingest`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: formData,
    }
  );
  if (!res.ok) throw new Error(`Beacon ingest error: ${res.status}`);
  return res.json();
}

export const FOLDER_TO_SOURCE_TYPE: Record<string, string> = {
  filing_guides: "procedure",
  service_notices: "service_notice",
  buildings_bulletins: "technical_bulletin",
  policy_memos: "policy_memo",
  codes: "building_code",
  determinations: "historical_determination",
  company_sops: "communication",
  objections: "reference",
};

export interface BeaconKnowledgeData {
  folders: Record<string, string[]>;
  total_files: number;
  folder_count: number;
}

export async function fetchBeaconKnowledgeList(): Promise<BeaconKnowledgeData> {
  const { data, error } = await supabase.functions.invoke("beacon-proxy?action=knowledge-list");
  if (error) throw new Error(`Beacon API error: ${error.message}`);

  const folders: Record<string, string[]> = {};
  for (const filePath of (data.files || [])) {
    const slashIdx = filePath.indexOf('/');
    if (slashIdx > 0) {
      const folder = filePath.substring(0, slashIdx);
      const filename = filePath.substring(slashIdx + 1);
      if (!folders[folder]) folders[folder] = [];
      folders[folder].push(filename);
    } else {
      if (!folders['_root']) folders['_root'] = [];
      folders['_root'].push(filePath);
    }
  }

  return {
    folders,
    total_files: data.count ?? Object.values(folders).reduce((s: number, f: string[]) => s + f.length, 0),
    folder_count: Object.keys(folders).length,
  };
}

export async function fetchBeaconFileContent(sourceFile: string): Promise<{
  source_file: string;
  content: string;
  chunks_count: number;
  source_type: string;
  folder: string;
}> {
  const { data, error } = await supabase.functions.invoke(
    `beacon-proxy?action=file-content&source_file=${encodeURIComponent(sourceFile)}`
  );
  if (error) throw new Error(`Failed to fetch document: ${error.message}`);
  return data;
}

export async function checkBeaconHealth(): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke("beacon-proxy?action=health");
    return !error;
  } catch {
    return false;
  }
}
