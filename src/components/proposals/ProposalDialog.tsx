import React, { useEffect, useState, useRef, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRightIcon, Loader2, Send, X } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
import { useCompanySettings, WORK_TYPE_DISCIPLINES } from "@/hooks/useCompanySettings";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useToast } from "@/hooks/use-toast";
import { useProposalContacts, type ProposalContactInput } from "@/hooks/useProposalContacts";
import { PlansUploadSection } from "@/components/proposals/PlansUploadSection";
import type { ProposalWithRelations, ProposalFormInput } from "@/hooks/useProposals";

// Extracted sub-components
import { proposalSchema, type ProposalFormData, STEPS, DEFAULT_ITEM, getDefaultValues, calculateLineTotal, formatCurrency } from "./proposal-dialog/proposalSchema";
import { StepIndicator, SectionLabel } from "./proposal-dialog/DialogHelpers";
import { ServiceLineItem } from "./proposal-dialog/ServiceLineItem";
import { PartyInfoSection } from "./proposal-dialog/PartyInfoSection";
import { PropertyContactsStep } from "./proposal-dialog/PropertyContactsStep";
import { DetailsTermsStep } from "./proposal-dialog/DetailsTermsStep";

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
  const { data: clients = [] } = useClients();
  const { data: companyData } = useCompanySettings();
  const { data: profiles = [] } = useCompanyProfiles();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [contacts, setContacts] = useState<ProposalContactInput[]>([]);
  const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null);

  const { data: existingContacts = [] } = useProposalContacts(proposal?.id);

  const { data: fetchedItems } = useQuery({
    queryKey: ["proposal-items", proposal?.id],
    queryFn: async () => {
      if (!proposal?.id) return [];
      const { data, error } = await supabase
        .from("proposal_items").select("*").eq("proposal_id", proposal.id).order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!proposal?.id,
  });

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
    defaultValues: getDefaultValues(defaultPropertyId, defaultTerms),
  });

  const { fields: itemFields, append: appendItem, remove: removeItem, move: moveItem } = useFieldArray({
    control: form.control, name: "items",
  });

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = itemFields.findIndex((f) => f.id === active.id);
      const newIndex = itemFields.findIndex((f) => f.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) moveItem(oldIndex, newIndex);
    }
  }, [itemFields, moveItem]);

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;
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
        lead_source: p.lead_source || "", referred_by: p.referred_by || "", referred_by_person: p.referred_by_person || "",
        project_type: p.project_type || "",
        sales_person_id: p.sales_person_id || "", billed_to_name: p.billed_to_name || "",
        billed_to_email: p.billed_to_email || "", reminder_date: p.reminder_date || "",
        notable: p.notable || false,
        architect_company: p.architect_company || "", architect_name: p.architect_name || "",
        architect_phone: p.architect_phone || "", architect_email: p.architect_email || "",
        architect_license_type: p.architect_license_type || "", architect_license_number: p.architect_license_number || "",
        gc_company: p.gc_company || "", gc_name: p.gc_name || "", gc_phone: p.gc_phone || "", gc_email: p.gc_email || "",
        sia_name: p.sia_name || "", sia_company: p.sia_company || "", sia_phone: p.sia_phone || "", sia_email: p.sia_email || "",
        tpp_name: p.tpp_name || "", tpp_email: p.tpp_email || "",
        job_description: p.job_description || "", unit_number: p.unit_number || "",
        items: proposalWithItems.items?.length ? proposalWithItems.items.map((i: any, idx: number) => ({
          id: i.id, name: i.name, description: i.description || "",
          quantity: Number(i.quantity), unit_price: Number(i.unit_price),
          estimated_hours: Number(i.estimated_hours) || 0,
          discount_percent: Number(i.discount_percent) || 0,
          fee_type: i.fee_type || "fixed", sort_order: i.sort_order ?? undefined,
          is_optional: i.is_optional || false,
          disciplines: i.disciplines || [],
          discipline_fee: Number(i.discipline_fee) || 0,
        })) : [{ ...DEFAULT_ITEM }],
      });
      setStep(0);
    } else {
      form.reset(getDefaultValues(defaultPropertyId, defaultTerms));
      setContacts([]);
      setStep(0);
    }
  }, [open, proposalWithItems, proposal, defaultPropertyId, defaultTerms]);

  const watchedItems = form.watch("items");

  // Auto-add empty row when last row gets a name
  const lastItemName = watchedItems.length > 0 ? watchedItems[watchedItems.length - 1]?.name : "";
  const itemCount = watchedItems.length;
  const appendingRef = useRef(false);

  useEffect(() => {
    if (appendingRef.current) return;
    const needsEmpty = itemCount === 0 || (itemCount > 0 && lastItemName && lastItemName.trim() !== "");
    if (needsEmpty) {
      appendingRef.current = true;
      appendItem({ ...DEFAULT_ITEM }, { shouldFocus: false });
      setTimeout(() => { appendingRef.current = false; }, 0);
    }
  }, [lastItemName, itemCount]);

  const subtotal = watchedItems.reduce((sum, item) => item.is_optional ? sum : sum + calculateLineTotal(item), 0);
  const optionalTotal = watchedItems.reduce((sum, item) => item.is_optional ? sum + calculateLineTotal(item) : sum, 0);
  const totalHours = watchedItems.reduce((sum, item) => item.is_optional ? sum : sum + (Number(item.estimated_hours) || 0), 0);

  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0) {
      if (!form.getValues("property_id")) {
        toast({ title: "Property required", description: "Please select or create a property address.", variant: "destructive" });
        return false;
      }
      if (!form.getValues("title")?.trim()) {
        toast({ title: "Title required", description: "Please enter a proposal title.", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    const nextStep = Math.min(step + 1, STEPS.length - 1);

    // Pre-fill Architect from applicant contact when moving to Parties step
    if (step === 0 && nextStep === 1) {
      const applicant = contacts.find((c) => c.role === "applicant");
      if (applicant) {
        const opts = { shouldDirty: true };
        if (!form.getValues("architect_company") && applicant.company_name) form.setValue("architect_company", applicant.company_name, opts);
        if (!form.getValues("architect_name") && applicant.name) form.setValue("architect_name", applicant.name, opts);
        if (!form.getValues("architect_email") && applicant.email) form.setValue("architect_email", applicant.email, opts);
        if (!form.getValues("architect_phone") && applicant.phone) form.setValue("architect_phone", applicant.phone, opts);
        if (applicant.client_id && (!form.getValues("architect_license_type") || !form.getValues("architect_license_number"))) {
          supabase
            .from("client_contacts")
            .select("license_type, license_number")
            .eq("client_id", applicant.client_id)
            .eq("is_primary", true)
            .limit(1)
            .then(({ data: crmContacts }) => {
              const crm = crmContacts?.[0];
              if (crm) {
                if (crm.license_type && !form.getValues("architect_license_type")) form.setValue("architect_license_type", crm.license_type, opts);
                if (crm.license_number && !form.getValues("architect_license_number")) form.setValue("architect_license_number", crm.license_number, opts);
              }
            });
        }
      }
    }
    setStep(nextStep);
  };

  const pendingActionRef = useRef<ProposalSaveAction>("save");
  const planFilesRef = useRef<{ storage_path: string }[]>([]);

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
      referred_by_person: data.referred_by_person || null,
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
      drawings_storage_paths: planFilesRef.current.map(f => f.storage_path),
      unit_number: (data as any).unit_number || null,
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
    form.handleSubmit(handleSubmit, (errors) => {
      const missing = Object.entries(errors).map(([key, err]) => {
        const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return `${label}: ${(err as any)?.message || "required"}`;
      });
      toast({ title: "Missing required fields", description: missing.join(", "), variant: "destructive" });
    })();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[900px] max-h-[96vh] h-[96vh] flex flex-col p-0 gap-0 [&>button:last-child]:hidden overflow-hidden"
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]') || target.closest('[data-radix-popper-content-wrapper]')) return;
          e.preventDefault();
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]') || target.closest('[data-radix-popper-content-wrapper]')) return;
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
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

        {/* Scrollable body */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className={cn("flex-1", step === 2 ? "min-h-0 flex flex-col" : "overflow-y-auto")}>

            {step === 0 && (
              <PropertyContactsStep form={form} contacts={contacts} onContactsChange={setContacts} />
            )}

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
                  onFilesChange={(f) => planFilesRef.current = f}
                />
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col min-h-0 flex-1">
                <div className="grid grid-cols-[auto_auto_1fr_80px_70px_90px_80px_auto] items-center gap-1 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
                  <div className="w-7" /><div className="w-7" />
                  <div className="px-2">Service</div>
                  <div>Type</div>
                  <div className="text-center">Qty</div>
                  <div className="text-right">Price</div>
                  <div className="text-right pr-1">Total</div>
                  <div className="w-7" />
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={itemFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                      <div className="border rounded-b-lg mx-4 mb-3">
                        {itemFields.map((field, index) => (
                          <ServiceLineItem
                            key={field.id} sortableId={field.id} index={index} form={form}
                            lineTotal={calculateLineTotal(watchedItems[index] || {})}
                            serviceCatalog={serviceCatalog}
                            canRemove={itemFields.length > 1} onRemove={() => removeItem(index)}
                            autoFocus={lastAddedIndex === index}
                            workTypeDisciplines={WORK_TYPE_DISCIPLINES}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            )}

            {step === 3 && (
              <DetailsTermsStep form={form} profiles={profiles} subtotal={subtotal} />
            )}
          </div>

          {/* Sticky footer */}
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
                <Button type="button" variant="outline" size="sm" onClick={() => setStep(Math.max(step - 1, 0))}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
              {step === 0 && (
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              )}
              {step === 1 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setStep(2)}>Skip</Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleNext}>
                  Next <ChevronRightIcon className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => doSave("save")}>
                    {isLoading && pendingActionRef.current === "save" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={isLoading} onClick={() => doSave("save_preview")}>
                    {isLoading && pendingActionRef.current === "save_preview" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                    Save & Preview
                  </Button>
                  <Button type="button" size="sm" disabled={isLoading} className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => doSave("save_send")}>
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
