import { useState, useEffect, useRef } from "react";

interface PISContactResult {
  id: string;
  type: "contact" | "client";
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
  license_type?: string;
  license_number?: string;
  specialty?: string;
}

// Maps a contact result to PIS form field keys for a given section
export function mapContactToFields(
  contact: PISContactResult,
  sectionId: string,
  subSection: "gc" | "sia" | "tpp" | "owner" | "applicant"
): Record<string, string> {
  const fields: Record<string, string> = {};

  if (subSection === "gc") {
    if (contact.name) fields[`${sectionId}_gc_name`] = contact.name;
    if (contact.company_name) fields[`${sectionId}_gc_company`] = contact.company_name;
    if (contact.phone) fields[`${sectionId}_gc_phone`] = (contact.phone || "").replace(/\D/g, "");
    if (contact.email) fields[`${sectionId}_gc_email`] = contact.email;
    if (contact.address) fields[`${sectionId}_gc_address`] = contact.address;
  } else if (subSection === "sia") {
    if (contact.name) fields[`${sectionId}_sia_name`] = contact.name;
    if (contact.company_name) fields[`${sectionId}_sia_company`] = contact.company_name;
    if (contact.phone) fields[`${sectionId}_sia_phone`] = (contact.phone || "").replace(/\D/g, "");
    if (contact.email) fields[`${sectionId}_sia_email`] = contact.email;
    if (contact.license_number) fields[`${sectionId}_sia_number`] = contact.license_number;
    if (contact.license_type === "PE" || contact.license_type === "RA") {
      fields[`${sectionId}_sia_nys_lic`] = contact.license_number || "";
    }
  } else if (subSection === "tpp") {
    if (contact.name) fields[`${sectionId}_tpp_name`] = contact.name;
    if (contact.email) fields[`${sectionId}_tpp_email`] = contact.email;
  } else if (subSection === "owner") {
    if (contact.name) fields[`${sectionId}_owner_name`] = contact.name;
    if (contact.company_name) fields[`${sectionId}_owner_company`] = contact.company_name;
    if (contact.email) fields[`${sectionId}_owner_email`] = contact.email;
    if (contact.phone) fields[`${sectionId}_owner_phone`] = (contact.phone || "").replace(/\D/g, "");
    if (contact.address) fields[`${sectionId}_owner_address`] = contact.address;
  } else if (subSection === "applicant") {
    const firstName = contact.first_name || contact.name?.split(" ")[0] || "";
    const lastName = contact.last_name || contact.name?.split(" ").slice(1).join(" ") || "";
    if (firstName) fields[`${sectionId}_applicant_first_name`] = firstName;
    if (lastName) fields[`${sectionId}_applicant_last_name`] = lastName;
    if (contact.company_name) fields[`${sectionId}_applicant_business_name`] = contact.company_name;
    if (contact.phone) fields[`${sectionId}_applicant_phone`] = (contact.phone || "").replace(/\D/g, "");
    if (contact.email) fields[`${sectionId}_applicant_email`] = contact.email;
    if (contact.address) fields[`${sectionId}_applicant_business_address`] = contact.address;
    if (contact.license_type) fields[`${sectionId}_applicant_lic_type`] = contact.license_type;
    if (contact.license_number) fields[`${sectionId}_applicant_nys_lic`] = contact.license_number;
  }

  return fields;
}

export function usePISContactSuggestions(token: string | null, query: string) {
  const [results, setResults] = useState<PISContactResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    if (!token || !query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const url = `https://${projectId}.supabase.co/functions/v1/pis-contact-search`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, query: query.trim() }),
          signal: abortRef.current.signal,
        });
        if (resp.ok) {
          const data = await resp.json();
          setResults(data.results || []);
        } else {
          setResults([]);
        }
      } catch (e: any) {
        if (e.name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [token, query]);

  return { results, loading };
}
