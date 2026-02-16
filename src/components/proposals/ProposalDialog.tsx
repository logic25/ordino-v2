import React, { useEffect, useState, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
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
import { Check, ChevronsUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { ProposalWithRelations, ProposalFormInput } from "@/hooks/useProposals";
import { useProperties, useCreateProperty, useUpdateProperty } from "@/hooks/useProperties";
import { useNYCPropertyLookup } from "@/hooks/useNYCPropertyLookup";
import { useClients, useCreateClient, Client } from "@/hooks/useClients";
import { useCompanySettings, ServiceCatalogItem } from "@/hooks/useCompanySettings";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useToast } from "@/hooks/use-toast";
import { ProposalContactsSection } from "@/components/proposals/ProposalContactsSection";
import { useProposalContacts, type ProposalContactInput } from "@/hooks/useProposalContacts";

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  quantity: z.coerce.number().min(0),
  unit_price: z.coerce.number().min(0),
  estimated_hours: z.coerce.number().min(0).optional(),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
  sort_order: z.number().optional(),
});

const LEAD_SOURCES = [
  "Referral", "Website", "Cold Call", "Architect", "Repeat Client", "Walk-in", "Other",
] as const;

const PROJECT_TYPES = [
  "Residential", "Commercial", "Industrial", "Mixed-Use", "Institutional", "Healthcare", "Hospitality", "Retail", "Other",
] as const;

const proposalSchema = z.object({
  property_id: z.string().min(1, "Property is required"),
  title: z.string().min(1, "Title is required"),
  payment_terms: z.string().optional(),
  deposit_required: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().min(0).optional()),
  deposit_percentage: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().min(0).max(100).optional()),
  retainer_amount: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().min(0).optional()),
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

