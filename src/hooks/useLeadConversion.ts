import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "./useLeads";

export interface ConvertLeadOverrides {
  title?: string;
  client_name?: string;
  client_email?: string;
  billed_to_name?: string;
  lead_source?: string;
  referred_by?: string;
  project_type?: string;
  notes?: string;
}

/**
 * Atomic Lead → Client + Proposal conversion.
 * Wraps the `convert_lead_to_proposal` SECURITY DEFINER RPC, which in a single
 * transaction: find-or-creates the client (+ primary contact), inserts a
 * proposal carrying all party metadata + back-link, and advances the lead to
 * stage PROPOSAL with status 'converted'. Any failure rolls back cleanly.
 */
export function useConvertLeadToProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lead,
      overrides = {},
    }: { lead: Lead; overrides?: ConvertLeadOverrides }): Promise<string> => {
      const { data, error } = await (supabase.rpc as any)("convert_lead_to_proposal", {
        _lead_id: lead.id,
        _proposal: overrides,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_proposalId, { lead }) => {
      qc.invalidateQueries({ queryKey: ["lead", lead.id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["proposal-stats"] });
    },
  });
}

/** @deprecated Use useConvertLeadToProposal instead. Removed in Batch B. */
export const useConvertLeadToClient = useConvertLeadToProposal;
