import { useEffect, useCallback } from "react";
import { formatPhoneNumber, formatTaxId } from "@/lib/formatters";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Client, ClientFormInput } from "@/hooks/useClients";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useToast } from "@/hooks/use-toast";
import { useTelemetry } from "@/hooks/useTelemetry";

const DEFAULT_TYPES = [
  "Architect", "General Contractor", "Plumber", "Electrician", "Engineer",
  "Property Owner", "Developer", "Expediter", "Attorney", "Insurance",
];

const clientSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  fax: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  lead_owner_id: z.string().optional(),
  tax_id: z.string().max(50).optional(),
  client_type: z.string().optional(),
  is_sia: z.boolean().optional(),
  is_rfp_partner: z.boolean().optional(),
});

type FormData = z.infer<typeof clientSchema>;

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ClientFormInput) => Promise<void>;
  client?: Client | null;
  isLoading?: boolean;
  defaultName?: string;
}

export function ClientDialog({
  open,
  onOpenChange,
  onSubmit,
  client,
  isLoading,
  defaultName,
}: ClientDialogProps) {
  const isEditing = !!client;
  const { toast } = useToast();
  const { track } = useTelemetry();
  const { data: profiles = [] } = useCompanyProfiles();
  const { data: settingsData } = useCompanySettings();
  const companyTypes = settingsData?.settings?.company_types ?? DEFAULT_TYPES;

  const form = useForm<FormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "", email: "", phone: "", fax: "", address: "", notes: "",
      lead_owner_id: "", tax_id: "", client_type: "", is_sia: false,
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
        client_type: (client as any).client_type || "",
        is_sia: client.is_sia || false,
        is_rfp_partner: (client as any).is_rfp_partner || false,
      });
    } else {
      form.reset({
        name: defaultName || "", email: "", phone: "", fax: "", address: "", notes: "",
        lead_owner_id: "", tax_id: "", client_type: "", is_sia: false,
        is_rfp_partner: false,
      });
    }
  }, [client, form, defaultName]);

  const handleSubmit = async (data: FormData) => {
    track("clients", isEditing ? "create_completed" : "create_completed", { is_edit: isEditing });
    try {
      await onSubmit({
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        fax: data.fax || null,
        address: data.address || null,
        notes: data.notes || null,
        lead_owner_id: data.lead_owner_id || null,
        tax_id: data.tax_id || null,
        client_type: data.client_type || null,
        is_sia: data.is_sia || false,
        is_rfp_partner: data.is_rfp_partner || false,
      });
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error saving company", description: error?.message || "Something went wrong", variant: "destructive" });
    }
  };

  const profileOptions = profiles.map((p) => ({
    value: p.id,
    label: p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown",
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Company" : "New Company"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the company's business information." : "Add a new company."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input id="name" placeholder="e.g. Rudin Management" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.watch("client_type") || ""}
                onValueChange={(v) => form.setValue("client_type", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {companyTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" placeholder="Business address" {...form.register("address")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="company@example.com" {...form.register("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="(555) 123-4567"
                value={form.watch("phone") || ""}
                onChange={(e) => form.setValue("phone", formatPhoneNumber(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fax">Fax</Label>
              <Input
                id="fax"
                placeholder="(555) 123-4568"
                value={form.watch("fax") || ""}
                onChange={(e) => form.setValue("fax", formatPhoneNumber(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_id">Tax ID</Label>
              <Input
                id="tax_id"
                placeholder="XX-XXXXXXX"
                value={form.watch("tax_id") || ""}
                onChange={(e) => form.setValue("tax_id", formatTaxId(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div className="flex items-center gap-3 pt-6">
              <Switch
                checked={form.watch("is_sia") || false}
                onCheckedChange={(v) => form.setValue("is_sia", v)}
              />
              <Label>Special Inspection Agency (SIA)</Label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={form.watch("is_rfp_partner") || false}
              onCheckedChange={(v) => form.setValue("is_rfp_partner", v)}
            />
            <Label>RFP Partner (show in RFP recommendations)</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Any additional notes..." rows={3} {...form.register("notes")} />
          </div>

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
              ) : isEditing ? "Update Company" : "Create Company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
