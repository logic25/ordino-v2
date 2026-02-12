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
import { Plus, Trash2 } from "lucide-react";
import type { ContactRole, ProposalContactInput } from "@/hooks/useProposalContacts";

const ROLE_LABELS: Record<ContactRole, string> = {
  bill_to: "Bill To",
  sign: "Sign",
  cc: "CC",
};

interface ProposalContactsSectionProps {
  contacts: ProposalContactInput[];
  onChange: (contacts: ProposalContactInput[]) => void;
}

export function ProposalContactsSection({
  contacts,
  onChange,
}: ProposalContactsSectionProps) {
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Contacts</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addContact}>
          <Plus className="h-4 w-4 mr-1" />
          Add Contact
        </Button>
      </div>

      {contacts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No contacts added yet. Add contacts with roles like Bill To, Sign, or CC.
        </p>
      )}

      {contacts.map((contact, index) => (
        <div
          key={index}
          className="border rounded-lg p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <Select
              value={contact.role}
              onValueChange={(val) => updateContact(index, "role", val)}
            >
              <SelectTrigger className="w-[120px]">
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
            <Input
              placeholder="Name"
              value={contact.name}
              onChange={(e) => updateContact(index, "name", e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => removeContact(index)}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="Email"
              type="email"
              value={contact.email || ""}
              onChange={(e) => updateContact(index, "email", e.target.value)}
            />
            <Input
              placeholder="Phone"
              value={contact.phone || ""}
              onChange={(e) => updateContact(index, "phone", e.target.value)}
            />
            <Input
              placeholder="Company"
              value={contact.company_name || ""}
              onChange={(e) =>
                updateContact(index, "company_name", e.target.value)
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}
