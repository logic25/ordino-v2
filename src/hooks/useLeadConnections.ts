import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LeadConnectionPerson = {
  id: string;
  name: string;
  role: string;
  kind: "lead" | "contact";
  context: string | null;
  client_name: string | null;
};

export type LeadConnectionProject = {
  id: string;
  project_number: string | null;
  status: string | null;
  year: number | null;
  property_address: string;
  property_id: string;
};

export type LeadConnections = {
  people: LeadConnectionPerson[];
  projects: LeadConnectionProject[];
  company_norm: string | null;
  address_norm: string | null;
};

export function useLeadConnections(leadId: string | undefined) {
  return useQuery({
    queryKey: ["lead-connections", leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<LeadConnections> => {
      const { data, error } = await supabase.rpc("get_lead_connections", {
        _lead_id: leadId!,
      });
      if (error) throw error;
      const obj = (data ?? {}) as any;
      return {
        people: Array.isArray(obj.people) ? obj.people : [],
        projects: Array.isArray(obj.projects) ? obj.projects : [],
        company_norm: obj.company_norm ?? null,
        address_norm: obj.address_norm ?? null,
      };
    },
  });
}
