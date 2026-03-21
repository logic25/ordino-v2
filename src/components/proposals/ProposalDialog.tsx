import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRightIcon, Loader2, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProposalContactInput } from "@/hooks/useProposalContacts";
import type { ProposalWithRelations, ProposalFormInput } from "@/hooks/useProposals";
import { PlansUploadSection } from "@/components/proposals/PlansUploadSection";

import { STEPS, formatCurrency } from "./proposal-dialog/proposalSchema";
import { StepIndicator, SectionLabel } from "./proposal-dialog/DialogHelpers";
import { PartyInfoSection } from "./proposal-dialog/PartyInfoSection";
import { PropertyContactsStep } from "./proposal-dialog/PropertyContactsStep";
import { DetailsTermsStep } from "./proposal-dialog/DetailsTermsStep";
import { ServicesStep } from "./proposal-dialog/ServicesStep";
import { useProposalForm, type ProposalSaveAction } from "./proposal-dialog/useProposalForm";

export type { ProposalSaveAction };

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
  const {
    isEditing, clients, profiles,
    step, setStep, contacts, setContacts, lastAddedIndex,
    form, itemFields, removeItem,
    dndSensors, handleDragEnd, watchedItems,
    subtotal, optionalTotal, totalHours,
    handleNext, doSave, pendingActionRef, planFilesRef,
    serviceCatalog, workTypeDisciplines,
  } = useProposalForm({ open, proposal, defaultPropertyId, onSubmit, onOpenChange });

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
              <ServicesStep
                form={form} itemFields={itemFields} removeItem={removeItem}
                watchedItems={watchedItems} dndSensors={dndSensors}
                handleDragEnd={handleDragEnd} serviceCatalog={serviceCatalog}
                lastAddedIndex={lastAddedIndex} workTypeDisciplines={workTypeDisciplines}
              />
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
