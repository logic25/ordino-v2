import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, UserPlus, Building2, User, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { ContactRole, ProposalContactInput } from "@/hooks/useProposalContacts";
import type { Client } from "@/hooks/useClients";

const ROLE_OPTIONS: { value: ContactRole; label: string }[] = [
  { value: "bill_to", label: "Bill To" },
  { value: "sign", label: "Signer" },
  { value: "cc", label: "CC" },
];

interface ClientContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface MultiRoleContact extends Omit<ProposalContactInput, "role"> {
  roles: ContactRole[];
}

interface ProposalContactsSectionProps {
  contacts: ProposalContactInput[];
  onChange: (contacts: ProposalContactInput[]) => void;
  clients: Client[];
  onAddClient: (name: string, email: string) => Promise<Client>;
  isAddingClient: boolean;
}

function groupContacts(contacts: ProposalContactInput[]): MultiRoleContact[] {
  const map = new Map<string, MultiRoleContact>();
  contacts.forEach((c) => {
    const key = `${c.name || ""}|||${c.email || ""}|||${c.company_name || ""}`;
    const existing = map.get(key);
    if (existing) {
      if (!existing.roles.includes(c.role)) existing.roles.push(c.role);
      if (!existing.client_id && c.client_id) existing.client_id = c.client_id;
    } else {
      map.set(key, { ...c, roles: [c.role] });
    }
  });
  return Array.from(map.values());
}

function flattenContacts(grouped: MultiRoleContact[]): ProposalContactInput[] {
  const flat: ProposalContactInput[] = [];
  grouped.forEach((g) => {
    g.roles.forEach((role) => {
      flat.push({
        client_id: g.client_id,
        name: g.name,
        email: g.email,
        phone: g.phone,
        company_name: g.company_name,
        role,
      });
    });
  });
  return flat;
}

/* ─── Company Combobox ─── */
function CompanyCombobox({
  value,
  onSelect,
  onAddNew,
  clients,
}: {
  value: string;
  onSelect: (client: Client) => void;
  onAddNew: (name: string) => void;
  clients: Client[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative flex-1">
      <div className="relative">
        <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Search company…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="h-8 text-sm pl-8"
        />
      </div>
      {open && (search.length > 0 || clients.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full z-50 w-full bg-popover border rounded-md shadow-lg mt-1 max-h-[220px] overflow-y-auto"
        >
          {filtered.map((client) => (
            <button
              key={client.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted truncate"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(client);
                setSearch(client.name);
                setOpen(false);
              }}
            >
              {client.name}
            </button>
          ))}
          {search.trim() && !filtered.some(c => c.name.toLowerCase() === search.toLowerCase()) && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-accent font-medium flex items-center gap-1.5 border-t"
              onMouseDown={(e) => {
                e.preventDefault();
                onAddNew(search.trim());
                setOpen(false);
              }}
            >
              <Plus className="h-3 w-3" /> Add "{search.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Contact Picker (loads contacts for a selected company) ─── */
function ContactPicker({
  clientId,
  value,
  onSelect,
  onAddNew,
}: {
  clientId: string;
  value: string;
  onSelect: (contact: ClientContact) => void;
  onAddNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  // Fetch contacts when clientId changes
  useEffect(() => {
    if (!clientId) { setContacts([]); return; }
    setLoading(true);
    supabase
      .from("client_contacts")
      .select("id, name, email, phone")
      .eq("client_id", clientId)
      .order("is_primary", { ascending: false })
      .order("name")
      .then(({ data }) => {
        setContacts((data || []) as ClientContact[]);
        setLoading(false);
      });
  }, [clientId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <div className="relative">
        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Select or type contact name…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="h-8 text-sm pl-8"
        />
        {contacts.length > 0 && (
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        )}
      </div>
      {open && (contacts.length > 0 || search.trim()) && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full z-50 w-full bg-popover border rounded-md shadow-lg mt-1 max-h-[200px] overflow-y-auto"
        >
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Loading contacts…</div>
          )}
          {!loading && filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex flex-col"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(c);
                setSearch(c.name);
                setOpen(false);
              }}
            >
              <span className="font-medium">{c.name}</span>
              {c.email && <span className="text-xs text-muted-foreground">{c.email}</span>}
            </button>
          ))}
          {!loading && filtered.length === 0 && contacts.length > 0 && search.trim() && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">No matching contacts</div>
          )}
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-accent font-medium flex items-center gap-1.5 border-t"
            onMouseDown={(e) => {
              e.preventDefault();
              onAddNew();
              setOpen(false);
            }}
          >
            <Plus className="h-3 w-3" /> Add new contact
          </button>
        </div>
      )}
    </div>
  );
}

