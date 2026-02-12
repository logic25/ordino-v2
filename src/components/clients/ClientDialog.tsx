import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Star } from "lucide-react";
import type { Client, ClientFormInput, ClientContactInput } from "@/hooks/useClients";
import { useClientContacts } from "@/hooks/useClients";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof clientSchema>;

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ClientFormInput) => Promise<void>;
  client?: Client | null;
  isLoading?: boolean;
}

const emptyContact = (): ClientContactInput => ({
  name: "",
  title: "",
  email: "",
  phone: "",
  is_primary: false,
});

export function ClientDialog({
  open,
  onOpenChange,
  onSubmit,
  client,
  isLoading,
}: ClientDialogProps) {
  const isEditing = !!client;
  const { data: existingContacts = [] } = useClientContacts(client?.id);
  const [contacts, setContacts] = useState<ClientContactInput[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        notes: client.notes || "",
      });
    } else {
      form.reset({ name: "", email: "", phone: "", address: "", notes: "" });
    }
  }, [client, form]);

  useEffect(() => {
    if (isEditing && existingContacts.length > 0) {
      setContacts(
        existingContacts.map((c) => ({
          id: c.id,
          name: c.name,
          title: c.title || "",
          email: c.email || "",
          phone: c.phone || "",
          is_primary: c.is_primary,
        }))
      );
    } else if (!isEditing) {
      setContacts([]);
    }
  }, [existingContacts, isEditing]);

  const addContact = () => setContacts([...contacts, emptyContact()]);

  const removeContact = (idx: number) =>
    setContacts(contacts.filter((_, i) => i !== idx));

  const updateContact = (idx: number, field: keyof ClientContactInput, value: any) => {
    setContacts(
      contacts.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  };

  const setPrimary = (idx: number) => {
    setContacts(
      contacts.map((c, i) => ({ ...c, is_primary: i === idx }))
    );
  };

  const handleSubmit = async (data: FormData) => {
    // Filter out contacts with no name
    const validContacts = contacts.filter((c) => c.name.trim());
    await onSubmit({
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      notes: data.notes || null,
      contacts: validContacts,
    });
    form.reset();
    setContacts([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Client" : "New Client"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the client's information and contacts."
              : "Add a new client and their contacts."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Company / Client Name *</Label>
            <Input
              id="name"
              placeholder="e.g. Rudin Management"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Main Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="info@company.com"
                {...form.register("email")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Main Phone</Label>
              <Input
                id="phone"
                placeholder="(555) 123-4567"
                {...form.register("phone")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="Client address"
              {...form.register("address")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              rows={2}
              {...form.register("notes")}
            />
          </div>

          <Separator />

          {/* Contacts Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">
                Contacts
                {contacts.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {contacts.length}
                  </Badge>
                )}
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addContact}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Contact
              </Button>
            </div>

            {contacts.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">
                No contacts yet. Add people associated with this client.
              </p>
            )}

            <div className="space-y-3">
              {contacts.map((contact, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border bg-muted/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Contact {idx + 1}
                      </span>
                      {contact.is_primary && (
                        <Badge variant="default" className="text-xs h-5">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!contact.is_primary && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setPrimary(idx)}
                          title="Set as primary contact"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeContact(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Full name *"
                      value={contact.name}
                      onChange={(e) => updateContact(idx, "name", e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Title / Role"
                      value={contact.title || ""}
                      onChange={(e) => updateContact(idx, "title", e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={contact.email || ""}
                      onChange={(e) => updateContact(idx, "email", e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Phone"
                      value={contact.phone || ""}
                      onChange={(e) => updateContact(idx, "phone", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Update Client"
              ) : (
                "Create Client"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
