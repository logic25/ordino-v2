import { supabase } from "@/integrations/supabase/client";

export interface ProposalExportFilters {
  from?: string | null;
  to?: string | null;
  /** COALESCE(sales_person_id, created_by) */
  ownerId?: string | null;
  leadSource?: string | null;
  status?: string | null;
  clientId?: string | null;
}

const HEADERS = [
  "Proposal #",
  "Client",
  "Project",
  "Status",
  "Owner",
  "Owner inferred",
  "Lead source",
  "Proposed amount",
  "Sent at",
  "Converted at",
];

export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Single shared proposals export used by every chart/report Export button.
 * Owner semantics match Client Health: COALESCE(sales_person_id, created_by).
 */
export async function exportProposals(filters: ProposalExportFilters = {}) {
  const [{ data: proposals, error }, { data: profiles }, { data: clients }, { data: projects }] =
    await Promise.all([
      supabase
        .from("proposals")
        .select(
          "id, proposal_number, status, total_amount, sent_at, converted_at, converted_project_id, client_id, lead_source, sales_person_id, created_by"
        ),
      supabase.from("profiles").select("id, display_name"),
      supabase.from("clients").select("id, name"),
      supabase.from("projects").select("id, name, project_number"),
    ]);
  if (error) throw error;

  const nameById = new Map((profiles || []).map((p: any) => [p.id, p.display_name || "Unknown"]));
  const clientById = new Map((clients || []).map((c: any) => [c.id, c.name]));
  const projectById = new Map((projects || []).map((p: any) => [p.id, p.project_number || p.name]));

  const rows = (proposals || [])
    .filter((p: any) => {
      const owner = p.sales_person_id || p.created_by;
      if (filters.ownerId && owner !== filters.ownerId) return false;
      if (filters.leadSource && p.lead_source !== filters.leadSource) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (filters.clientId && p.client_id !== filters.clientId) return false;
      if (filters.from && (!p.sent_at || p.sent_at < filters.from)) return false;
      if (filters.to && (!p.sent_at || p.sent_at > filters.to)) return false;
      return true;
    })
    .map((p: any) => {
      const owner = p.sales_person_id || p.created_by;
      return [
        p.proposal_number || p.id,
        clientById.get(p.client_id) || "",
        projectById.get(p.converted_project_id) || "",
        p.status,
        owner ? nameById.get(owner) || "Unknown" : "",
        p.sales_person_id ? "no" : owner ? "yes" : "",
        p.lead_source || "",
        p.total_amount ?? "",
        p.sent_at || "",
        p.converted_at || "",
      ];
    });

  return { headers: HEADERS, rows };
}

export async function downloadProposalsExport(filters: ProposalExportFilters = {}) {
  const { headers, rows } = await exportProposals(filters);
  downloadCSV(`proposals-export-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(headers, rows));
}
