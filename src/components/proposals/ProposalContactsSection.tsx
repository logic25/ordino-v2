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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ChevronsUpDown, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContactRole, ProposalContactInput } from "@/hooks/useProposalContacts";
import type { Client } from "@/hooks/useClients";

const ROLE_LABELS: Record<ContactRole, string> = {
  bill_to: "Bill To",
  sign: "Sign",
  cc: "CC",
};

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
  const [clientPopoverOpen, setClientPopoverOpen] = useState<number | null>(null);
  const [newClientDialog, setNewClientDialog] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  const addContact = () => {
    onChange([
      ...contacts,
      { name: "", email: "", phone: "", company_name: "", role: "cc" },
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

  const selectClient = (index: number, client: Client) => {
    const updated = [...contacts];
    updated[index] = {
      ...updated[index],
      client_id: client.id,
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      company_name: "",
    };
    onChange(updated);
    setClientPopoverOpen(null);
  };

  const handleAddNewClient = async () => {
    if (!newClientName.trim()) return;
    try {
      const client = await onAddClient(newClientName, newClientEmail);
      if (pendingIndex !== null) {
        selectClient(pendingIndex, client);
      }
      setNewClientDialog(false);
      setNewClientName("");
      setNewClientEmail("");
      setPendingIndex(null);
    } catch {
      // toast handled by parent
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Contacts</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addContact}>
          <Plus className="h-4 w-4 mr-1" />
          Add Contact
        </Button>
      </div>

      {contacts.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add contacts with roles (Bill To, Sign, CC).
        </p>
      )}

      <div className="space-y-2">
        {contacts.map((contact, index) => (
          <div key={index} className="border rounded-md p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Select
                value={contact.role}
                onValueChange={(val) => updateContact(index, "role", val)}
              >
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_LABELS) as [ContactRole, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>

              <Popover
                open={clientPopoverOpen === index}
                onOpenChange={(open) => setClientPopoverOpen(open ? index : null)}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="flex-1 justify-between h-8 text-xs font-normal"
                  >
                    {contact.name || "Search contacts…"}
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name…" />
                    <CommandList>
                      <CommandEmpty className="p-0">
                        <button
                          type="button"
                          className="w-full px-3 py-2.5 text-xs text-left hover:bg-accent flex items-center gap-2"
                          onClick={() => {
                            setPendingIndex(index);
                            setClientPopoverOpen(null);
                            setNewClientDialog(true);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                          Add new contact
                        </button>
                      </CommandEmpty>
                      <CommandGroup>
                        {clients.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => selectClient(index, c)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3 w-3",
                                contact.client_id === c.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="text-xs">
                              {c.name}
                              {c.email && (
                                <span className="text-muted-foreground ml-1">({c.email})</span>
                              )}
                            </span>
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
                className="h-8 w-8 shrink-0"
                onClick={() => removeContact(index)}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
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
              <Input
                placeholder="Company"
                value={contact.company_name || ""}
                onChange={(e) => updateContact(index, "company_name", e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          </div>
        ))}
      </div>

      {/* New Client Dialog */}
      <Dialog open={newClientDialog} onOpenChange={setNewClientDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Contact name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                placeholder="Email (optional)"
                type="email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewClientDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddNewClient}
              disabled={isAddingClient || !newClientName.trim()}
            >
              {isAddingClient ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
