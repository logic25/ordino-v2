import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Linkedin } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import type { ClientContact } from "@/hooks/useClients";

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ClientContact | null;
}

export function EditContactDialog({ open, onOpenChange, contact }: EditContactDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: profiles = [] } = useCompanyProfiles();

  const emptyForm = {
    first_name: "",
    last_name: "",
    title: "",
    email: "",
    phone: "",
    mobile: "",
    fax: "",
    linkedin_url: "",
    lead_owner_id: "",
    address_1: "",
    address_2: "",
    city: "",
    state: "",
    zip: "",
    is_primary: false,
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (contact) {
      setForm({
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        title: contact.title || "",
        email: contact.email || "",
        phone: contact.phone || "",
        mobile: contact.mobile || "",
        fax: contact.fax || "",
        linkedin_url: contact.linkedin_url || "",
        lead_owner_id: contact.lead_owner_id || "",
        address_1: contact.address_1 || "",
        address_2: contact.address_2 || "",
        city: contact.city || "",
        state: contact.state || "",
        zip: contact.zip || "",
        is_primary: contact.is_primary,
      });
    }
  }, [contact]);

  const update = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateContact = useMutation({
    mutationFn: async () => {
      if (!contact) throw new Error("No contact");
      if (!form.first_name.trim()) throw new Error("First name is required");

      const { error } = await supabase
        .from("client_contacts")
        .update({
          name: [form.first_name, form.last_name].filter(Boolean).join(" "),
          first_name: form.first_name,
          last_name: form.last_name || null,
          title: form.title || null,
          email: form.email || null,
          phone: form.phone || null,
          mobile: form.mobile || null,
          fax: form.fax || null,
          linkedin_url: form.linkedin_url || null,
          lead_owner_id: form.lead_owner_id || null,
          address_1: form.address_1 || null,
          address_2: form.address_2 || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          is_primary: form.is_primary,
        })
        .eq("id", contact.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["client-detail"] });
      onOpenChange(false);
      toast({ title: "Contact updated", description: `${form.first_name} ${form.last_name}`.trim() + " saved successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error saving contact", description: error.message, variant: "destructive" });
    },
  });

  const profileOptions = profiles.map((p) => ({
    value: p.id,
    label: p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown",
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription>Update contact details.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First Name *</Label>
              <Input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title / Role</Label>
            <Input value={form.title} onChange={(e) => update("title", e.target.value)} />
          </div>

          {/* Address */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Address 1</Label>
              <Input value={form.address_1} onChange={(e) => update("address_1", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Address 2</Label>
              <Input value={form.address_2} onChange={(e) => update("address_2", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={form.state} onChange={(e) => update("state", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Zip</Label>
              <Input value={form.zip} onChange={(e) => update("zip", e.target.value)} />
            </div>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telephone</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile</Label>
              <Input value={form.mobile} onChange={(e) => update("mobile", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fax</Label>
              <Input value={form.fax} onChange={(e) => update("fax", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Linkedin className="h-3.5 w-3.5" /> LinkedIn URL
              </Label>
              <Input value={form.linkedin_url} onChange={(e) => update("linkedin_url", e.target.value)} />
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Lead Owner</Label>
              <Select
                value={form.lead_owner_id || ""}
                onValueChange={(v) => update("lead_owner_id", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {profileOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.is_primary} onCheckedChange={(v) => update("is_primary", v)} />
              <Label>Primary Contact</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => updateContact.mutate()}
            disabled={updateContact.isPending || !form.first_name.trim()}
          >
            {updateContact.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
            ) : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
