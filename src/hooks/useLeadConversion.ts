import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Lead } from "./useLeads";

/**
 * Lead → Company (clients row) conversion, run at "Create Proposal from Lead".
 *
 * Idempotent + dedupe-safe:
 *   1. If lead.client_id is already set, reuse it.
 *   2. Else exact-normalized (case-insensitive, trimmed) name match against clients.
 *   3. Else create a clients row + a primary client_contacts row.
 *   4. Write lead.client_id back so re-opening the flow never double-creates.
 *
 * Returns the resolved client (Company) id, or null if the lead has no company name
 * and no contact to anchor on.
 */
export function useConvertLeadToClient() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (lead: Lead): Promise<string | null> => {
      if (lead.client_id) return lead.client_id;
      if (!profile?.company_id) throw new Error("No company");

      const companyName = (lead.company || "").trim();
      let clientId: string | null = null;

      // Exact-normalized match (ilike with no wildcards = case-insensitive equality).
      if (companyName) {
        const { data: matches } = await supabase
          .from("clients")
          .select("id, name")
          .eq("company_id", profile.company_id)
          .ilike("name", companyName);
        const exact = (matches || []).find(
          (c: any) => (c.name || "").trim().toLowerCase() === companyName.toLowerCase(),
        );
        clientId = exact?.id ?? null;
      }

      if (!clientId) {
        const { data: newClient, error: cErr } = await supabase
          .from("clients")
          .insert({
            company_id: profile.company_id,
            name: companyName || lead.full_name,
            client_type: lead.client_type,
            lead_owner_id: lead.assigned_to,
          } as any)
          .select("id")
          .single();
        if (cErr) throw cErr;
        clientId = (newClient as { id: string }).id;

        // Primary contact from the lead's person.
        const parts = (lead.full_name || "").trim().split(/\s+/);
        const first = parts[0] || null;
        const last = parts.length > 1 ? parts.slice(1).join(" ") : null;
        const { error: ctErr } = await supabase.from("client_contacts").insert({
          company_id: profile.company_id,
          client_id: clientId,
          name: lead.full_name || companyName,
          first_name: first,
          last_name: last,
          title: lead.role,
          email: lead.contact_email,
          phone: lead.contact_phone,
          is_primary: true,
          is_referrer: false,
          lead_owner_id: lead.assigned_to,
        } as any);
        if (ctErr) throw ctErr;
      }

      // Idempotent write-back.
      await supabase
        .from("leads")
        .update({ client_id: clientId, updated_by: profile.id } as any)
        .eq("id", lead.id);

      return clientId;
    },
    onSuccess: (_d, lead) => {
      qc.invalidateQueries({ queryKey: ["lead", lead.id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}