/* ─── Service Line Item ─── */
function ServiceLineItem({
  index,
  form,
  lineTotal,
  serviceCatalog,
  formatCurrency,
  canRemove,
  onRemove,
  autoFocus,
}: {
  index: number;
  form: any;
  lineTotal: number;
  serviceCatalog: ServiceCatalogItem[];
  formatCurrency: (v: number) => string;
  canRemove: boolean;
  onRemove: () => void;
  autoFocus?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && nameInputRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        nameInputRef.current?.focus();
        setCatalogOpen(true);
      }, 50);
    }
  }, [autoFocus]);
  const currentName = form.watch(`items.${index}.name`) || "";
  const currentDesc = form.watch(`items.${index}.description`) || "";

  const filtered = serviceCatalog.filter((s) =>
    s.name.toLowerCase().includes((search || currentName).toLowerCase())
  );

  const handleSelectService = (service: ServiceCatalogItem) => {
    form.setValue(`items.${index}.name`, service.name);
    form.setValue(`items.${index}.description`, service.description || "");
    form.setValue(`items.${index}.unit_price`, service.default_price || 0);
    form.setValue(`items.${index}.estimated_hours`, service.default_hours || 0);
    setCatalogOpen(false);
    setSearch("");
  };

  return (
    <div className="border rounded-lg bg-card">
      {/* Main row */}
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Service name with autocomplete */}
        <div className="flex-1 min-w-0">
          <Popover open={catalogOpen} onOpenChange={setCatalogOpen}>
            <PopoverTrigger asChild>
              <Input
                ref={nameInputRef}
                placeholder="Type or select a service…"
                className="h-8 text-sm font-medium border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring px-2"
                value={currentName}
                onChange={(e) => {
                  form.setValue(`items.${index}.name`, e.target.value);
                  setSearch(e.target.value);
                  if (!catalogOpen && e.target.value && serviceCatalog.length > 0) setCatalogOpen(true);
                }}
                onFocus={() => { if (serviceCatalog.length > 0 && !currentName) setCatalogOpen(true); }}
              />
            </PopoverTrigger>
            {serviceCatalog.length > 0 && (
              <PopoverContent className="w-[320px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="max-h-[200px] overflow-y-auto">
                  {filtered.length > 0 ? filtered.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center border-b last:border-0"
                      onClick={() => handleSelectService(service)}
                    >
                      <div>
                        <div className="font-medium">{service.name}</div>
                        {service.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]">{service.description}</div>
                        )}
                      </div>
                      {service.default_price ? (
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatCurrency(service.default_price)}</span>
                      ) : null}
                    </button>
                  )) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No matching services</div>
                  )}
                </div>
              </PopoverContent>
            )}
          </Popover>
          {currentDesc && !expanded && (
            <p className="text-xs text-muted-foreground truncate px-2 mt-0.5">{currentDesc}</p>
          )}
        </div>

        {/* Inline numeric fields */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-14">
            <Input
              type="number" min="0" step="0.01"
              className="h-8 text-sm text-center border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring px-1"
              placeholder="Qty"
              {...form.register(`items.${index}.quantity`)}
            />
          </div>
          <span className="text-muted-foreground text-xs">×</span>
          <div className="w-20">
            <Input
              type="number" min="0" step="0.01"
              className="h-8 text-sm text-right border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring px-1"
              placeholder="Price"
              {...form.register(`items.${index}.unit_price`)}
            />
          </div>
          <span className="text-sm font-semibold w-20 text-right tabular-nums">{formatCurrency(lineTotal)}</span>
        </div>

        {canRemove && (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t bg-muted/30 p-3 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Description / Scope</Label>
            <Textarea
              placeholder="Describe the scope of this service…"
              rows={2}
              className="text-sm"
              {...form.register(`items.${index}.description`)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Est. Hours</Label>
              <Input type="number" min="0" step="0.5" className="h-8 text-sm" {...form.register(`items.${index}.estimated_hours`)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Discount %</Label>
              <Input type="number" min="0" max="100" step="1" className="h-8 text-sm" {...form.register(`items.${index}.discount_percent`)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Line Total</Label>
              <div className="h-8 flex items-center text-sm font-semibold">{formatCurrency(lineTotal)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Section header helper ─── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{children}</span>
      <Separator className="flex-1" />
    </div>
  );
}

/* ─── Main Dialog ─── */
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
  const [activeTab, setActiveTab] = useState("services");
  const [contacts, setContacts] = useState<ProposalContactInput[]>([]);
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [propertySearch, setPropertySearch] = useState("");
  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty();
  const { lookupByAddress } = useNYCPropertyLookup();
  const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null);

  const { data: existingContacts = [] } = useProposalContacts(proposal?.id);

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
      lead_source: "",
      project_type: "",
      sales_person_id: "",
      billed_to_name: "",
      billed_to_email: "",
      reminder_date: "",
      notable: false,
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
        retainer_amount: p.retainer_amount ? Number(p.retainer_amount) : undefined,
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
        notable: p.notable || false,
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
        lead_source: "",
        project_type: "",
        sales_person_id: "",
        billed_to_name: "",
        billed_to_email: "",
        reminder_date: "",
        notable: false,
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

  const onFormError = (errors: any) => {
    // Property/title errors are always visible at top — just show toast
    if (errors.property_id || errors.title) {
      toast({ title: "Missing required fields", description: "Property and Title are required.", variant: "destructive" });
    } else if (errors.items) {
      setActiveTab("services");
    } else {
      setActiveTab("details");
    }
  };

  const handleSubmit = async (data: FormData) => {
    const validItems = data.items.filter(i => i.name && i.name.trim() !== "");

    const formData: ProposalFormInput = {
      property_id: data.property_id,
      title: data.title,
      payment_terms: data.payment_terms || null,
      deposit_required: data.deposit_required || null,
      deposit_percentage: data.deposit_percentage || null,
      retainer_amount: data.retainer_amount || null,
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[96vh] flex flex-col p-0 gap-0">
        {/* ── Header with key fields always visible ── */}
        <div className="px-6 pt-5 pb-4 border-b space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {isEditing ? "Edit Proposal" : "New Proposal"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Property */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Property *</Label>
              <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-9 text-sm">
                    {form.watch("property_id")
                      ? properties.find((p) => p.id === form.watch("property_id"))?.address ?? "Select…"
                      : "Search properties…"}
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0" align="start">
                  <Command shouldFilter={true}>
                    <CommandInput placeholder="Type an address…" value={propertySearch} onValueChange={setPropertySearch} />
                    <CommandList>
                      <CommandEmpty className="p-0">
                        <button
                          type="button"
                          className="w-full px-4 py-3 text-sm text-left hover:bg-muted flex items-center gap-2"
                          onClick={async () => {
                            if (!propertySearch.trim()) return;
                            try {
                              const newProp = await createProperty.mutateAsync({ address: propertySearch.trim() });
                              form.setValue("property_id", newProp.id);
                              setPropertySearch("");
                              setPropertyOpen(false);
                              toast({ title: "Property created", description: newProp.address });

                              // Auto-lookup BBL data from NYC Open Data
                              const nycData = await lookupByAddress(propertySearch.trim());
                              if (nycData) {
                                const updates: Record<string, any> = {};
                                if (nycData.borough) updates.borough = nycData.borough;
                                if (nycData.block) updates.block = nycData.block;
                                if (nycData.lot) updates.lot = nycData.lot;
                                if (nycData.bin) updates.bin = nycData.bin;
                                if (nycData.zip_code) updates.zip_code = nycData.zip_code;
                                if (nycData.owner_name) updates.owner_name = nycData.owner_name;
                                if (Object.keys(updates).length > 0) {
                                  await updateProperty.mutateAsync({ id: newProp.id, address: newProp.address, ...updates });
                                  toast({ title: "Property enriched", description: "Borough, Block & Lot filled from NYC Open Data." });
                                }
                              }
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
                          <CommandItem key={p.id} value={p.address} onSelect={() => {
                            form.setValue("property_id", p.id);
                            setPropertySearch("");
                            setPropertyOpen(false);
                          }}>
                            <Check className={cn("mr-2 h-4 w-4", form.watch("property_id") === p.id ? "opacity-100" : "opacity-0")} />
                            {p.address}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {form.formState.errors.property_id && (
                <p className="text-xs text-destructive">{form.formState.errors.property_id.message}</p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Proposal Title *</Label>
              <Input className="h-9 text-sm" placeholder="e.g., Full Permit Package" {...form.register("title")} />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <form onSubmit={form.handleSubmit(handleSubmit, onFormError)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="px-6 pt-3 border-b">
                <TabsList className="bg-transparent p-0 h-auto gap-4">
                  <TabsTrigger value="services" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2.5 text-sm">
                    Services
                  </TabsTrigger>
                  <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2.5 text-sm">
                    Details & Contacts
                  </TabsTrigger>
                  <TabsTrigger value="terms" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2.5 text-sm">
                    Terms & Notes
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ═══ SERVICES TAB ═══ */}
              <TabsContent value="services" className="px-6 py-4 space-y-3 mt-0 min-h-[340px]">
                <div className="space-y-2">
                  {itemFields.map((field, index) => {
                    const lineTotal = calculateLineTotal(watchedItems[index] || {});
                    return (
                      <ServiceLineItem
                        key={field.id}
                        index={index}
                        form={form}
                        lineTotal={lineTotal}
                        serviceCatalog={serviceCatalog}
                        formatCurrency={formatCurrency}
                        canRemove={itemFields.length > 1}
                        onRemove={() => removeItem(index)}
                        autoFocus={lastAddedIndex === index}
                      />
                    );
                  })}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={() => {
                    appendItem({ name: "", description: "", quantity: 1, unit_price: 0, estimated_hours: 0, discount_percent: 0 });
                    setLastAddedIndex(itemFields.length);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </TabsContent>

              {/* ═══ DETAILS & CONTACTS TAB ═══ */}
              <TabsContent value="details" className="px-6 py-4 space-y-4 mt-0">
                <SectionLabel>Classification</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Project Type</Label>
                    <Select value={form.watch("project_type") || ""} onValueChange={(v) => form.setValue("project_type", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Lead Source</Label>
                    <Select value={form.watch("lead_source") || ""} onValueChange={(v) => form.setValue("lead_source", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Sales Person</Label>
                    <Select value={form.watch("sales_person_id") || ""} onValueChange={(v) => form.setValue("sales_person_id", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Follow-up Reminder</Label>
                    <Input type="date" className="h-9 text-sm" {...form.register("reminder_date")} />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Switch checked={form.watch("notable") || false} onCheckedChange={(c) => form.setValue("notable", c)} />
                  <Label className="text-sm cursor-pointer">Notable Project</Label>
                </div>

                <SectionLabel>Contacts</SectionLabel>
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

                <SectionLabel>Financial</SectionLabel>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Deposit %</Label>
                    <Input type="number" min="0" max="100" placeholder="50" className="h-9 text-sm" {...form.register("deposit_percentage")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Valid Until</Label>
                    <Input type="date" className="h-9 text-sm" {...form.register("valid_until")} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Retainer ($)</Label>
                    <Input type="number" min="0" step="0.01" placeholder="0.00" className="h-9 text-sm" {...form.register("retainer_amount")} />
                  </div>
                </div>
              </TabsContent>

              {/* ═══ TERMS & NOTES TAB ═══ */}
              <TabsContent value="terms" className="px-6 py-4 space-y-4 mt-0">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Payment Terms</Label>
                  <Textarea placeholder="e.g., 50% deposit upon signing, balance due upon permit approval" rows={3} className="text-sm" {...form.register("payment_terms")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Terms & Conditions</Label>
                  <Textarea placeholder="Enter terms and conditions..." rows={5} className="text-sm" {...form.register("terms_conditions")} />
                  <p className="text-xs text-muted-foreground">Default terms can be set in Settings → Company</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Internal Notes</Label>
                  <Textarea placeholder="Notes visible only to your team…" rows={3} className="text-sm" {...form.register("notes")} />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* ── Sticky footer with total + actions ── */}
          <div className="border-t px-6 py-3 flex items-center justify-between bg-background">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">{totalHours > 0 && `${totalHours} hrs · `}Total</span>
              <span className="text-lg font-bold tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? "Updating…" : "Creating…"}
                  </>
                ) : isEditing ? "Update Proposal" : "Create Proposal"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
