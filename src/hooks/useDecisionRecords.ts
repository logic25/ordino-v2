import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DecisionRecord {
  id: string;
  company_id: string;
  project_id: string | null;
  objection_id: string | null;
  objection_text: string;
  code_reference: string | null;
  filing_type: string | null;
  recommendation: string | null;
  reasoning: string | null;
  resolved_by: string | null;
  resolved_at: string;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
  resolver?: { id: string; first_name: string | null; last_name: string | null } | null;
}

export interface DecisionRecordInput {
  project_id?: string | null;
  objection_id?: string | null;
  objection_text: string;
  code_reference?: string | null;
  filing_type?: string | null;
  recommendation?: string | null;
  reasoning?: string | null;
}

const SELECT = `
  *,
  resolver:profiles!decision_records_resolved_by_fkey (id, first_name, last_name)
`;

/** All decision records for the current company (newest first). */
export function useDecisionRecords() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  return useQuery({
    queryKey: ["decision_records", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decision_records")
        .select(SELECT)
        .eq("company_id", companyId!)
        .order("resolved_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as DecisionRecord[];
    },
  });
}

/** Fetch prior decisions for the same code section — used as RAG context when drafting. */
export async function fetchDecisionsForCode(
  companyId: string,
  codeReference: string,
  limit = 5
): Promise<DecisionRecord[]> {
  if (!companyId || !codeReference?.trim()) return [];
  const { data, error } = await supabase
    .from("decision_records")
    .select("*")
    .eq("company_id", companyId)
    .eq("code_reference", codeReference)
    .order("resolved_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []) as unknown as DecisionRecord[];
}

export function useCreateDecisionRecord() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DecisionRecordInput) => {
      if (!profile?.company_id) throw new Error("No company found for user");
      const { data, error } = await supabase
        .from("decision_records")
        .insert({
          company_id: profile.company_id,
          project_id: input.project_id ?? null,
          objection_id: input.objection_id ?? null,
          objection_text: input.objection_text,
          code_reference: input.code_reference ?? null,
          filing_type: input.filing_type ?? null,
          recommendation: input.recommendation ?? null,
          reasoning: input.reasoning ?? null,
          resolved_by: profile.id,
          status: "pending_review",
          source: "objection-resolution",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision_records"] });
    },
  });
}
