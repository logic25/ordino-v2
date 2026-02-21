import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Building2, User, Plus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ReferredByComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  searchMode?: "all" | "contacts";
}

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: "company" | "contact";
}

export function ReferredByCombobox({
  value,
  onChange,
  placeholder = "Search companies or contacts...",
  className,
  searchMode = "all",
}: ReferredByComboboxProps) {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: companies = [] } = useQuery({
    queryKey: ["referral-companies"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      return data || [];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["referral-contacts"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_contacts")
        .select("id, name, company_name, email")
        .order("name");
      return data || [];
    },
  });

  const results = useMemo<SearchResult[]>(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];

    const companyResults: SearchResult[] = searchMode === "contacts" ? [] : companies
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((c) => ({ id: c.id, label: c.name, type: "company" as const }));

    const contactResults: SearchResult[] = contacts
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
      )
      .slice(0, searchMode === "contacts" ? 10 : 5)
      .map((c) => ({
        id: c.id,
        label: c.name,
        sublabel: c.company_name || c.email || undefined,
        type: "contact" as const,
      }));

    return [...companyResults, ...contactResults];
  }, [search, companies, contacts, searchMode]);

  const handleSelect = (result: SearchResult) => {
    onChange(result.label);
    setSearch("");
    setOpen(false);
  };

  const handleAddNew = () => {
    onChange(search.trim());
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setSearch("");
  };

  if (value) {
    return (
      <div className={`flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm ${className || ""}`}>
        <span className="flex-1 truncate">{value}</span>
        <button
          type="button"
          onClick={handleClear}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={`relative ${className || ""}`}>
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => search.trim() && setOpen(true)}
        placeholder={placeholder}
        className="h-9 text-sm"
      />
      {open && search.trim() && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[9999] rounded-md border bg-popover shadow-lg max-h-[220px] overflow-y-auto">
          {results.length > 0 ? (
            <>
              {results.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left transition-colors"
                  onClick={() => handleSelect(r)}
                >
                  {r.type === "company" ? (
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate">{r.label}</div>
                    {r.sublabel && (
                      <div className="text-xs text-muted-foreground truncate">{r.sublabel}</div>
                    )}
                  </div>
                </button>
              ))}
              <div className="border-t" />
            </>
          ) : null}
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left transition-colors text-primary"
            onClick={handleAddNew}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>Add "{search.trim()}"</span>
          </button>
        </div>
      )}
    </div>
  );
}
