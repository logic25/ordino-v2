import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ContactSuggestion {
  id: string;
  name: string;
  email: string;
  source: "ordino" | "gmail";
  company?: string;
}

export function useAllContacts() {
  return useQuery({
    queryKey: ["all-contacts-for-autocomplete"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("id, name, email, company_name")
        .not("email", "is", null)
        .order("name");
      if (error) throw error;
      return (data || []).filter((c) => c.email);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useContactSuggestions(query: string) {
  const { data: contacts = [] } = useAllContacts();

  const suggestions = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return contacts
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company_name?.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email!,
        source: "ordino" as const,
        company: c.company_name || undefined,
      }));
  }, [query, contacts]);

  return suggestions;
}