export function ProposalContactsSection({
  contacts,
  onChange,
  clients,
  onAddClient,
  isAddingClient,
}: ProposalContactsSectionProps) {
  const grouped = groupContacts(contacts);

  const emit = (updated: MultiRoleContact[]) => onChange(flattenContacts(updated));

  const addContact = () => {
    emit([...grouped, { name: "", email: "", phone: "", company_name: "", roles: ["bill_to"] }]);
  };

  const removeContact = (index: number) => {
    emit(grouped.filter((_, i) => i !== index));
  };

  const updateContact = (index: number, updates: Partial<MultiRoleContact>) => {
    const updated = [...grouped];
    updated[index] = { ...updated[index], ...updates };
    emit(updated);
  };

  const toggleRole = (index: number, role: ContactRole) => {
    const current = grouped[index].roles;
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    if (next.length === 0) return;
    updateContact(index, { roles: next });
  };

  const handleSelectCompany = (index: number, client: Client) => {
    updateContact(index, {
      client_id: client.id,
      company_name: client.name,
      // Clear contact fields so user picks from the contact list
      name: "",
      email: "",
      phone: "",
    });
  };

  const handleSelectContact = (index: number, contact: ClientContact) => {
    updateContact(index, {
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
    });
  };

  const handleAddNewCompany = async (index: number, name: string) => {
    try {
      const newClient = await onAddClient(name, "");
      handleSelectCompany(index, newClient);
    } catch { /* handled by parent */ }
  };

  if (grouped.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">
          Add contacts — who gets the proposal, who pays, and who signs.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={addContact}>
          <UserPlus className="h-4 w-4 mr-2" /> Add Contact
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grouped.map((contact, index) => (
        <div key={index} className="border rounded-lg bg-card">
          {/* Row 1: Company search + Delete */}
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <CompanyCombobox
              value={contact.company_name || ""}
              clients={clients}
              onSelect={(client) => handleSelectCompany(index, client)}
              onAddNew={(name) => handleAddNewCompany(index, name)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeContact(index)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Row 2: Contact picker (if company selected) or manual name */}
          <div className="px-3 pb-2">
            {contact.client_id ? (
              <ContactPicker
                clientId={contact.client_id}
                value={contact.name || ""}
                onSelect={(c) => handleSelectContact(index, c)}
                onAddNew={() => updateContact(index, { name: "", email: "", phone: "" })}
              />
            ) : (
              <Input
                placeholder="Contact name *"
                value={contact.name || ""}
                onChange={(e) => updateContact(index, { name: e.target.value })}
                className="h-8 text-sm font-medium"
                autoFocus={!contact.name && index === grouped.length - 1}
              />
            )}
          </div>

          {/* Row 3: Email + Phone */}
          <div className="px-3 pb-2 grid grid-cols-2 gap-2">
            <Input
              placeholder="Email"
              type="email"
              value={contact.email || ""}
              onChange={(e) => updateContact(index, { email: e.target.value })}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Phone"
              value={contact.phone || ""}
              onChange={(e) => updateContact(index, { phone: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          {/* Row 4: Roles */}
          <div className="flex items-center gap-5 px-3 pb-3 border-t pt-2">
            {ROLE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={contact.roles.includes(opt.value)}
                  onCheckedChange={() => toggleRole(index, opt.value)}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs text-muted-foreground">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="w-full border-dashed" onClick={addContact}>
        <Plus className="h-4 w-4 mr-2" /> Add Another Contact
      </Button>
    </div>
  );
}
