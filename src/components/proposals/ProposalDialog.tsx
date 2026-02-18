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
import { Check, ChevronsUpDown, ChevronDown, ChevronRight, ChevronLeft, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2, X, Send } from "lucide-react";
import type { ProposalWithRelations, ProposalFormInput } from "@/hooks/useProposals";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProperties, useCreateProperty, useUpdateProperty } from "@/hooks/useProperties";
import { useNYCPropertyLookup } from "@/hooks/useNYCPropertyLookup";
import { useClients, useCreateClient, Client } from "@/hooks/useClients";
import { useCompanySettings, ServiceCatalogItem, WORK_TYPE_DISCIPLINES } from "@/hooks/useCompanySettings";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useToast } from "@/hooks/use-toast";
import { ProposalContactsSection } from "@/components/proposals/ProposalContactsSection";
import { PlansUploadSection } from "@/components/proposals/PlansUploadSection";
import { useProposalContacts, type ProposalContactInput } from "@/hooks/useProposalContacts";
import { ReferredByCombobox } from "@/components/proposals/ReferredByCombobox";

const FEE_TYPES = [
  { value: "fixed", label: "Fixed" },
  { value: "monthly", label: "Monthly" },
  { value: "hourly", label: "Hourly" },
] as const;

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  quantity: z.coerce.number().min(0),
  unit_price: z.coerce.number().min(0),
  estimated_hours: z.coerce.number().min(0).optional(),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
  fee_type: z.string().optional(),
  sort_order: z.number().optional(),
  is_optional: z.boolean().optional(),
  disciplines: z.array(z.string()).optional(),
  discipline_fee: z.coerce.number().min(0).optional(),
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
  
  valid_until: z.string().optional(),
  client_id: z.string().optional(),
  client_name: z.string().optional(),
  client_email: z.string().email().optional().or(z.literal("")),
  assigned_pm_id: z.string().optional(),
  notes: z.string().optional(),
  terms_conditions: z.string().optional(),
  lead_source: z.string().optional(),
  referred_by: z.string().optional(),
  project_type: z.string().optional(),
  sales_person_id: z.string().optional(),
  billed_to_name: z.string().optional(),
  billed_to_email: z.string().email().optional().or(z.literal("")),
  reminder_date: z.string().optional(),
  notable: z.boolean().optional(),
  job_description: z.string().optional(),
  // Party info
  architect_company: z.string().optional(),
  architect_name: z.string().optional(),
  architect_phone: z.string().optional(),
  architect_email: z.string().optional(),
  architect_license_type: z.string().optional(),
  architect_license_number: z.string().optional(),
  gc_company: z.string().optional(),
  gc_name: z.string().optional(),
  gc_phone: z.string().optional(),
  gc_email: z.string().optional(),
  sia_name: z.string().optional(),
  sia_company: z.string().optional(),
  sia_phone: z.string().optional(),
  sia_email: z.string().optional(),
  tpp_name: z.string().optional(),
  tpp_email: z.string().optional(),
  items: z.array(itemSchema),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

const STEPS = [
  { key: "property", label: "Property & Contacts" },
  { key: "parties", label: "Parties & Plans" },
  { key: "services", label: "Services" },
  { key: "details", label: "Details & Terms" },
] as const;

