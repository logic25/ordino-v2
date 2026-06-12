import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadClientMatchPreview {
  action: "link_existing" | "create_new";
  client_id?: string | null;
  client_name?: string | null;
  reason?: "already_linked" | "fuzzy_match";
  error?: string;
}

/**
 * Mirror of convert_lead_to_proposal's suffix-stripping fuzzy match.
 * Tells the UI whether converting this lead will LINK an existing client
 * (and which one) or CREATE a new client — without mutating anything.
 *
 * Shares the exact normalization logic with the RPC (server-side), so the
 * preview can never disagree with the actual conversion behavior.
 */
export function usePreviewLeadClientMatch(leadId: string | undefined) {
  return useQuery({
    queryKey: ["preview-lead-client-match", leadId],
    enabled: !!leadId,
    staleTime: 30_000,
    queryFn: async (): Promise<LeadClientMatchPreview> => {
      const { data, error } = await (supabase.rpc as any)(
        "preview_lead_client_match",
        { _lead_id: leadId },
      );
      if (error) throw error;
      return (data ?? { action: "create_new" }) as LeadClientMatchPreview;
    },
  });
}
