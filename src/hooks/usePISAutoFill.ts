import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ContactOption {
  id: string;
  label: string;
  sublabel?: string;
  source: "client" | "contact";
  fields: Record<string, string>;
}

// Maps PIS section IDs to the field prefixes and which fields to auto-fill
const SECTION_FIELD_MAP: Record<string, { nameField: string; companyField?: string; phoneField?: string; emailField?: string; addressField?: string; extras?: Record<string, string> }> = {
  gc: { nameField: "gc_name", companyField: "gc_company", phoneField: "gc_phone", emailField: "gc_email", addressField: "gc_address" },
  owner: { nameField: "owner_name", companyField: "owner_company", phoneField: "owner_phone", emailField: "owner_email", addressField: "owner_address" },
  applicant: { nameField: "applicant_name", companyField: "applicant_business_name", phoneField: "applicant_phone", emailField: "applicant_email", addressField: "applicant_business_address" },
  sia: { nameField: "sia_name", companyField: "sia_company", phoneField: "sia_phone", emailField: "sia_email" },
  tpp: { nameField: "tpp_name", emailField: "tpp_email" },
};

export function usePISContactOptions() {
  const { data: clients = [] } = useQuery({
    queryKey: ["pis-autofill-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, email, phone, address, client_type")
        .order("name");
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["pis-autofill-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_contacts")
        .select("id, name, first_name, last_name, email, phone, mobile, company_name, title, address_1, city, state, zip")
        .order("name");
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Build options per section
  const getOptionsForSection = useMemo(() => {
    return (sectionId: string, query: string): ContactOption[] => {
      const mapping = SECTION_FIELD_MAP[sectionId];
      if (!mapping) return [];
      const q = query.toLowerCase().trim();

      const clientOpts: ContactOption[] = clients
        .filter(c => !q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
        .slice(0, 6)
        .map(c => ({
          id: `client-${c.id}`,
          label: c.name,
          sublabel: c.client_type || undefined,
          source: "client" as const,
          fields: {
            ...(mapping.companyField ? { [mapping.companyField]: c.name } : {}),
            ...(mapping.emailField && c.email ? { [mapping.emailField]: c.email } : {}),
            ...(mapping.phoneField && c.phone ? { [mapping.phoneField]: c.phone } : {}),
            ...(mapping.addressField && c.address ? { [mapping.addressField]: c.address } : {}),
          },
        }));

      const contactOpts: ContactOption[] = contacts
        .filter(c => !q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.company_name?.toLowerCase().includes(q))
        .slice(0, 6)
        .map(c => {
          const fullAddress = [c.address_1, c.city, c.state, c.zip].filter(Boolean).join(", ");
          return {
            id: `contact-${c.id}`,
            label: c.name,
            sublabel: c.company_name || c.title || undefined,
            source: "contact" as const,
            fields: {
              [mapping.nameField]: c.name,
              ...(mapping.companyField && c.company_name ? { [mapping.companyField]: c.company_name } : {}),
              ...(mapping.emailField && c.email ? { [mapping.emailField]: c.email } : {}),
              ...(mapping.phoneField && (c.phone || c.mobile) ? { [mapping.phoneField]: c.phone || c.mobile || "" } : {}),
              ...(mapping.addressField && fullAddress ? { [mapping.addressField]: fullAddress } : {}),
            },
          };
        });

      return [...contactOpts, ...clientOpts];
    };
  }, [clients, contacts]);

  return { getOptionsForSection, sectionFieldMap: SECTION_FIELD_MAP };
}

/** Extract section-level fields from prior PIS responses */
export function getPriorSectionFields(
  priorResponses: Record<string, any>,
  sectionId: string
): Record<string, string> | null {
  const mapping = SECTION_FIELD_MAP[sectionId];
  if (!mapping) return null;

  const fields: Record<string, string> = {};
  const allFieldIds = Object.values(mapping).filter((v): v is string => typeof v === "string");

  for (const fieldId of allFieldIds) {
    const prefixed = `${sectionId}_${fieldId}`;
    const val = priorResponses[prefixed] ?? priorResponses[fieldId];
    if (val) fields[fieldId] = String(val);
  }

  return Object.keys(fields).length > 0 ? fields : null;
}
