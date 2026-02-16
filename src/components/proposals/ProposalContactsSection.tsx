import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, UserPlus, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContactRole, ProposalContactInput } from "@/hooks/useProposalContacts";
import type { Client } from "@/hooks/useClients";

const ROLE_OPTIONS: { value: ContactRole; label: string }[] = [
  { value: "bill_to", label: "Bill To" },
  { value: "sign", label: "Signer" },
  { value: "cc", label: "CC" },
];

interface ProposalContactsSectionProps {
  contacts: ProposalContactInput[];
  onChange: (contacts: ProposalContactInput[]) => void;
  clients: Client[];
  onAddClient: (name: string, email: string) => Promise<Client>;
  isAddingClient: boolean;
}

/* ─── Inline Company Combobox ─── */
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
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = clients.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <div className="relative">
        <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Company name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="h-9 text-sm pl-8"
        />
      </div>
      {open && (search.length > 0 || clients.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full z-50 w-full bg-popover border rounded-md shadow-lg mt-1 max-h-[200px] overflow-y-auto"
        >
          {filtered.length > 0 ? (
            filtered.map((client) => (
              <button
                key={client.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between border-b last:border-0"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(client);
                  setSearch(client.name);
                  setOpen(false);
                }}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{client.name}</div>
                  {client.email && (
                    <div className="text-xs text-muted-foreground truncate">{client.email}</div>
                  )}
                </div>
              </button>
            ))
          ) : null}
          {search.trim() && !filtered.some(c => c.name.toLowerCase() === search.toLowerCase()) && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-accent font-medium border-t"
              onMouseDown={(e) => {
                e.preventDefault();
                onAddNew(search.trim());
                setOpen(false);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add "{search.trim()}" as new company
            </button>
          )}
          {!search.trim() && filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Type to search companies</div>
          )}
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
  const addContact = () => {
    onChange([
      ...contacts,
      { name: "", email: "", phone: "", company_name: "", role: "bill_to" },
    ]);
  };

  const removeContact = (index: number) => {
    onChange(contacts.filter((_, i) => i !== index));
  };

  const updateContact = (
    index: number,
    updates: Partial<ProposalContactInput>
  ) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const handleSelectCompany = (index: number, client: Client) => {
    updateContact(index, {
      client_id: client.id,
      company_name: client.name,
      email: client.email || contacts[index].email || "",
      phone: client.phone || contacts[index].phone || "",
    });
  };

  const handleAddNewCompany = async (index: number, name: string) => {
    try {
      const newClient = await onAddClient(name, "");
      handleSelectCompany(index, newClient);
    } catch {
      // error handled by parent
    }
  };

  // Find the first "bill_to" contact to enable "same as" feature
  const billToContact = contacts.find(c => c.role === "bill_to");

  const copyFromBillTo = (index: number) => {
    if (!billToContact) return;
    updateContact(index, {
      name: billToContact.name,
      email: billToContact.email,
      phone: billToContact.phone,
      company_name: billToContact.company_name,
      client_id: billToContact.client_id,
    });
  };

  const isSameAsBillTo = (contact: ProposalContactInput) => {
    if (!billToContact || contact.role === "bill_to") return false;
    return (
      contact.name === billToContact.name &&
      contact.email === billToContact.email &&
      contact.company_name === billToContact.company_name
    );
  };

  return (
    <div className="space-y-4">
      {contacts.length === 0 && (
        <div className="border border-dashed rounded-lg p-5 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Add the people involved — who gets the proposal, who pays, and who signs.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={addContact}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </div>
      )}

      {contacts.map((contact, index) => (
        <div key={index} className="border rounded-lg overflow-hidden bg-card">
          {/* Header row: Role + Name + Delete */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 border-b">
            <Select
              value={contact.role}
              onValueChange={(val) => updateContact(index, { role: val as ContactRole })}
            >
              <SelectTrigger className="w-[90px] h-8 text-xs font-semibold border-0 bg-background shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Contact name *"
              value={contact.name || ""}
              onChange={(e) => updateContact(index, { name: e.target.value })}
              className="h-8 text-sm flex-1 font-medium border-0 shadow-none bg-transparent focus-visible:ring-1"
              autoFocus={!contact.name && index === contacts.length - 1}
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

          {/* "Same as Bill To" checkbox for non-bill-to contacts */}
          {contact.role !== "bill_to" && billToContact && billToContact.name && (
            <div className="px-4 pt-3 pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={isSameAsBillTo(contact)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      copyFromBillTo(index);
                    } else {
                      updateContact(index, { name: "", email: "", phone: "", company_name: "", client_id: undefined });
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  Same as Bill To ({billToContact.name})
                </span>
              </label>
            </div>
          )}

          {/* Detail fields */}
          {!isSameAsBillTo(contact) && (
            <div className="px-4 py-3 space-y-3">
              <CompanyCombobox
                value={contact.company_name || ""}
                clients={clients}
                onSelect={(client) => handleSelectCompany(index, client)}
                onAddNew={(name) => handleAddNewCompany(index, name)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Email"
                  type="email"
                  value={contact.email || ""}
                  onChange={(e) => updateContact(index, { email: e.target.value })}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="Phone"
                  value={contact.phone || ""}
                  onChange={(e) => updateContact(index, { phone: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}

          {/* Linked indicator */}
          {contact.client_id && !isSameAsBillTo(contact) && (
            <div className="px-4 pb-3">
              <span className="text-xs text-accent inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                Linked to {clients.find(c => c.id === contact.client_id)?.name || "company"}
              </span>
            </div>
          )}
        </div>
      ))}

      {contacts.length > 0 && (
        <Button type="button" variant="outline" size="sm" className="w-full border-dashed" onClick={addContact}>
          <Plus className="h-4 w-4 mr-2" />
          Add Another Contact
        </Button>
      )}
    </div>
  );
}
