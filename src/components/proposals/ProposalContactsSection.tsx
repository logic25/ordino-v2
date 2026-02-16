import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, UserPlus, Link2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContactRole, ProposalContactInput } from "@/hooks/useProposalContacts";
import type { Client } from "@/hooks/useClients";

const ROLE_OPTIONS: { value: ContactRole; label: string; description: string }[] = [
  { value: "bill_to", label: "Bill To", description: "Receives the invoice" },
  { value: "sign", label: "Signer", description: "Signs the proposal" },
  { value: "cc", label: "CC", description: "Gets a copy" },
];

interface ProposalContactsSectionProps {
  contacts: ProposalContactInput[];
  onChange: (contacts: ProposalContactInput[]) => void;
  clients: Client[];
  onAddClient: (name: string, email: string) => Promise<Client>;
  isAddingClient: boolean;
}

export function ProposalContactsSection({
  contacts,
  onChange,
  clients,
  onAddClient,
  isAddingClient,
}: ProposalContactsSectionProps) {
  const [linkingIndex, setLinkingIndex] = useState<number | null>(null);

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
    field: keyof ProposalContactInput,
    value: string
  ) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const linkToClient = (index: number, client: Client) => {
    const updated = [...contacts];
    updated[index] = {
      ...updated[index],
      client_id: client.id,
      name: client.name,
      email: client.email || updated[index].email || "",
      phone: client.phone || updated[index].phone || "",
    };
    onChange(updated);
    setLinkingIndex(null);
  };

  return (
    <div className="space-y-3">
      {contacts.length === 0 && (
        <div className="border border-dashed rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            No contacts added yet. Add the people involved in this proposal.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={addContact}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add First Contact
          </Button>
        </div>
      )}

      {contacts.map((contact, index) => (
        <div key={index} className="border rounded-lg p-3 space-y-2.5 bg-card">
          {/* Row 1: Role badge + Name + Delete */}
          <div className="flex items-center gap-2">
            <Select
              value={contact.role}
              onValueChange={(val) => updateContact(index, "role", val)}
            >
              <SelectTrigger className="w-[100px] h-8 text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <span>{opt.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Full name *"
              value={contact.name || ""}
              onChange={(e) => updateContact(index, "name", e.target.value)}
              className="h-8 text-sm flex-1 font-medium"
              autoFocus={!contact.name && index === contacts.length - 1}
            />

            {/* Link to existing client */}
            <Popover
              open={linkingIndex === index}
              onOpenChange={(open) => setLinkingIndex(open ? index : null)}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8 shrink-0", contact.client_id ? "text-accent" : "text-muted-foreground")}
                  title={contact.client_id ? "Linked to company" : "Link to existing company"}
                >
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search companies…" />
                  <CommandList>
                    <CommandEmpty className="p-2 text-xs text-center text-muted-foreground">
                      No companies found
                    </CommandEmpty>
                    <CommandGroup>
                      {clients.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => linkToClient(index, c)}
                        >
                          <Check className={cn("mr-2 h-3 w-3", contact.client_id === c.id ? "opacity-100" : "opacity-0")} />
                          <span className="text-xs truncate">{c.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

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

          {/* Row 2: Company, Email, Phone — inline */}
          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="Company"
              value={contact.company_name || ""}
              onChange={(e) => updateContact(index, "company_name", e.target.value)}
              className="h-7 text-xs"
            />
            <Input
              placeholder="Email"
              type="email"
              value={contact.email || ""}
              onChange={(e) => updateContact(index, "email", e.target.value)}
              className="h-7 text-xs"
            />
            <Input
              placeholder="Phone"
              value={contact.phone || ""}
              onChange={(e) => updateContact(index, "phone", e.target.value)}
              className="h-7 text-xs"
            />
          </div>

          {/* Linked indicator */}
          {contact.client_id && (
            <p className="text-xs text-accent flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              Linked to {clients.find(c => c.id === contact.client_id)?.name || "company"}
            </p>
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
