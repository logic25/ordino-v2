import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { ProposalWithRelations, ProposalFormInput } from "@/hooks/useProposals";
import { useProperties, useCreateProperty } from "@/hooks/useProperties";
import { useClients, useCreateClient, Client } from "@/hooks/useClients";
import { useCompanySettings, ServiceCatalogItem } from "@/hooks/useCompanySettings";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useToast } from "@/hooks/use-toast";
import { ProposalContactsSection } from "@/components/proposals/ProposalContactsSection";
import { useProposalContacts, type ProposalContactInput } from "@/hooks/useProposalContacts";

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Service name is required"),
  description: z.string().optional(),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  unit_price: z.coerce.number().min(0, "Price must be 0 or greater"),
  estimated_hours: z.coerce.number().min(0).optional(),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
  sort_order: z.number().optional(),
});

const LEAD_SOURCES = [
  "Referral",
  "Website",
  "Cold Call",
  "Architect",
  "Repeat Client",
  "Walk-in",
  "Other",
] as const;

const PROJECT_TYPES = [
  "Residential",
  "Commercial",
  "Industrial",
  "Mixed-Use",
  "Institutional",
  "Healthcare",
  "Hospitality",
  "Retail",
  "Other",
] as const;

const proposalSchema = z.object({
  property_id: z.string().min(1, "Property is required"),
  title: z.string().min(1, "Title is required"),
  payment_terms: z.string().optional(),
  deposit_required: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().min(0).optional()),
  deposit_percentage: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().min(0).max(100).optional()),
  valid_until: z.string().optional(),
  client_id: z.string().optional(),
  client_name: z.string().optional(),
  client_email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
  terms_conditions: z.string().optional(),
  lead_source: z.string().optional(),
  project_type: z.string().optional(),
  sales_person_id: z.string().optional(),
  billed_to_name: z.string().optional(),
  billed_to_email: z.string().email().optional().or(z.literal("")),
  reminder_date: z.string().optional(),
  notable: z.boolean().optional(),
  items: z.array(itemSchema),
});

type FormData = z.infer<typeof proposalSchema>;

interface ProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProposalFormInput, contacts: ProposalContactInput[]) => Promise<void>;
  proposal?: ProposalWithRelations | null;
  isLoading?: boolean;
  defaultPropertyId?: string;
}

