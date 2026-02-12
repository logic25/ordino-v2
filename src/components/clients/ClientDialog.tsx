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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, Star, Linkedin } from "lucide-react";
import type { Client, ClientFormInput, ClientContactInput } from "@/hooks/useClients";
import { useClientContacts } from "@/hooks/useClients";
import { useCompanyProfiles } from "@/hooks/useProfiles";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  fax: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  lead_owner_id: z.string().optional(),
  tax_id: z.string().max(50).optional(),
  ibm_number: z.string().max(50).optional(),
  ibm_number_expiration: z.string().optional(),
  hic_license: z.string().max(50).optional(),
  dob_tracking: z.string().max(50).optional(),
  dob_tracking_expiration: z.string().optional(),
  is_sia: z.boolean().optional(),
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
  first_name: "",
  last_name: "",
  title: "",
  email: "",
  phone: "",
  mobile: "",
  fax: "",
  linkedin_url: "",
  company_name: "",
  lead_owner_id: "",
  address_1: "",
  address_2: "",
  city: "",
  state: "",
  zip: "",
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
  const clientContactsQuery = useClientContacts(client?.id);
  const existingContacts = clientContactsQuery.data ?? [];
  const { data: profiles = [] } = useCompanyProfiles();
  const [contacts, setContacts] = useState<ClientContactInput[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "", email: "", phone: "", fax: "", address: "", notes: "",
      lead_owner_id: "", tax_id: "", ibm_number: "", ibm_number_expiration: "",
      hic_license: "", dob_tracking: "", dob_tracking_expiration: "", is_sia: false,
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        fax: client.fax || "",
        address: client.address || "",
        notes: client.notes || "",
        lead_owner_id: client.lead_owner_id || "",
        tax_id: client.tax_id || "",
        ibm_number: client.ibm_number || "",
        ibm_number_expiration: client.ibm_number_expiration || "",
        hic_license: client.hic_license || "",
        dob_tracking: client.dob_tracking || "",
        dob_tracking_expiration: client.dob_tracking_expiration || "",
        is_sia: client.is_sia || false,
      });
    } else {
      form.reset({
        name: "", email: "", phone: "", fax: "", address: "", notes: "",
        lead_owner_id: "", tax_id: "", ibm_number: "", ibm_number_expiration: "",
        hic_license: "", dob_tracking: "", dob_tracking_expiration: "", is_sia: false,
      });
    }
  }, [client, form]);

  useEffect(() => {
    if (isEditing && existingContacts.length > 0) {
      setContacts(
        existingContacts.map((c) => ({
          id: c.id,
          first_name: c.first_name || c.name?.split(" ")[0] || "",
          last_name: c.last_name || c.name?.split(" ").slice(1).join(" ") || "",
          title: c.title || "",
          email: c.email || "",
          phone: c.phone || "",
          mobile: c.mobile || "",
          fax: c.fax || "",
          linkedin_url: c.linkedin_url || "",
          company_name: c.company_name || "",
          lead_owner_id: c.lead_owner_id || "",
          address_1: c.address_1 || "",
          address_2: c.address_2 || "",
          city: c.city || "",
          state: c.state || "",
          zip: c.zip || "",
          is_primary: c.is_primary,
        }))
      );
    }
  }, [existingContacts, isEditing]);

  // Reset contacts when opening for create (not edit)
  useEffect(() => {
    if (open && !isEditing) {
      setContacts([]);
    }
  }, [open, isEditing]);

  const addContact = () => setContacts([...contacts, emptyContact()]);
  const removeContact = (idx: number) => setContacts(contacts.filter((_, i) => i !== idx));
  const updateContact = (idx: number, field: keyof ClientContactInput, value: any) => {
    setContacts(contacts.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };
  const setPrimary = (idx: number) => {
    setContacts(contacts.map((c, i) => ({ ...c, is_primary: i === idx })));
  };

  const handleSubmit = async (data: FormData) => {
    const validContacts = contacts.filter((c) => c.first_name.trim());
    await onSubmit({
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      fax: data.fax || null,
      address: data.address || null,
      notes: data.notes || null,
      lead_owner_id: data.lead_owner_id || null,
      tax_id: data.tax_id || null,
      ibm_number: data.ibm_number || null,
      ibm_number_expiration: data.ibm_number_expiration || null,
      hic_license: data.hic_license || null,
      dob_tracking: data.dob_tracking || null,
      dob_tracking_expiration: data.dob_tracking_expiration || null,
      is_sia: data.is_sia || false,
      contacts: validContacts,
    });
    form.reset();
    setContacts([]);
  };

  const profileOptions = profiles.map((p) => ({
    value: p.id,
    label: p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown",
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Client" : "New Client"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the client's information and contacts."
              : "Add a new client and their contacts."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="regulatory">License / Regulatory</TabsTrigger>
              <TabsTrigger value="contacts">
                People
                {contacts.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs h-5">{contacts.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Company / Client Name *</Label>
                <Input id="name" placeholder="e.g. Rudin Management" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="company@example.com" {...form.register("email")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="(555) 123-4567" {...form.register("phone")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fax">Fax</Label>
                  <Input id="fax" placeholder="(555) 123-4568" {...form.register("fax")} />
                </div>
                <div className="space-y-2">
                  <Label>Lead Owner</Label>
                  <Select
                    value={form.watch("lead_owner_id") || ""}
                    onValueChange={(v) => form.setValue("lead_owner_id", v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {profileOptions.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" placeholder="Client address" {...form.register("address")} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tax_id">Tax ID</Label>
                  <Input id="tax_id" placeholder="XX-XXXXXXX" {...form.register("tax_id")} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    checked={form.watch("is_sia") || false}
                    onCheckedChange={(v) => form.setValue("is_sia", v)}
                  />
                  <Label>Special Inspection Agency (SIA)</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" placeholder="Any additional notes..." rows={3} {...form.register("notes")} />
              </div>
            </TabsContent>

            {/* Regulatory / License Tab */}
            <TabsContent value="regulatory" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ibm_number">IBM Number</Label>
                  <Input id="ibm_number" {...form.register("ibm_number")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ibm_number_expiration">IBM Number Expiration</Label>
                  <Input id="ibm_number_expiration" type="date" {...form.register("ibm_number_expiration")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hic_license">HIC License</Label>
                <Input id="hic_license" {...form.register("hic_license")} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dob_tracking">DOB Tracking #</Label>
                  <Input id="dob_tracking" {...form.register("dob_tracking")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob_tracking_expiration">DOB Tracking Expiration</Label>
                  <Input id="dob_tracking_expiration" type="date" {...form.register("dob_tracking_expiration")} />
                </div>
              </div>

              {!isEditing && (
                <p className="text-xs text-muted-foreground">
                  These fields are typically used for contractor-type clients.
                </p>
              )}
            </TabsContent>

            {/* People/Contacts Tab */}
            <TabsContent value="contacts" className="space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Contacts</Label>
                <Button type="button" variant="outline" size="sm" onClick={addContact}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Person
                </Button>
              </div>

              {contacts.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  No contacts yet. Add people associated with this client.
                </p>
              )}

              <div className="space-y-3">
                {contacts.map((contact, idx) => (
                  <ContactRow
                    key={idx}
                    contact={contact}
                    idx={idx}
                    profileOptions={profileOptions}
                    onUpdate={updateContact}
                    onRemove={removeContact}
                    onSetPrimary={setPrimary}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit" disabled={isLoading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : isEditing ? "Update Client" : "Create Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ContactRowProps {
  contact: ClientContactInput;
  idx: number;
  profileOptions: { value: string; label: string }[];
  onUpdate: (idx: number, field: keyof ClientContactInput, value: any) => void;
  onRemove: (idx: number) => void;
  onSetPrimary: (idx: number) => void;
}

function ContactRow({ contact, idx, profileOptions, onUpdate, onRemove, onSetPrimary }: ContactRowProps) {
  return (
    <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Person {idx + 1}</span>
          {contact.is_primary && (
            <Badge variant="default" className="text-xs h-5">Primary</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!contact.is_primary && (
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => onSetPrimary(idx)} title="Set as primary contact"
            >
              <Star className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => onRemove(idx)}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Name row */}
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="First name *" value={contact.first_name}
          onChange={(e) => onUpdate(idx, "first_name", e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Last name" value={contact.last_name || ""}
          onChange={(e) => onUpdate(idx, "last_name", e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Title + Company */}
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Title / Role" value={contact.title || ""}
          onChange={(e) => onUpdate(idx, "title", e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Company" value={contact.company_name || ""}
          onChange={(e) => onUpdate(idx, "company_name", e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Contact Info */}
      <div className="grid grid-cols-3 gap-2">
        <Input
          placeholder="Email" type="email" value={contact.email || ""}
          onChange={(e) => onUpdate(idx, "email", e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Telephone" value={contact.phone || ""}
          onChange={(e) => onUpdate(idx, "phone", e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Mobile" value={contact.mobile || ""}
          onChange={(e) => onUpdate(idx, "mobile", e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Fax + LinkedIn */}
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Fax" value={contact.fax || ""}
          onChange={(e) => onUpdate(idx, "fax", e.target.value)}
          className="h-8 text-sm"
        />
        <div className="flex items-center gap-2">
          <Linkedin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            placeholder="LinkedIn URL"
            value={contact.linkedin_url || ""}
            onChange={(e) => onUpdate(idx, "linkedin_url", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Address */}
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Address 1" value={contact.address_1 || ""}
          onChange={(e) => onUpdate(idx, "address_1", e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Address 2" value={contact.address_2 || ""}
          onChange={(e) => onUpdate(idx, "address_2", e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Input
          placeholder="City" value={contact.city || ""}
          onChange={(e) => onUpdate(idx, "city", e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="State" value={contact.state || ""}
          onChange={(e) => onUpdate(idx, "state", e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Zip" value={contact.zip || ""}
          onChange={(e) => onUpdate(idx, "zip", e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Lead Owner */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Lead Owner</Label>
        <Select
          value={contact.lead_owner_id || ""}
          onValueChange={(v) => onUpdate(idx, "lead_owner_id", v === "none" ? "" : v)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select lead owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {profileOptions.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