/* ─── Service Line Item ─── */
function ServiceLineItem({
  index, form, lineTotal, serviceCatalog, formatCurrency, canRemove, onRemove, autoFocus,
}: {
  index: number; form: any; lineTotal: number; serviceCatalog: ServiceCatalogItem[];
  formatCurrency: (v: number) => string; canRemove: boolean; onRemove: () => void; autoFocus?: boolean;
}) {
  // Auto-expand if service has discipline pricing (one less click)
  const hasDisciplines = Number(form.watch(`items.${index}.discipline_fee`)) > 0 || 
    serviceCatalog.find(s => s.name === (form.watch(`items.${index}.name`) || ""))?.has_discipline_pricing;
  const [expanded, setExpanded] = useState(!!autoFocus || !!hasDisciplines);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const suggestionsRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) {
      setExpanded(true);
      setTimeout(() => nameInputRef.current?.focus(), 80);
    }
  }, [autoFocus]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          nameInputRef.current && !nameInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentName = form.watch(`items.${index}.name`) || "";
  const currentDesc = form.watch(`items.${index}.description`) || "";
  const currentFeeType = form.watch(`items.${index}.fee_type`) || "fixed";
  const currentDiscount = Number(form.watch(`items.${index}.discount_percent`)) || 0;
  const isOptional = form.watch(`items.${index}.is_optional`) || false;

  const filtered = serviceCatalog.filter((s) =>
    s.name.toLowerCase().includes(currentName.toLowerCase())
  );

  const handleSelectService = (service: ServiceCatalogItem) => {
    const opts = { shouldDirty: true, shouldValidate: false };
    form.setValue(`items.${index}.name`, service.name, opts);
    form.setValue(`items.${index}.description`, service.description || "", opts);
    form.setValue(`items.${index}.unit_price`, service.default_price || 0, opts);
    form.setValue(`items.${index}.estimated_hours`, service.default_hours || 0, opts);
    form.setValue(`items.${index}.fee_type`, service.default_fee_type || "fixed", opts);
    if (service.has_discipline_pricing) {
      form.setValue(`items.${index}.discipline_fee`, service.discipline_fee || 0, opts);
      form.setValue(`items.${index}.disciplines`, [], opts);
      // Keep expanded for discipline services — user needs to pick disciplines
      setExpanded(true);
    } else {
      form.setValue(`items.${index}.discipline_fee`, 0, opts);
      form.setValue(`items.${index}.disciplines`, [], opts);
      setExpanded(false);
    }
    setShowSuggestions(false);
  };

  return (
    <div className={cn("border-b last:border-b-0 transition-colors", expanded && "bg-muted/20", isOptional && "opacity-70 border-l-2 border-l-muted-foreground/30")}>
      <div className="grid grid-cols-[auto_1fr_80px_70px_90px_80px_auto] items-center gap-1 px-3 py-2 min-h-[44px]">
        <button type="button" className="p-1 rounded hover:bg-muted transition-colors" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        <div className="min-w-0">
          <div className="relative">
            <Input
              ref={nameInputRef}
              placeholder="Type service name…"
              className="h-8 text-sm font-medium border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring px-2 bg-transparent relative z-[1]"
              value={currentName}
              onChange={(e) => {
                form.setValue(`items.${index}.name`, e.target.value);
                setShowSuggestions(e.target.value.length > 0 && serviceCatalog.length > 0);
              }}
              onFocus={() => { if (serviceCatalog.length > 0) setShowSuggestions(true); }}
            />
            {showSuggestions && filtered.length > 0 && (
              <div ref={suggestionsRef} className="absolute left-0 top-full z-[9999] w-[340px] bg-popover border rounded-md shadow-xl mt-1 max-h-[200px] overflow-y-auto">
                {filtered.map((service) => (
                  <button key={service.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center border-b last:border-0"
                    onMouseDown={(e) => { e.preventDefault(); handleSelectService(service); }}>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{service.name}</div>
                      {service.description && <div className="text-xs text-muted-foreground truncate">{service.description}</div>}
                    </div>
                    {service.default_price ? <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatCurrency(service.default_price)}</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!expanded && (
            <p className="text-xs text-muted-foreground truncate px-2 mt-0.5">
              {isOptional && <span className="text-accent font-medium mr-1">Optional ·</span>}
              {(form.watch(`items.${index}.disciplines`) || []).length > 0 && (
                <span className="font-medium mr-1">{(form.watch(`items.${index}.disciplines`) || []).length} disciplines ·</span>
              )}
              {currentDesc}
            </p>
          )}
        </div>

        <Select value={currentFeeType} onValueChange={(v) => form.setValue(`items.${index}.fee_type`, v)}>
          <SelectTrigger className="h-8 text-xs border-0 shadow-none focus:ring-1 focus:ring-ring px-1.5 bg-transparent"><SelectValue /></SelectTrigger>
          <SelectContent>{FEE_TYPES.map((ft) => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}</SelectContent>
        </Select>

        <Input type="number" min="0" step="1" className="h-8 text-sm text-center border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring px-1 bg-transparent" placeholder="Qty" {...form.register(`items.${index}.quantity`)} />
        <Input type="number" min="0" step="0.01" className="h-8 text-sm text-right border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring px-1 bg-transparent" placeholder="Price" {...form.register(`items.${index}.unit_price`)} />

        <span className="text-sm font-semibold text-right tabular-nums pr-1">
          {formatCurrency(lineTotal)}
          {currentDiscount > 0 && <span className="text-xs text-accent block">-{currentDiscount}%</span>}
        </span>

        {canRemove ? (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-50 hover:opacity-100" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
        ) : <div className="w-7" />}
      </div>

      {expanded && (
        <div className="border-t bg-muted/30 px-4 py-3 ml-8 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Description / Scope</Label>
            <Textarea placeholder="Describe the scope of this service…" rows={2} className="text-sm" {...form.register(`items.${index}.description`)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs text-muted-foreground mb-1 block">Est. Hours</Label><Input type="number" min="0" step="0.5" className="h-8 text-sm" {...form.register(`items.${index}.estimated_hours`)} /></div>
            <div><Label className="text-xs text-muted-foreground mb-1 block">Discount %</Label><Input type="number" min="0" max="100" step="1" className="h-8 text-sm" {...form.register(`items.${index}.discount_percent`)} /></div>
            <div><Label className="text-xs text-muted-foreground mb-1 block">Line Total</Label><div className="h-8 flex items-center text-sm font-semibold">{formatCurrency(lineTotal)}</div></div>
          </div>

          {/* Discipline / Work Type Pricing */}
          {(() => {
            const disciplineFee = Number(form.watch(`items.${index}.discipline_fee`)) || 0;
            const selectedDisciplines: string[] = form.watch(`items.${index}.disciplines`) || [];
            const catalogMatch = serviceCatalog.find(s => s.name === currentName);
            const hasDisciplinePricing = disciplineFee > 0 || catalogMatch?.has_discipline_pricing;

            if (!hasDisciplinePricing) return null;

            const toggleDiscipline = (d: string) => {
              const current = [...selectedDisciplines];
              const idx = current.indexOf(d);
              if (idx >= 0) current.splice(idx, 1);
              else current.push(d);
              form.setValue(`items.${index}.disciplines`, current);
            };

            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Work Types / Disciplines</Label>
                  <span className="text-xs text-muted-foreground">
                    {selectedDisciplines.length} selected · {formatCurrency(disciplineFee)}/discipline
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Label className="text-xs text-muted-foreground shrink-0">Fee per discipline</Label>
                  <Input
                    type="number" min="0" step="0.01" className="h-7 text-sm w-24"
                    value={disciplineFee || ""}
                    onChange={(e) => form.setValue(`items.${index}.discipline_fee`, parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {WORK_TYPE_DISCIPLINES.map((d) => (
                    <label key={d} className="flex items-center gap-1.5 cursor-pointer text-xs py-1 px-2 rounded hover:bg-muted/50 transition-colors">
                      <Checkbox
                        checked={selectedDisciplines.includes(d)}
                        onCheckedChange={() => toggleDiscipline(d)}
                        className="h-3.5 w-3.5"
                      />
                      <span>{d}</span>
                    </label>
                  ))}
                </div>
                {selectedDisciplines.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Base {formatCurrency(Number(form.watch(`items.${index}.unit_price`)) || 0)} + {selectedDisciplines.length} × {formatCurrency(disciplineFee)} = {formatCurrency((Number(form.watch(`items.${index}.unit_price`)) || 0) + selectedDisciplines.length * disciplineFee)}
                  </p>
                )}
              </div>
            );
          })()}

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <Checkbox
              checked={isOptional}
              onCheckedChange={(checked) => form.setValue(`items.${index}.is_optional`, !!checked)}
              className="h-3.5 w-3.5"
            />
            <span className="text-xs text-muted-foreground">Optional service — shown on proposal but not included in total</span>
          </label>
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

/* ─── Step indicator ─── */
function StepIndicator({ currentStep, steps }: { currentStep: number; steps: readonly { key: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
              i < currentStep ? "bg-accent text-accent-foreground" :
              i === currentStep ? "bg-accent text-accent-foreground" :
              "bg-muted text-muted-foreground"
            )}>
              {i < currentStep ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={cn(
              "text-xs font-medium hidden sm:inline",
              i === currentStep ? "text-foreground" : "text-muted-foreground"
            )}>{step.label}</span>
          </div>
          {i < steps.length - 1 && <div className={cn("w-8 h-px mx-1", i < currentStep ? "bg-accent" : "bg-border")} />}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ─── Party Info Section ─── */
function PartyInfoSection({ form, clients }: { form: any; clients: any[] }) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const parties = [
    { key: "architect", label: "Architect / Engineer", fields: [
      { name: "architect_company", label: "Company", placeholder: "Firm name" },
      { name: "architect_name", label: "Contact Name", placeholder: "Full name" },
      { name: "architect_phone", label: "Phone", placeholder: "(555) 000-0000" },
      { name: "architect_email", label: "Email", placeholder: "email@firm.com" },
      { name: "architect_license_type", label: "License Type", placeholder: "RA / PE" },
      { name: "architect_license_number", label: "License #", placeholder: "License number" },
    ]},
    { key: "gc", label: "General Contractor", fields: [
      { name: "gc_company", label: "Company", placeholder: "Company name" },
      { name: "gc_name", label: "Contact Name", placeholder: "Full name" },
      { name: "gc_phone", label: "Phone", placeholder: "(555) 000-0000" },
      { name: "gc_email", label: "Email", placeholder: "email@company.com" },
    ]},
    { key: "sia", label: "Special Inspector (SIA)", fields: [
      { name: "sia_company", label: "Company", placeholder: "Inspection firm" },
      { name: "sia_name", label: "Contact Name", placeholder: "Full name" },
      { name: "sia_phone", label: "Phone", placeholder: "(555) 000-0000" },
      { name: "sia_email", label: "Email", placeholder: "email@company.com" },
    ]},
    { key: "tpp", label: "Third Party Provider (TPP)", fields: [
      { name: "tpp_name", label: "Name", placeholder: "Full name" },
      { name: "tpp_email", label: "Email", placeholder: "email@provider.com" },
    ]},
  ];

  return (
    <div className="space-y-1">
      {parties.map(party => {
        const isOpen = openSections[party.key] || false;
        const hasData = party.fields.some(f => form.watch(f.name));
        return (
          <div key={party.key} className="border rounded-lg">
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              onClick={() => toggle(party.key)}
            >
              <span className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="font-medium">{party.label}</span>
                {hasData && <span className="text-xs text-accent">✓ Info entered</span>}
              </span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
                <div className={cn("grid gap-2", party.fields.length <= 2 ? "grid-cols-2" : "grid-cols-3")}>
                  {party.fields.map(field => (
                    <div key={field.name} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{field.label}</Label>
                      <Input className="h-8 text-sm" placeholder={field.placeholder} {...form.register(field.name)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Dialog ─── */
export type ProposalSaveAction = "save" | "save_preview" | "save_send";

interface ProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProposalFormInput, contacts: ProposalContactInput[], action?: ProposalSaveAction) => Promise<void>;
  proposal?: ProposalWithRelations | null;
  isLoading?: boolean;
  defaultPropertyId?: string;
}

export function ProposalDialog({
  open, onOpenChange, onSubmit, proposal, isLoading, defaultPropertyId,
}: ProposalDialogProps) {
  const isEditing = !!proposal;
  const { data: properties = [] } = useProperties();
  const { data: clients = [] } = useClients();
  const { data: companyData } = useCompanySettings();
  const { data: profiles = [] } = useCompanyProfiles();
  const createClient = useCreateClient();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [contacts, setContacts] = useState<ProposalContactInput[]>([]);
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [propertySearch, setPropertySearch] = useState("");
  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty();
  const { lookupByAddress } = useNYCPropertyLookup();
  const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null);

  const { data: existingContacts = [] } = useProposalContacts(proposal?.id);

  // Fetch proposal items separately since the list query doesn't include them
  const { data: fetchedItems } = useQuery({
    queryKey: ["proposal-items", proposal?.id],
    queryFn: async () => {
      if (!proposal?.id) return [];
      const { data, error } = await supabase
        .from("proposal_items")
        .select("*")
        .eq("proposal_id", proposal.id)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!proposal?.id,
  });

  // Merge fetched items into proposal for the form reset (memoized to prevent infinite effect loop)
  const proposalWithItems = React.useMemo(() => {
    if (!proposal) return null;
    return {
      ...proposal,
      items: (proposal.items && proposal.items.length > 0) ? proposal.items : (fetchedItems || []),
    };
  }, [proposal, fetchedItems]);

  useEffect(() => {
    if (proposal && existingContacts.length > 0) {
      setContacts(existingContacts.map(c => ({
        id: c.id, client_id: c.client_id, name: c.name, email: c.email,
        phone: c.phone, company_name: c.company_name,
        role: c.role as ProposalContactInput["role"], sort_order: c.sort_order ?? 0,
      })));
    }
  }, [proposal?.id, existingContacts]);

  const serviceCatalog = companyData?.settings?.service_catalog || [];
  const defaultTerms = companyData?.settings?.default_terms || "";

  const form = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      property_id: defaultPropertyId || "", title: "", payment_terms: "",
      deposit_required: undefined, deposit_percentage: undefined,
      valid_until: "", client_id: "", client_name: "", client_email: "",
      assigned_pm_id: "",
       notes: "", terms_conditions: defaultTerms, lead_source: "", referred_by: "",
      project_type: "", sales_person_id: "", billed_to_name: "",
      billed_to_email: "", reminder_date: "", notable: false,
      architect_company: "", architect_name: "", architect_phone: "", architect_email: "",
      architect_license_type: "", architect_license_number: "",
      gc_company: "", gc_name: "", gc_phone: "", gc_email: "",
      sia_name: "", sia_company: "", sia_phone: "", sia_email: "",
      tpp_name: "", tpp_email: "",
      job_description: "",
      items: [{ name: "", description: "", quantity: 1, unit_price: 0, estimated_hours: 0, discount_percent: 0, fee_type: "fixed" }],
    },
  });

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control: form.control, name: "items",
  });

  useEffect(() => {
    if (proposalWithItems) {
      const p = proposalWithItems as any;
      form.reset({
        property_id: proposalWithItems.property_id || "", title: proposalWithItems.title || "",
        payment_terms: proposalWithItems.payment_terms || "",
        deposit_required: proposalWithItems.deposit_required ? Number(proposalWithItems.deposit_required) : undefined,
        deposit_percentage: proposalWithItems.deposit_percentage ? Number(proposalWithItems.deposit_percentage) : undefined,
        
        valid_until: proposalWithItems.valid_until || "",
        client_id: p.client_id || "", client_name: proposalWithItems.client_name || "",
        client_email: proposalWithItems.client_email || "",
        assigned_pm_id: p.assigned_pm_id || "",
        notes: proposalWithItems.notes || "",
        terms_conditions: p.terms_conditions || defaultTerms,
        lead_source: p.lead_source || "", referred_by: (p as any).referred_by || "", project_type: p.project_type || "",
        sales_person_id: p.sales_person_id || "", billed_to_name: p.billed_to_name || "",
        billed_to_email: p.billed_to_email || "", reminder_date: p.reminder_date || "",
        notable: p.notable || false,
        architect_company: p.architect_company || "", architect_name: p.architect_name || "",
        architect_phone: p.architect_phone || "", architect_email: p.architect_email || "",
        architect_license_type: p.architect_license_type || "", architect_license_number: p.architect_license_number || "",
        gc_company: p.gc_company || "", gc_name: p.gc_name || "", gc_phone: p.gc_phone || "", gc_email: p.gc_email || "",
        sia_name: p.sia_name || "", sia_company: p.sia_company || "", sia_phone: p.sia_phone || "", sia_email: p.sia_email || "",
        tpp_name: p.tpp_name || "", tpp_email: p.tpp_email || "",
        job_description: p.job_description || "",
        items: proposalWithItems.items?.length ? proposalWithItems.items.map(i => ({
          id: i.id, name: i.name, description: i.description || "",
          quantity: Number(i.quantity), unit_price: Number(i.unit_price),
          estimated_hours: Number((i as any).estimated_hours) || 0,
          discount_percent: Number((i as any).discount_percent) || 0,
          fee_type: (i as any).fee_type || "fixed", sort_order: i.sort_order ?? undefined,
          is_optional: (i as any).is_optional || false,
          disciplines: (i as any).disciplines || [],
          discipline_fee: Number((i as any).discipline_fee) || 0,
        })) : [{ name: "", description: "", quantity: 1, unit_price: 0, estimated_hours: 0, discount_percent: 0, fee_type: "fixed" }],
      });
      setStep(0);
    } else if (!proposal) {
      form.reset({
        property_id: defaultPropertyId || "", title: "", payment_terms: "",
        deposit_required: undefined, deposit_percentage: undefined,
        valid_until: "", client_id: "", client_name: "", client_email: "",
        assigned_pm_id: "",
       notes: "", terms_conditions: defaultTerms, lead_source: "", referred_by: "",
        project_type: "", sales_person_id: "", billed_to_name: "",
        billed_to_email: "", reminder_date: "", notable: false,
        architect_company: "", architect_name: "", architect_phone: "", architect_email: "",
        architect_license_type: "", architect_license_number: "",
        gc_company: "", gc_name: "", gc_phone: "", gc_email: "",
        sia_name: "", sia_company: "", sia_phone: "", sia_email: "",
        tpp_name: "", tpp_email: "",
        job_description: "",
        items: [{ name: "", description: "", quantity: 1, unit_price: 0, estimated_hours: 0, discount_percent: 0, fee_type: "fixed" }],
      });
      setContacts([]);
      setStep(0);
    }
  }, [proposalWithItems, proposal, form, defaultPropertyId, defaultTerms]);

  const watchedItems = form.watch("items");

  // Auto-add empty row when last row gets a name
  const lastItemName = watchedItems.length > 0 ? watchedItems[watchedItems.length - 1]?.name : "";
  const itemCount = watchedItems.length;
  const appendingRef = useRef(false);

  useEffect(() => {
    if (appendingRef.current) return;
    if (itemCount > 0 && lastItemName && lastItemName.trim() !== "") {
      appendingRef.current = true;
      appendItem({ name: "", description: "", quantity: 1, unit_price: 0, estimated_hours: 0, discount_percent: 0, fee_type: "fixed", is_optional: false }, { shouldFocus: false });
      // Reset flag after React processes the update
      setTimeout(() => { appendingRef.current = false; }, 0);
    }
  }, [lastItemName, itemCount]);

  const calculateLineTotal = (item: typeof watchedItems[0]) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const discountPct = Number(item.discount_percent) || 0;
    const disciplineFee = Number(item.discipline_fee) || 0;
    const disciplineCount = (item.disciplines || []).length;
    const subtotal = (qty * price) + (disciplineFee * disciplineCount);
    return subtotal - subtotal * (discountPct / 100);
  };

  const subtotal = watchedItems.reduce((sum, item) => item.is_optional ? sum : sum + calculateLineTotal(item), 0);
  const optionalTotal = watchedItems.reduce((sum, item) => item.is_optional ? sum + calculateLineTotal(item) : sum, 0);
  const totalHours = watchedItems.reduce((sum, item) => item.is_optional ? sum : sum + (Number(item.estimated_hours) || 0), 0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0) {
      const propertyId = form.getValues("property_id");
      const title = form.getValues("title");
      if (!propertyId) {
        toast({ title: "Property required", description: "Please select or create a property address.", variant: "destructive" });
        return false;
      }
      if (!title || title.trim().length === 0) {
        toast({ title: "Title required", description: "Please enter a proposal title.", variant: "destructive" });
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(Math.min(step + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setStep(Math.max(step - 1, 0));
  };

  const pendingActionRef = useRef<ProposalSaveAction>("save");

  const handleSubmit = async (data: ProposalFormData) => {
      const action = pendingActionRef.current;
      const validItems = data.items.filter(i => i.name && i.name.trim() !== "");
      const depositPct = Number(data.deposit_percentage) || 0;
      const computedRetainer = depositPct > 0 ? Math.round(subtotal * depositPct / 100 * 100) / 100 : null;
      const formData: ProposalFormInput = {
        property_id: data.property_id, title: data.title,
        payment_terms: data.payment_terms || null,
        deposit_required: data.deposit_required || null,
        deposit_percentage: data.deposit_percentage || null,
        retainer_amount: computedRetainer,
        valid_until: data.valid_until || null,
        client_name: data.client_name || null,
        client_email: data.client_email || null,
        client_id: data.client_id || null,
        assigned_pm_id: data.assigned_pm_id || null,
        notes: data.notes || null,
        terms_conditions: data.terms_conditions || null,
        lead_source: data.lead_source || null,
        referred_by: data.referred_by || null,
        project_type: data.project_type || null,
        sales_person_id: data.sales_person_id || null,
        billed_to_name: data.billed_to_name || null,
        billed_to_email: data.billed_to_email || null,
        reminder_date: data.reminder_date || null,
        architect_company: data.architect_company || null,
        architect_name: data.architect_name || null,
        architect_phone: data.architect_phone || null,
        architect_email: data.architect_email || null,
        architect_license_type: data.architect_license_type || null,
        architect_license_number: data.architect_license_number || null,
        gc_company: data.gc_company || null,
        gc_name: data.gc_name || null,
        gc_phone: data.gc_phone || null,
        gc_email: data.gc_email || null,
        sia_name: data.sia_name || null,
        sia_company: data.sia_company || null,
        sia_phone: data.sia_phone || null,
        sia_email: data.sia_email || null,
        tpp_name: data.tpp_name || null,
        tpp_email: data.tpp_email || null,
        job_description: data.job_description || null,
        items: validItems.map((item, idx) => ({
          id: item.id, name: item.name, description: item.description || null,
          quantity: item.quantity, unit_price: item.unit_price, sort_order: idx,
          fee_type: item.fee_type || "fixed",
          estimated_hours: item.estimated_hours || null,
          discount_percent: item.discount_percent || null,
          is_optional: item.is_optional || false,
          disciplines: item.disciplines || null,
          discipline_fee: item.discipline_fee || null,
        })),
      milestones: [],
    };
    await onSubmit(formData, contacts, action);
    form.reset();
    setContacts([]);
    setStep(0);
  };

  const doSave = (action: ProposalSaveAction) => {
    pendingActionRef.current = action;
    form.handleSubmit(handleSubmit)();
  };

  const selectedProperty = properties.find(p => p.id === form.watch("property_id"));

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[900px] max-h-[96vh] h-[96vh] flex flex-col p-0 gap-0 [&>button:last-child]:hidden overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* ── Header with step indicator ── */}
        <div className="px-6 pt-5 pb-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <DialogHeader>
              <DialogTitle className="text-lg">
                {isEditing ? "Edit Proposal" : "New Proposal"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-3">
              <StepIndicator currentStep={step} steps={STEPS} />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className={cn("flex-1", step === 2 ? "overflow-visible" : "overflow-y-auto")}>

            {/* ═══ STEP 1: PROPERTY & CONTACTS ═══ */}
            {step === 0 && (
              <div className="px-6 py-5 space-y-5">
                <div className="space-y-4">
                  <SectionLabel>Property Address</SectionLabel>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Property *</Label>
                    <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10 text-sm">
                          {selectedProperty
                            ? (
                              <span className="flex items-center gap-2 truncate">
                                <span className="truncate">{selectedProperty.address}</span>
                                {selectedProperty.borough && (
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    ({selectedProperty.borough}{selectedProperty.block ? ` · Blk ${selectedProperty.block}` : ""}{selectedProperty.lot ? ` · Lot ${selectedProperty.lot}` : ""})
                                  </span>
                                )}
                              </span>
                            )
                            : "Search or enter a property address…"}
                          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[500px] p-0" align="start">
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
                                    toast({ title: "Property created", description: `Looking up NYC data for "${newProp.address}"…` });

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
                                        const bbl = [nycData.borough, nycData.block ? `Block ${nycData.block}` : null, nycData.lot ? `Lot ${nycData.lot}` : null].filter(Boolean).join(" · ");
                                        toast({ title: "✓ NYC Data Found", description: bbl || "Property enriched from NYC Open Data." });
                                      }
                                    } else {
                                      toast({ title: "No NYC data found", description: "BBL could not be determined — you can edit the property later to add details manually.", variant: "destructive" });
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
                                  <span className="truncate">{p.address}</span>
                                  {p.borough && <span className="text-xs text-muted-foreground ml-1">({p.borough})</span>}
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

                  {/* Show found property info */}
                  {selectedProperty && (selectedProperty.borough || selectedProperty.bin) && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                      <div className="flex items-center gap-4 flex-wrap">
                        {selectedProperty.borough && <span><span className="text-muted-foreground">Borough:</span> {selectedProperty.borough}</span>}
                        {selectedProperty.block && <span><span className="text-muted-foreground">Block:</span> {selectedProperty.block}</span>}
                        {selectedProperty.lot && <span><span className="text-muted-foreground">Lot:</span> {selectedProperty.lot}</span>}
                        {selectedProperty.bin && <span><span className="text-muted-foreground">BIN:</span> {selectedProperty.bin}</span>}
                        {selectedProperty.zip_code && <span><span className="text-muted-foreground">Zip:</span> {selectedProperty.zip_code}</span>}
                      </div>
                      {selectedProperty.owner_name && (
                        <div><span className="text-muted-foreground">Owner:</span> {selectedProperty.owner_name}</div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Proposal Title *</Label>
                    <Input className="h-10 text-sm" placeholder="e.g., Full Permit Package — 228 Greene Ave" {...form.register("title")} />
                    {form.formState.errors.title && (
                      <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                    )}
                  </div>
                </div>

                <SectionLabel>Contacts</SectionLabel>
                <p className="text-xs text-muted-foreground -mt-1">
                  Add the people involved — who you're billing, who signs, and who should be CC'd.
                </p>
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

              </div>
            )}

            {/* ═══ STEP 2: PARTIES & PLANS ═══ */}
            {step === 1 && (
              <div className="px-6 py-5 space-y-5">
                <SectionLabel>Project Parties</SectionLabel>
                <p className="text-xs text-muted-foreground -mt-1 mb-2">
                  If known, enter key parties — this pre-fills the client PIS form.
                </p>
                <PartyInfoSection form={form} clients={clients} />

                <SectionLabel>Plans</SectionLabel>
                <p className="text-xs text-muted-foreground -mt-1 mb-2">
                  Upload architectural plans to auto-extract a job description for the PIS.
                </p>
                <PlansUploadSection
                  proposalId={proposal?.id}
                  jobDescription={form.watch("job_description") || ""}
                  onJobDescriptionChange={(v) => form.setValue("job_description", v)}
                />
              </div>
            )}

            {/* ═══ STEP 3: SERVICES ═══ */}
            {step === 2 && (
              <div className="flex flex-col min-h-0">
                <div className="grid grid-cols-[auto_1fr_80px_70px_90px_80px_auto] items-center gap-1 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
                  <div className="w-7" />
                  <div className="px-2">Service</div>
                  <div>Type</div>
                  <div className="text-center">Qty</div>
                  <div className="text-right">Price</div>
                  <div className="text-right pr-1">Total</div>
                  <div className="w-7" />
                </div>
                <div className="overflow-visible flex-1">
                  <div className="border rounded-b-lg mx-4 mb-3">
                    {itemFields.map((field, index) => {
                      const lineTotal = calculateLineTotal(watchedItems[index] || {});
                      return (
                        <ServiceLineItem
                          key={field.id} index={index} form={form} lineTotal={lineTotal}
                          serviceCatalog={serviceCatalog} formatCurrency={formatCurrency}
                          canRemove={itemFields.length > 1} onRemove={() => removeItem(index)}
                          autoFocus={lastAddedIndex === index}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ STEP 3: DETAILS & TERMS ═══ */}
            {step === 3 && (
              <div className="px-6 py-5 space-y-4">
                <SectionLabel>Classification</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Project Type</Label>
                    <Select value={form.watch("project_type") || ""} onValueChange={(v) => form.setValue("project_type", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Lead Source</Label>
                    <Select value={form.watch("lead_source") || ""} onValueChange={(v) => form.setValue("lead_source", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {form.watch("lead_source")?.toLowerCase().includes("referral") && (
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs text-muted-foreground">Referred By</Label>
                      <ReferredByCombobox
                        value={form.watch("referred_by") || ""}
                        onChange={(v) => form.setValue("referred_by", v)}
                      />
                    </div>
                  )}
                </div>

                <SectionLabel>Assignment</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Assigned PM</Label>
                    <Select value={form.watch("assigned_pm_id" as any) || ""} onValueChange={(v) => form.setValue("assigned_pm_id" as any, v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select PM…" /></SelectTrigger>
                      <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">PM assigned when proposal converts to a project.</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Sales Person</Label>
                    <Select value={form.watch("sales_person_id") || ""} onValueChange={(v) => form.setValue("sales_person_id", v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Follow-up Reminder</Label>
                    <Input type="date" className="h-9 text-sm" {...form.register("reminder_date")} />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Switch checked={form.watch("notable") || false} onCheckedChange={(c) => form.setValue("notable", c)} />
                  <Label className="text-sm cursor-pointer">Notable Project</Label>
                </div>

                <SectionLabel>Financial</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Deposit %</Label>
                    <Input type="number" min="0" max="100" placeholder="50" className="h-9 text-sm" {...form.register("deposit_percentage")} />
                    {(() => {
                      const pct = Number(form.watch("deposit_percentage")) || 0;
                      const retainerAmt = pct > 0 ? subtotal * pct / 100 : 0;
                      return retainerAmt > 0 ? (
                        <p className="text-xs text-muted-foreground">Retainer: {formatCurrency(retainerAmt)}</p>
                      ) : null;
                    })()}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Valid Until</Label>
                    <Input type="date" className="h-9 text-sm" {...form.register("valid_until")} />
                  </div>
                </div>

                <SectionLabel>Terms & Notes</SectionLabel>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Payment Schedule</Label>
                  <Textarea placeholder="e.g., 50% deposit upon signing, balance due upon permit approval" rows={2} className="text-sm" {...form.register("payment_terms")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Terms & Conditions</Label>
                  <Textarea placeholder="Enter terms and conditions..." rows={4} className="text-sm" {...form.register("terms_conditions")} />
                  <p className="text-xs text-muted-foreground">Default terms can be set in Settings → Company</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Internal Sales Notes</Label>
                  <Textarea placeholder="Strategy notes for your team only — e.g., 'Client is price-sensitive, offer 10% if needed'" rows={2} className="text-sm" {...form.register("notes")} />
                  <p className="text-xs text-muted-foreground">Never shown on proposals or PDFs — internal use only.</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Sticky footer with navigation ── */}
          <div className="border-t px-6 py-3 flex items-center justify-between bg-background shrink-0">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">{totalHours > 0 && `${totalHours} hrs · `}Total</span>
              <span className="text-lg font-bold tabular-nums">{formatCurrency(subtotal)}</span>
              {optionalTotal > 0 && (
                <span className="text-xs text-muted-foreground">+ {formatCurrency(optionalTotal)} optional</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={handleBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
              {step === 0 && (
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
              )}
              {step === 1 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setStep(2)}>
                  Skip
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleNext}>
                  Next <ChevronRightIcon className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Button type="button" size="sm" variant="outline" disabled={isLoading}
                    onClick={() => doSave("save")}>
                    {isLoading && pendingActionRef.current === "save" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={isLoading}
                    onClick={() => doSave("save_preview")}>
                    {isLoading && pendingActionRef.current === "save_preview" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                    Save & Preview
                  </Button>
                  <Button type="button" size="sm" disabled={isLoading} className="bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() => doSave("save_send")}>
                    {isLoading && pendingActionRef.current === "save_send" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                    <Send className="h-3.5 w-3.5 mr-1" /> Sign & Send
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