export function ProposalDialog({
  open,
  onOpenChange,
  onSubmit,
  proposal,
  isLoading,
  defaultPropertyId,
}: ProposalDialogProps) {
  const isEditing = !!proposal;
  const { data: properties = [] } = useProperties();
  const { data: clients = [] } = useClients();
  const { data: companyData } = useCompanySettings();
  const { data: profiles = [] } = useCompanyProfiles();
  const createClient = useCreateClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("details");
  const [contacts, setContacts] = useState<ProposalContactInput[]>([]);
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [propertySearch, setPropertySearch] = useState("");
  const createProperty = useCreateProperty();

  const { data: existingContacts = [] } = useProposalContacts(proposal?.id);

  // Sync existing contacts when editing (only on initial load)
  useEffect(() => {
    if (proposal && existingContacts.length > 0) {
      setContacts(existingContacts.map(c => ({
        id: c.id,
        client_id: c.client_id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        company_name: c.company_name,
        role: c.role as ProposalContactInput["role"],
        sort_order: c.sort_order ?? 0,
      })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.id, existingContacts]);

  const serviceCatalog = companyData?.settings?.service_catalog || [];
  const defaultTerms = companyData?.settings?.default_terms || "";

  const newFieldDefaults = {
    lead_source: "",
    project_type: "",
    sales_person_id: "",
    billed_to_name: "",
    billed_to_email: "",
    reminder_date: "",
    notable: false,
  };

  const form = useForm<FormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      property_id: defaultPropertyId || "",
      title: "",
      payment_terms: "",
      deposit_required: undefined,
      deposit_percentage: undefined,
      valid_until: "",
      client_id: "",
      client_name: "",
      client_email: "",
      notes: "",
      terms_conditions: defaultTerms,
      ...newFieldDefaults,
      items: [{ name: "", description: "", quantity: 1, unit_price: 0, estimated_hours: 0, discount_percent: 0 }],
    },
  });

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (proposal) {
      const p = proposal as any;
      form.reset({
        property_id: proposal.property_id || "",
        title: proposal.title || "",
        payment_terms: proposal.payment_terms || "",
        deposit_required: proposal.deposit_required ? Number(proposal.deposit_required) : undefined,
        deposit_percentage: proposal.deposit_percentage ? Number(proposal.deposit_percentage) : undefined,
        valid_until: proposal.valid_until || "",
        client_id: p.client_id || "",
        client_name: proposal.client_name || "",
        client_email: proposal.client_email || "",
        notes: proposal.notes || "",
        terms_conditions: p.terms_conditions || defaultTerms,
        lead_source: p.lead_source || "",
        project_type: p.project_type || "",
        sales_person_id: p.sales_person_id || "",
        billed_to_name: p.billed_to_name || "",
        billed_to_email: p.billed_to_email || "",
        reminder_date: p.reminder_date || "",
        items: proposal.items?.length ? proposal.items.map(i => ({
          id: i.id,
          name: i.name,
          description: i.description || "",
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          estimated_hours: Number((i as any).estimated_hours) || 0,
          discount_percent: Number((i as any).discount_percent) || 0,
          sort_order: i.sort_order ?? undefined,
        })) : [{ name: "", description: "", quantity: 1, unit_price: 0, estimated_hours: 0, discount_percent: 0 }],
      });
    } else {
      form.reset({
        property_id: defaultPropertyId || "",
        title: "",
        payment_terms: "",
        deposit_required: undefined,
        deposit_percentage: undefined,
        valid_until: "",
        client_id: "",
        client_name: "",
        client_email: "",
        notes: "",
        terms_conditions: defaultTerms,
        ...newFieldDefaults,
        items: [{ name: "", description: "", quantity: 1, unit_price: 0, estimated_hours: 0, discount_percent: 0 }],
      });
      setContacts([]);
    }
  }, [proposal, form, defaultPropertyId, defaultTerms]);

  const watchedItems = form.watch("items");
  
  const calculateLineTotal = (item: typeof watchedItems[0]) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const discountPct = Number(item.discount_percent) || 0;
    const subtotal = qty * price;
    const discount = subtotal * (discountPct / 100);
    return subtotal - discount;
  };

  const subtotal = watchedItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  const totalHours = watchedItems.reduce((sum, item) => sum + (Number(item.estimated_hours) || 0), 0);


  const handleAddServiceFromCatalog = (service: ServiceCatalogItem) => {
    appendItem({
      name: service.name,
      description: service.description || "",
      quantity: 1,
      unit_price: service.default_price || 0,
      estimated_hours: service.default_hours || 0,
      discount_percent: 0,
    });
  };

  const handleSubmit = async (data: FormData) => {
    const validItems = data.items.filter(i => i.name);

    const formData: ProposalFormInput = {
      property_id: data.property_id,
      title: data.title,
      payment_terms: data.payment_terms || null,
      deposit_required: data.deposit_required || null,
      deposit_percentage: data.deposit_percentage || null,
      valid_until: data.valid_until || null,
      client_name: data.client_name || null,
      client_email: data.client_email || null,
      client_id: data.client_id || null,
      notes: data.notes || null,
      terms_conditions: data.terms_conditions || null,
      lead_source: data.lead_source || null,
      project_type: data.project_type || null,
      sales_person_id: data.sales_person_id || null,
      billed_to_name: data.billed_to_name || null,
      billed_to_email: data.billed_to_email || null,
      reminder_date: data.reminder_date || null,
      items: validItems.map((item, idx) => ({
        id: item.id,
        name: item.name,
        description: item.description || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        sort_order: idx,
      })),
      milestones: [],
    };
    await onSubmit(formData, contacts);
    form.reset();
    setContacts([]);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Proposal" : "New Proposal"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the proposal details."
              : "Create a new proposal for a property."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="terms">Terms & Notes</TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Property *</Label>
                  <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={propertyOpen}
                        className="w-full justify-between font-normal"
                      >
                        {form.watch("property_id")
                          ? properties.find((p) => p.id === form.watch("property_id"))?.address ?? "Select property…"
                          : "Search properties…"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={true}>
                        <CommandInput
                          placeholder="Type an address…"
                          value={propertySearch}
                          onValueChange={setPropertySearch}
                        />
                        <CommandList>
                          <CommandEmpty className="p-0">
                            <button
                              type="button"
                              className="w-full px-4 py-3 text-sm text-left hover:bg-accent flex items-center gap-2"
                              onClick={async () => {
                                if (!propertySearch.trim()) return;
                                try {
                                  const newProp = await createProperty.mutateAsync({
                                    address: propertySearch.trim(),
                                  });
                                  form.setValue("property_id", newProp.id);
                                  setPropertySearch("");
                                  setPropertyOpen(false);
                                  toast({ title: "Property created", description: newProp.address });
                                } catch (e: any) {
                                  toast({ title: "Error", description: e.message, variant: "destructive" });
                                }
                              }}
                            >
                              <Plus className="h-4 w-4" />
                              Add "{propertySearch}" as new property
                            </button>
                          </CommandEmpty>
                          <CommandGroup>
                            {properties.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={p.address}
                                onSelect={() => {
                                  form.setValue("property_id", p.id);
                                  setPropertySearch("");
                                  setPropertyOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    form.watch("property_id") === p.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {p.address}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {form.formState.errors.property_id && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.property_id.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Proposal Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Full Permit Package"
                    {...form.register("title")}
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.title.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Project Type</Label>
                  <Select
                    value={form.watch("project_type") || ""}
                    onValueChange={(value) => form.setValue("project_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Lead Source</Label>
                  <Select
                    value={form.watch("lead_source") || ""}
                    onValueChange={(value) => form.setValue("lead_source", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Sales Person</Label>
                  <Select
                    value={form.watch("sales_person_id") || ""}
                    onValueChange={(value) => form.setValue("sales_person_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Reminder</Label>
                  <Input type="date" {...form.register("reminder_date")} />
                </div>
              </div>

              {/* Multi-Contact Support */}
              <ProposalContactsSection
                contacts={contacts}
                onChange={setContacts}
                clients={clients}
                onAddClient={async (name, email) => {
                  const newClient = await createClient.mutateAsync({ name, email: email || null });
                  return newClient;
                }}
                isAddingClient={createClient.isPending}
              />

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Deposit %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="50"
                    {...form.register("deposit_percentage")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Valid Until</Label>
                  <Input type="date" {...form.register("valid_until")} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-input"
                      {...form.register("notable")}
                    />
                    Notable Project
                  </label>
                </div>
              </div>
            </TabsContent>

            {/* Services Tab - Spreadsheet Style */}
            <TabsContent value="services" className="space-y-4 mt-4">
              {serviceCatalog.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Quick add:</span>
                  {serviceCatalog.map((service) => (
                    <Button
                      key={service.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddServiceFromCatalog(service)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {service.name}
                    </Button>
                  ))}
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Service</th>
                      <th className="text-left p-2 font-medium w-[200px]">Description</th>
                      <th className="text-left p-2 font-medium w-20">Qty</th>
                      <th className="text-left p-2 font-medium w-24">Unit Price</th>
                      <th className="text-left p-2 font-medium w-20">Hours</th>
                      <th className="text-left p-2 font-medium w-20">Disc %</th>
                      <th className="text-right p-2 font-medium w-28">Total</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemFields.map((field, index) => {
                      const lineTotal = calculateLineTotal(watchedItems[index] || {});

                      return (
                        <tr key={field.id} className="border-t">
                          <td className="p-1">
                            <Input
                              placeholder="Service name"
                              className="border-0 shadow-none focus-visible:ring-0 h-8"
                              {...form.register(`items.${index}.name`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              placeholder="Description"
                              className="border-0 shadow-none focus-visible:ring-0 h-8"
                              {...form.register(`items.${index}.description`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="border-0 shadow-none focus-visible:ring-0 h-8"
                              {...form.register(`items.${index}.quantity`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="border-0 shadow-none focus-visible:ring-0 h-8"
                              {...form.register(`items.${index}.unit_price`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              className="border-0 shadow-none focus-visible:ring-0 h-8"
                              {...form.register(`items.${index}.estimated_hours`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              className="border-0 shadow-none focus-visible:ring-0 h-8"
                              {...form.register(`items.${index}.discount_percent`)}
                            />
                          </td>
                          <td className="p-2 text-right font-medium">
                            {formatCurrency(lineTotal)}
                          </td>
                          <td className="p-1">
                            {itemFields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendItem({ name: "", description: "", quantity: 1, unit_price: 0, estimated_hours: 0, discount_percent: 0 })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>

              {/* Totals */}
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Hours</span>
                    <span className="font-medium">{totalHours} hrs</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg">{formatCurrency(subtotal)}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Terms & Notes Tab */}
            <TabsContent value="terms" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <Textarea
                  id="payment_terms"
                  placeholder="e.g., 50% deposit upon signing, balance due upon permit approval"
                  rows={3}
                  {...form.register("payment_terms")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="terms_conditions">Terms & Conditions</Label>
                <Textarea
                  id="terms_conditions"
                  placeholder="Enter terms and conditions..."
                  rows={6}
                  {...form.register("terms_conditions")}
                />
                <p className="text-xs text-muted-foreground">
                  Configure default terms in Settings → Company
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Internal Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Notes visible only to your team..."
                  rows={3}
                  {...form.register("notes")}
                />
              </div>
            </TabsContent>
          </Tabs>

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
                "Update Proposal"
              ) : (
                "Create Proposal"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
