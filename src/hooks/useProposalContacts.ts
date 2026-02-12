import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ContactRole = "bill_to" | "sign" | "cc";

export interface ProposalContact {
  id: string;
  proposal_id: string;
  client_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  role: ContactRole;
  sort_order: number | null;
  created_at: string | null;
}

export interface ProposalContactInput {
  id?: string;
  client_id?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  role: ContactRole;
  sort_order?: number;
}

export function useProposalContacts(proposalId: string | undefined) {
  return useQuery({
    queryKey: ["proposal-contacts", proposalId],
    queryFn: async () => {
      if (!proposalId) return [];
      const { data, error } = await supabase
        .from("proposal_contacts" as any)
        .select("*")
        .eq("proposal_id", proposalId)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as ProposalContact[];
    },
    enabled: !!proposalId,
  });
}

export function useSaveProposalContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      proposalId,
      contacts,
    }: {
      proposalId: string;
      contacts: ProposalContactInput[];
    }) => {
      // Delete existing contacts
      await (supabase.from("proposal_contacts" as any) as any)
        .delete()
        .eq("proposal_id", proposalId);

      // Insert new ones
      if (contacts.length > 0) {
        const toInsert = contacts.map((c, idx) => ({
          proposal_id: proposalId,
          client_id: c.client_id || null,
          name: c.name,
          email: c.email || null,
          phone: c.phone || null,
          company_name: c.company_name || null,
          role: c.role,
          sort_order: idx,
        }));

        const { error } = await (supabase.from("proposal_contacts" as any) as any)
          .insert(toInsert);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["proposal-contacts", vars.proposalId] });
    },
  });
}
