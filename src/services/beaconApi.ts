const BEACON_API_URL = import.meta.env.VITE_BEACON_API_URL || 'https://beaconrag.up.railway.app';

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

export async function askBeacon(
  message: string,
  userId: string,
  userName: string
): Promise<BeaconChatResponse> {
  const res = await fetch(`${BEACON_API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      user_id: userId,
      user_name: userName,
      space_id: 'ordino-web'
    })
  });

  if (!res.ok) {
    throw new Error(`Beacon API error: ${res.status}`);
  }

  return res.json();
}

export async function syncDocumentToBeacon(
  file: File | Blob,
  filename: string,
  folderName: string
): Promise<{ success: boolean; chunks_created: number }> {
  const formData = new FormData();
  formData.append("file", file, filename);
  formData.append("folder", folderName);

  const response = await fetch(`${BEACON_API_URL}/api/ingest`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Beacon ingest error: ${response.status}`);
  }

  return response.json();
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
  const res = await fetch(`${BEACON_API_URL}/api/knowledge/list`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Beacon API error: ${res.status}`);
  const data = await res.json();

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
    total_files: data.count ?? Object.values(folders).reduce((s, f) => s + f.length, 0),
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
  const res = await fetch(
    `${BEACON_API_URL}/api/knowledge/file-content?source_file=${encodeURIComponent(sourceFile)}`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) throw new Error(`Failed to fetch document: ${res.status}`);
  return res.json();
}

export async function checkBeaconHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BEACON_API_URL}/`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}
