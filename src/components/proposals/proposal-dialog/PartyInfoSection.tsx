import React, { useState, useEffect } from "react";
import { formatPhoneNumber } from "@/lib/formatters";
import { ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

/* ─── Party Company Combobox ─── */
function PartyCompanyCombobox({ value, onChange, onSelect, clients, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (client: any) => void;
  clients: any[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes((value || "").toLowerCase())
  ).slice(0, 10);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          className="h-8 text-sm pr-7"
          placeholder={placeholder}
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[9999] w-[280px] bg-popover border rounded-md shadow-xl max-h-[200px] overflow-y-auto">
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center border-b last:border-0"
              onMouseDown={(e) => { e.preventDefault(); onSelect(c); setOpen(false); }}
            >
              <span className="truncate">{c.name}</span>
              {c.client_type && <span className="text-xs text-muted-foreground ml-2">{c.client_type}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Party Info Section ─── */

interface PartyField {
  name: string;
  label: string;
  placeholder: string;
  isCompany?: boolean;
  isPhone?: boolean;
  isLicenseType?: boolean;
}

interface PartyConfig {
  key: string;
  label: string;
  fields: PartyField[];
}

const PARTIES: PartyConfig[] = [
  { key: "architect", label: "Architect / Engineer", fields: [
    { name: "architect_company", label: "Company", placeholder: "Firm name", isCompany: true },
    { name: "architect_name", label: "Contact Name", placeholder: "Full name" },
    { name: "architect_phone", label: "Phone", placeholder: "(555) 000-0000", isPhone: true },
    { name: "architect_email", label: "Email", placeholder: "email@firm.com" },
    { name: "architect_license_type", label: "License Type", placeholder: "Select…", isLicenseType: true },
    { name: "architect_license_number", label: "License #", placeholder: "License number" },
  ]},
  { key: "gc", label: "General Contractor", fields: [
    { name: "gc_company", label: "Company", placeholder: "Company name", isCompany: true },
    { name: "gc_name", label: "Contact Name", placeholder: "Full name" },
    { name: "gc_phone", label: "Phone", placeholder: "(555) 000-0000", isPhone: true },
    { name: "gc_email", label: "Email", placeholder: "email@company.com" },
  ]},
  { key: "sia", label: "Special Inspector (SIA)", fields: [
    { name: "sia_company", label: "Company", placeholder: "Inspection firm", isCompany: true },
    { name: "sia_name", label: "Contact Name", placeholder: "Full name" },
    { name: "sia_phone", label: "Phone", placeholder: "(555) 000-0000", isPhone: true },
    { name: "sia_email", label: "Email", placeholder: "email@company.com" },
  ]},
  { key: "tpp", label: "Third Party Provider (TPP)", fields: [
    { name: "tpp_name", label: "Name", placeholder: "Full name" },
    { name: "tpp_email", label: "Email", placeholder: "email@provider.com" },
  ]},
];

export function PartyInfoSection({ form, clients }: { form: any; clients: any[] }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSelectClient = async (client: any, prefix: string) => {
    const opts = { shouldDirty: true };
    form.setValue(`${prefix}_company`, client.name, opts);
    const { data: primaryContacts } = await supabase
      .from("client_contacts")
      .select("name, first_name, last_name, email, phone, license_type, license_number")
      .eq("client_id", client.id)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(1);
    const contact = primaryContacts?.[0];
    if (contact) {
      const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.name;
      form.setValue(`${prefix}_name`, contactName, opts);
      if (contact.email) form.setValue(`${prefix}_email`, contact.email, opts);
      if (contact.phone) form.setValue(`${prefix}_phone`, formatPhoneNumber(contact.phone), opts);
      if (prefix === "architect") {
        if (contact.license_type) form.setValue("architect_license_type", contact.license_type, opts);
        if (contact.license_number) form.setValue("architect_license_number", contact.license_number, opts);
      }
    }
  };

  return (
    <div className="space-y-1">
      {PARTIES.map(party => {
        const isOpen = openSections[party.key] || false;
        const hasData = party.fields.some(f => form.watch(f.name));
        return (
          <div key={party.key} className="border rounded-lg">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              onClick={() => toggle(party.key)}
            >
              <span className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="font-medium">{party.label}</span>
                {hasData && <span className="text-xs text-accent">✓ Info entered</span>}
              </span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
                <div className={cn("grid gap-2", party.fields.length <= 2 ? "grid-cols-2" : "grid-cols-3")}>
                  {party.fields.map(field => (
                    <div key={field.name} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{field.label}</Label>
                      {field.isCompany ? (
                        <PartyCompanyCombobox
                          value={form.watch(field.name) || ""}
                          onChange={(v) => form.setValue(field.name, v, { shouldDirty: true })}
                          onSelect={(client) => handleSelectClient(client, party.key)}
                          clients={clients}
                          placeholder={field.placeholder}
                        />
                      ) : field.isLicenseType ? (
                        <Select
                          value={form.watch(field.name) || ""}
                          onValueChange={(v) => form.setValue(field.name, v, { shouldDirty: true })}
                        >
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="RA">RA (Registered Architect)</SelectItem>
                            <SelectItem value="PE">PE (Professional Engineer)</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : field.isPhone ? (
                        <Input
                          className="h-8 text-sm"
                          placeholder={field.placeholder}
                          value={form.watch(field.name) || ""}
                          onChange={(e) => {
                            const formatted = formatPhoneNumber(e.target.value);
                            form.setValue(field.name, formatted, { shouldDirty: true });
                          }}
                        />
                      ) : (
                        <Input className="h-8 text-sm" placeholder={field.placeholder} {...form.register(field.name)} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
