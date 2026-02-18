import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, UserPlus, Building2, User, ChevronDown, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import type { ContactRole, ProposalContactInput } from "@/hooks/useProposalContacts";
import type { Client } from "@/hooks/useClients";

const ROLE_OPTIONS: { value: ContactRole; label: string }[] = [
  { value: "bill_to", label: "Bill To" },
  { value: "sign", label: "Signer" },
  { value: "applicant", label: "Applicant" },
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

/* ─── Unified Company + Contact Combobox ─── */
function CompanyCombobox({
  value,
  onSelect,
  onAddNew,
  clients,
  onSelectContact,
}: {
  value: string;
  onSelect: (client: Client) => void;
  onAddNew: (name: string) => void;
  clients: Client[];
  onSelectContact?: (contact: ClientContact & { client_id: string; company_name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [contactResults, setContactResults] = useState<(ClientContact & { client_id: string; company_name: string })[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    if (search.length < 2) { setContactResults([]); return; }
    const q = search.trim();
    supabase
      .from("client_contacts")
      .select("id, name, email, phone, client_id, company_name")
      .or(`name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`)
      .limit(6)
      .then(({ data }) => {
        setContactResults((data || []) as any);
      });
  }, [search]);

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

  const filteredCompanies = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="relative flex-1">
      <div className="relative">
        <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Search company or contact…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="h-8 text-sm pl-8"
        />
      </div>
      {open && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full z-50 w-full bg-popover border rounded-md shadow-lg mt-1 max-h-[280px] overflow-y-auto"
        >
          {filteredCompanies.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">Companies</div>
              {filteredCompanies.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted truncate flex items-center gap-2"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(client);
                    setSearch(client.name);
                    setOpen(false);
                  }}
                >
                  <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                  {client.name}
                </button>
              ))}
            </>
          )}
          {contactResults.length > 0 && onSelectContact && (
            <>
              <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 border-t">Contacts</div>
              {contactResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex flex-col"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelectContact(c);
                    setSearch(c.company_name || c.name);
                    setOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-medium">{c.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground pl-5">
                    {[c.company_name, c.email].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
            </>
          )}
          {search.trim() && !filteredCompanies.some(c => c.name.toLowerCase() === search.toLowerCase()) && (
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

  // Fetch contacts when clientId changes or search changes (global search when no clientId)
  useEffect(() => {
    if (clientId) {
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
    } else if (search.trim().length >= 2) {
      setLoading(true);
      const q = search.trim();
      supabase
        .from("client_contacts")
        .select("id, name, email, phone, client_id, company_name")
        .or(`name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`)
        .limit(8)
        .then(({ data }) => {
          setContacts((data || []) as ClientContact[]);
          setLoading(false);
        });
    } else if (!clientId) {
      setContacts([]);
    }
  }, [clientId, search]);

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
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = grouped.findIndex((_, i) => `contact-${i}` === active.id);
      const newIndex = grouped.findIndex((_, i) => `contact-${i}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        emit(arrayMove(grouped, oldIndex, newIndex));
      }
    }
  };

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={grouped.map((_, i) => `contact-${i}`)} strategy={verticalListSortingStrategy}>
          {grouped.map((contact, index) => (
            <SortableContactCard
              key={`contact-${index}`}
              id={`contact-${index}`}
              contact={contact}
              index={index}
              isLast={index === grouped.length - 1}
              clients={clients}
              onUpdate={(updates) => updateContact(index, updates)}
              onRemove={() => removeContact(index)}
              onToggleRole={(role) => toggleRole(index, role)}
              onSelectCompany={(client) => handleSelectCompany(index, client)}
              onSelectContact={(c) => handleSelectContact(index, c)}
              onAddNewCompany={(name) => handleAddNewCompany(index, name)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" size="sm" className="w-full border-dashed" onClick={addContact}>
        <Plus className="h-4 w-4 mr-2" /> Add Another Contact
      </Button>
    </div>
  );
}

/* ─── Sortable Contact Card ─── */
function SortableContactCard({
  id, contact, index, isLast, clients, onUpdate, onRemove, onToggleRole, onSelectCompany, onSelectContact, onAddNewCompany,
}: {
  id: string;
  contact: MultiRoleContact;
  index: number;
  isLast: boolean;
  clients: Client[];
  onUpdate: (updates: Partial<MultiRoleContact>) => void;
  onRemove: () => void;
  onToggleRole: (role: ContactRole) => void;
  onSelectCompany: (client: Client) => void;
  onSelectContact: (contact: ClientContact) => void;
  onAddNewCompany: (name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={cn("border rounded-lg bg-card", isDragging && "shadow-lg")}>
      {/* Row 1: Drag handle + Company search + Delete */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-2">
        <button type="button" className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <CompanyCombobox
          value={contact.company_name || ""}
          clients={clients}
          onSelect={onSelectCompany}
          onAddNew={onAddNewCompany}
          onSelectContact={(c) => {
            onUpdate({
              client_id: c.client_id,
              company_name: c.company_name || "",
              name: c.name,
              email: c.email || "",
              phone: c.phone || "",
            });
          }}
        />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Row 2: Contact picker (always a dropdown, works globally or scoped to company) */}
      <div className="px-3 pb-2 pl-9">
        <ContactPicker
          clientId={contact.client_id || ""}
          value={contact.name || ""}
          onSelect={(c) => {
            // If picked from global search (no client_id yet), back-fill company
            if (!contact.client_id && (c as any).client_id) {
              onUpdate({
                client_id: (c as any).client_id,
                company_name: (c as any).company_name || "",
                name: c.name,
                email: c.email || "",
                phone: c.phone || "",
              });
            } else {
              onSelectContact(c);
            }
          }}
          onAddNew={() => onUpdate({ name: "", email: "", phone: "" })}
        />
      </div>

      {/* Row 3: Email + Phone */}
      <div className="px-3 pb-2 pl-9 grid grid-cols-2 gap-2">
        <Input placeholder="Email" type="email" value={contact.email || ""} onChange={(e) => onUpdate({ email: e.target.value })} className="h-8 text-sm" />
        <Input placeholder="Phone" value={contact.phone || ""} onChange={(e) => onUpdate({ phone: e.target.value })} className="h-8 text-sm" />
      </div>

      {/* Row 4: Roles */}
      <div className="flex items-center gap-5 px-3 pb-3 pl-9 border-t pt-2">
        {ROLE_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={contact.roles.includes(opt.value)} onCheckedChange={() => onToggleRole(opt.value)} className="h-3.5 w-3.5" />
            <span className="text-xs text-muted-foreground">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
