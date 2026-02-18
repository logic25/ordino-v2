import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Client = Tables<"clients">;
export type ClientContact = Tables<"client_contacts">;

export interface ClientContactInput {
  id?: string;
  first_name: string;
  last_name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  fax?: string | null;
  linkedin_url?: string | null;
  company_name?: string | null;
  lead_owner_id?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  is_primary?: boolean;
}

export interface ClientFormInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  fax?: string | null;
  address?: string | null;
  notes?: string | null;
  lead_owner_id?: string | null;
  tax_id?: string | null;
  client_type?: string | null;
  ibm_number?: string | null;
  ibm_number_expiration?: string | null;
  hic_license?: string | null;
  dob_tracking?: string | null;
  dob_tracking_expiration?: string | null;
  is_sia?: boolean;
  is_rfp_partner?: boolean;
  contacts?: ClientContactInput[];
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useClientContacts(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-contacts", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("client_contacts")
        .select("*")
        .eq("client_id", clientId)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data as ClientContact[];
    },
    enabled: !!clientId,
  });
}

function buildContactName(c: ClientContactInput): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.first_name;
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ClientFormInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!profile?.company_id) {
        throw new Error("No company found for user. Please complete your profile setup first.");
      }

      const { data, error } = await supabase
        .from("clients")
        .insert({
          company_id: profile.company_id,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          fax: input.fax || null,
          address: input.address || null,
          notes: input.notes || null,
          lead_owner_id: input.lead_owner_id || null,
          tax_id: input.tax_id || null,
          client_type: input.client_type || null,
          ibm_number: input.ibm_number || null,
          ibm_number_expiration: input.ibm_number_expiration || null,
          hic_license: input.hic_license || null,
          dob_tracking: input.dob_tracking || null,
          dob_tracking_expiration: input.dob_tracking_expiration || null,
          is_sia: input.is_sia || false,
          is_rfp_partner: input.is_rfp_partner || false,
        })
        .select()
        .single();

      if (error) throw error;

      // Create contacts if provided
      if (input.contacts?.length) {
        const contactRows = input.contacts.map((c, i) => ({
          client_id: data.id,
          company_id: profile.company_id,
          name: buildContactName(c),
          first_name: c.first_name,
          last_name: c.last_name || null,
          title: c.title || null,
          email: c.email || null,
          phone: c.phone || null,
          mobile: c.mobile || null,
          fax: c.fax || null,
          linkedin_url: c.linkedin_url || null,
          company_name: c.company_name || null,
          lead_owner_id: c.lead_owner_id || null,
          address_1: c.address_1 || null,
          address_2: c.address_2 || null,
          city: c.city || null,
          state: c.state || null,
          zip: c.zip || null,
          is_primary: c.is_primary || false,
          sort_order: i,
        }));
        const { error: cErr } = await supabase
          .from("client_contacts")
          .insert(contactRows);
        if (cErr) throw cErr;
      }

      return data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-contacts"] });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: ClientFormInput & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (!profile?.company_id) throw new Error("No company found for user.");

      const { data, error } = await supabase
        .from("clients")
        .update({
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          fax: input.fax || null,
          address: input.address || null,
          notes: input.notes || null,
          lead_owner_id: input.lead_owner_id || null,
          tax_id: input.tax_id || null,
          client_type: input.client_type || null,
          ibm_number: input.ibm_number || null,
          ibm_number_expiration: input.ibm_number_expiration || null,
          hic_license: input.hic_license || null,
          dob_tracking: input.dob_tracking || null,
          dob_tracking_expiration: input.dob_tracking_expiration || null,
          is_sia: input.is_sia ?? false,
          is_rfp_partner: input.is_rfp_partner ?? false,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Sync contacts
      if (input.contacts !== undefined) {
        const { data: existing } = await supabase
          .from("client_contacts")
          .select("id")
          .eq("client_id", id);
        const existingIds = new Set((existing || []).map((e) => e.id));
        const inputIds = new Set(
          input.contacts.filter((c) => c.id).map((c) => c.id!)
        );

        // Delete removed contacts
        const toDelete = [...existingIds].filter((eid) => !inputIds.has(eid));
        if (toDelete.length) {
          await supabase
            .from("client_contacts")
            .delete()
            .in("id", toDelete);
        }

        // Upsert contacts
        for (let i = 0; i < (input.contacts || []).length; i++) {
          const c = input.contacts![i];
          const row = {
            name: buildContactName(c),
            first_name: c.first_name,
            last_name: c.last_name || null,
            title: c.title || null,
            email: c.email || null,
            phone: c.phone || null,
            mobile: c.mobile || null,
            fax: c.fax || null,
            linkedin_url: c.linkedin_url || null,
            company_name: c.company_name || null,
            lead_owner_id: c.lead_owner_id || null,
            address_1: c.address_1 || null,
            address_2: c.address_2 || null,
            city: c.city || null,
            state: c.state || null,
            zip: c.zip || null,
            is_primary: c.is_primary || false,
            sort_order: i,
          };

          if (c.id && existingIds.has(c.id)) {
            await supabase
              .from("client_contacts")
              .update(row)
              .eq("id", c.id);
          } else {
            await supabase.from("client_contacts").insert({
              ...row,
              client_id: id,
              company_id: profile.company_id,
            });
          }
        }
      }

      return data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["client-detail"] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-contacts"] });
    },
  });
}
