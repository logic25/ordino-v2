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
  is_bug_report?: boolean;
  bug_auto_logged?: boolean;
  bug_id?: string;
}

export interface BeaconProjectContext {
  projectId?: string;
  projectName?: string;
  projectAddress?: string;
  borough?: string;
  block?: string;
  lot?: string;
  filingType?: string;
  scopeOfWork?: string;
  assignedServices?: string[];
  codeSection?: string;
  contractValue?: number;
  billedAmount?: number;
  serviceDetails?: string[];
  dobApplications?: string[];
  clientName?: string;
  projectNumber?: string;
  // Operational context
  lastActivity?: {
    userName: string;
    action: string;
    timestamp: string;
  };
  daysSinceLastActivity?: number;
  openActionItems?: {
    count: number;
    items: { title: string; assignee: string; priority: string }[];
  };
  financials?: {
    totalInvoiced: number;
    totalPaid: number;
    outstanding: number;
    proposalStatus: string;
  };
  servicesStatus?: {
    notStarted: string[];
    inProgress: string[];
    completed: string[];
  };
  // Page & error context for bug detection
  currentPage?: string;
  recentErrors?: string[];
}

export async function askBeacon(
  message: string,
  userId: string,
  userName: string,
  projectContext?: BeaconProjectContext,
  conversationHistory?: { role: string; content: string }[],
  opts?: { companyId?: string | null; jurisdiction?: string | null },
): Promise<BeaconChatResponse> {
  // jurisdiction: explicitly null until Pinecone KB docs are tagged + Railway jurisdiction change ships.
  // Sending "NYC" before that would zero out KB retrieval.
  const jurisdiction = opts && "jurisdiction" in opts ? opts.jurisdiction : null;
  const { data, error } = await supabase.functions.invoke("beacon-proxy?action=chat", {
    body: {
      message,
      user_id: userId,
      user_name: userName,
      space_id: "ordino-web",
      company_id: opts?.companyId ?? null,
      jurisdiction,
      ...(projectContext && { project_context: projectContext }),
      ...(conversationHistory && conversationHistory.length > 0 && { conversation_history: conversationHistory }),
    },
  });
  if (error) throw new Error(`Beacon API error: ${error.message}`);
  return data as BeaconChatResponse;
}


export interface BeaconProjectQAResponse {
  answer: string;
  question_id: string;
  duration_ms: number;
  truncated: boolean;
}

export async function askBeaconProjectQA(
  question: string,
  projectId?: string,
): Promise<BeaconProjectQAResponse> {
  const { data, error } = await supabase.functions.invoke("beacon-qa", {
    body: { question, project_id: projectId },
  });
  if (error) throw new Error(`Beacon Q&A error: ${error.message}`);
  return data as BeaconProjectQAResponse;
}

export async function syncDocumentToBeacon(
  file: File | Blob,
  filename: string,
  folderName: string,
  jurisdiction: string = "NYC",
): Promise<{ success: boolean; chunks_created: number }> {
  const formData = new FormData();
  formData.append("file", file, filename);
  formData.append("folder", folderName);
  formData.append("jurisdiction", jurisdiction || "NYC");

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

interface BeaconKnowledgeDetail {
  filename?: string;
  folder?: string;
  source_type?: string;
}

const SOURCE_TYPE_TO_FOLDER = Object.fromEntries(
  Object.entries(FOLDER_TO_SOURCE_TYPE).map(([folder, sourceType]) => [sourceType, folder]),
) as Record<string, string>;

export async function fetchBeaconKnowledgeList(): Promise<BeaconKnowledgeData> {
  const { data, error } = await supabase.functions.invoke("beacon-proxy?action=knowledge-list");
  if (error) throw new Error(`Beacon API error: ${error.message}`);

  let folders: Record<string, string[]> = {};

  if (data.folders && typeof data.folders === "object") {
    folders = data.folders;
  } else if (Array.isArray(data.details)) {
    for (const detail of data.details as BeaconKnowledgeDetail[]) {
      const filename = detail.filename?.trim();
      if (!filename) continue;

      const explicitFolder = detail.folder?.trim();
      const folder = explicitFolder || SOURCE_TYPE_TO_FOLDER[detail.source_type || ""] || "_root";
      (folders[folder] ||= []).push(filename);
    }
  } else {
    for (const filePath of (data.files || [])) {
      const slashIdx = filePath.indexOf('/');
      if (slashIdx > 0) {
        const folder = filePath.substring(0, slashIdx);
        const filename = filePath.substring(slashIdx + 1);
        (folders[folder] ||= []).push(filename);
      } else {
        (folders['_root'] ||= []).push(filePath);
      }
    }
  }

  for (const key of Object.keys(folders)) {
    folders[key] = Array.from(new Set(folders[key])).sort();
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
    const { data: { session } } = await supabase.auth.getSession();
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/beacon-proxy?action=health`,
      { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * In-place metadata update on the Railway Beacon backend.
 * NO re-ingest, NO duplicate chunks. Use this for title / jurisdiction / folder edits.
 * Admin/manager gated via beacon-proxy.
 */
export async function updateBeaconMetadata(params: {
  source_file: string;
  title?: string;
  jurisdiction?: string;
  folder?: string;
}): Promise<{ success: boolean; updated?: string[] }> {
  const { data, error } = await supabase.functions.invoke(
    "beacon-proxy?action=update-metadata",
    { body: params }
  );
  if (error) throw new Error(`Beacon update-metadata error: ${error.message}`);
  return data;
}

/**
 * Reassign one or more KB files to new folders without re-ingest.
 * Admin/manager gated via beacon-proxy.
 */
export async function assignBeaconFolders(
  assignments: Record<string, string>,
): Promise<{ success: boolean; assigned?: number }> {
  const { data, error } = await supabase.functions.invoke(
    "beacon-proxy?action=assign-folders",
    { body: { assignments } }
  );
  if (error) throw new Error(`Beacon assign-folders error: ${error.message}`);
  return data;
}

/**
 * Delete a KB document from the Beacon backend (backed up, restorable).
 * Admin/manager gated via beacon-proxy.
 */
export async function deleteBeaconDoc(
  source_file: string,
): Promise<{ success: boolean; restorable?: boolean }> {
  const { data, error } = await supabase.functions.invoke(
    "beacon-proxy?action=delete-doc",
    { body: { source_file } }
  );
  if (error) throw new Error(`Beacon delete error: ${error.message}`);
  return data;
}

