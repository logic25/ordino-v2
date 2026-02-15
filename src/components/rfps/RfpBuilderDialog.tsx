import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Building2, Users, Star, FileText, DollarSign, Award, GitBranch, Eye,
  Loader2, Sparkles, Mail, Download, ChevronLeft, ChevronRight, Send, Check,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useRfpContent, useNotableApplications } from "@/hooks/useRfpContent";
import { useUpdateRfpStatus, type Rfp, type RfpStatus } from "@/hooks/useRfps";
import { useRfpDraft, useUpsertRfpDraft, useDeleteRfpDraft } from "@/hooks/useRfpDraft";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RfpPreviewModal } from "./RfpPreviewModal";
import { SortableSectionItem } from "./builder/SortableSectionItem";

interface RfpBuilderDialogProps {
  rfp: Rfp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SECTION_DEFS = [
  { id: "cover_letter", label: "Cover Letter", icon: Mail },
  { id: "company_info", label: "Company Information", icon: Building2 },
  { id: "staff_bios", label: "Staff Bios & Qualifications", icon: Users },
  { id: "org_chart", label: "Organization Chart", icon: GitBranch },
  { id: "notable_projects", label: "Notable Projects", icon: Star },
  { id: "narratives", label: "Narratives & Approach", icon: FileText },
  { id: "pricing", label: "Pricing / Rate Schedule", icon: DollarSign },
  { id: "certifications", label: "Certifications & Licenses", icon: Award },
] as const;

const STEPS = [
  { label: "Select Sections", icon: FileText },
  { label: "Cover Letter", icon: Mail },
  { label: "Review", icon: Eye },
  { label: "Submit", icon: Send },
];

const DEFAULT_SECTIONS = SECTION_DEFS.map((s) => s.id);

export function RfpBuilderDialog({ rfp, open, onOpenChange }: RfpBuilderDialogProps) {
  const [step, setStep] = useState(0);
  const [selectedSections, setSelectedSections] = useState<string[]>([...DEFAULT_SECTIONS]);
  const [sectionOrder, setSectionOrder] = useState<string[]>([...DEFAULT_SECTIONS]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitEmail, setSubmitEmail] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);

  const updateStatus = useUpdateRfpStatus();
  const { toast } = useToast();
  const { data: draft } = useRfpDraft(rfp?.id);
  const upsertDraft = useUpsertRfpDraft();
  const deleteDraft = useDeleteRfpDraft();

  // Fetch content
  const { data: companyInfo = [] } = useRfpContent("company_info");
  const { data: staffBios = [] } = useRfpContent("staff_bio");
  const { data: narratives = [] } = useRfpContent("narrative_template");
  const { data: firmHistory = [] } = useRfpContent("firm_history");
  const { data: pricing = [] } = useRfpContent("pricing");
  const { data: certs = [] } = useRfpContent("certification");
  const { data: notableProjects = [] } = useNotableApplications();

  // Load draft when available
  useEffect(() => {
    if (draft && !draftLoaded && open) {
      setSelectedSections(draft.selected_sections.length ? draft.selected_sections : [...DEFAULT_SECTIONS]);
      setSectionOrder(draft.section_order.length ? draft.section_order : [...DEFAULT_SECTIONS]);
      setCoverLetter(draft.cover_letter || "");
      setSubmitEmail(draft.submit_email || "");
      setStep(draft.wizard_step || 0);
      setDraftLoaded(true);
    }
  }, [draft, draftLoaded, open]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setDraftLoaded(false);
    }
  }, [open]);

  // Auto-save draft
  const saveDraft = useCallback(() => {
    if (!rfp?.id) return;
    upsertDraft.mutate({
      rfp_id: rfp.id,
      selected_sections: selectedSections,
      section_order: sectionOrder,
      cover_letter: coverLetter || null,
      submit_email: submitEmail || null,
      wizard_step: step,
    });
  }, [rfp?.id, selectedSections, sectionOrder, coverLetter, submitEmail, step]);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSectionOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const toggleSection = (id: string) => {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const generateCoverLetter = async () => {
    if (!rfp) return;
    setGeneratingLetter(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-rfp-cover-letter", {
        body: {
          rfp,
          companyInfo: companyInfo[0]?.content,
          staffCount: staffBios.length,
          certifications: certs.map((c) => ({ title: c.title, content: c.content })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCoverLetter(data.letter);
      toast({ title: "Cover letter generated" });
    } catch (e: any) {
      toast({ title: "Error generating cover letter", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingLetter(false);
    }
  };

  const handleSubmitViaEmail = async () => {
    if (!submitEmail || !rfp) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: submitEmail,
          subject: `RFP Response: ${rfp.title}${rfp.rfp_number ? ` (#${rfp.rfp_number})` : ""}`,
          body: buildEmailBody(),
        },
      });
      if (error) throw error;

      await updateStatus.mutateAsync({
        id: rfp.id,
        status: "submitted" as RfpStatus,
        submitted_at: new Date().toISOString(),
      });

      // Clean up draft
      deleteDraft.mutate(rfp.id);

      toast({ title: "RFP response submitted!", description: `Sent to ${submitEmail} and status updated to Submitted.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Submit failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const buildEmailBody = () => {
    const parts: string[] = [];
    if (coverLetter) parts.push(coverLetter);
    parts.push(`\n\n--- RFP Response: ${rfp?.title} ---\n`);
    parts.push("Please find our complete RFP response package attached.");
    parts.push("\nThis response was generated using Ordino RFP Response Builder.");
    return parts.join("\n");
  };

  const contentCounts: Record<string, number> = {
    cover_letter: coverLetter ? 1 : 0,
    company_info: companyInfo.length,
    staff_bios: staffBios.length,
    org_chart: staffBios.filter((s) => (s.content as any)?.include_in_org_chart !== false).length,
    notable_projects: notableProjects.length,
    narratives: narratives.length + firmHistory.length,
    pricing: pricing.length,
    certifications: certs.length,
  };

  const assembledContent = {
    rfp,
    sections: sectionOrder.filter((s) => selectedSections.includes(s)),
    companyInfo: companyInfo[0],
    staffBios,
    notableProjects,
    narratives: [...firmHistory, ...narratives],
    pricing: pricing[0],
    certs,
    coverLetter,
  };

  const draggableSections = sectionOrder.filter((s) => s !== "cover_letter");

  const goNext = () => {
    saveDraft();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) saveDraft(); onOpenChange(o); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b space-y-3">
            <DialogHeader>
              <DialogTitle className="text-lg">
                Build RFP Response — {rfp?.title}
              </DialogTitle>
            </DialogHeader>

            {/* Step indicator */}
            <div className="flex items-center gap-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = i === step;
                const isDone = i < step;
                return (
                  <button
                    key={i}
                    onClick={() => { saveDraft(); setStep(i); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isActive ? "bg-accent text-accent-foreground" :
                      isDone ? "bg-accent/15 text-accent" :
                      "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                );
              })}
            </div>
            <Progress value={((step + 1) / STEPS.length) * 100} className="h-1" />
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {step === 0 && (
              <StepSelectSections
                sectionOrder={draggableSections}
                selectedSections={selectedSections}
                contentCounts={contentCounts}
                onToggle={toggleSection}
                onDragEnd={handleDragEnd}
                sensors={sensors}
              />
            )}
            {step === 1 && (
              <StepCoverLetter
                coverLetter={coverLetter}
                setCoverLetter={setCoverLetter}
                onGenerate={generateCoverLetter}
                generating={generatingLetter}
              />
            )}
            {step === 2 && (
              <StepReview
                selectedSections={selectedSections}
                sectionOrder={sectionOrder}
                contentCounts={contentCounts}
                coverLetter={coverLetter}
                onPreview={() => setPreviewOpen(true)}
              />
            )}
            {step === 3 && (
              <StepSubmit
                submitEmail={submitEmail}
                setSubmitEmail={setSubmitEmail}
                onSubmit={handleSubmitViaEmail}
                submitting={submitting}
                onPreview={() => setPreviewOpen(true)}
              />
            )}
          </div>

          {/* Footer navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
            <Button variant="ghost" size="sm" onClick={goBack} disabled={step === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <p className="text-xs text-muted-foreground">
              {selectedSections.length} sections selected
              {upsertDraft.isPending && " · Saving..."}
            </p>
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={goNext}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => { saveDraft(); onOpenChange(false); }}>
                <Download className="h-4 w-4 mr-1" /> Save & Close
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RfpPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        data={assembledContent}
      />
    </>
  );
}

// --- Step Components ---

function StepSelectSections({
  sectionOrder, selectedSections, contentCounts, onToggle, onDragEnd, sensors,
}: {
  sectionOrder: string[];
  selectedSections: string[];
  contentCounts: Record<string, number>;
  onToggle: (id: string) => void;
  onDragEnd: (e: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Drag to reorder sections. Uncheck any you don't need.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sectionOrder.map((sectionId) => {
              const def = SECTION_DEFS.find((s) => s.id === sectionId);
              if (!def) return null;
              return (
                <SortableSectionItem
                  key={sectionId}
                  id={sectionId}
                  label={def.label}
                  icon={def.icon}
                  count={contentCounts[sectionId] || 0}
                  isSelected={selectedSections.includes(sectionId)}
                  onToggle={() => onToggle(sectionId)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function StepCoverLetter({
  coverLetter, setCoverLetter, onGenerate, generating,
}: {
  coverLetter: string;
  setCoverLetter: (v: string) => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">AI Cover Letter</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate a tailored cover letter or write your own.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onGenerate} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
          {coverLetter ? "Regenerate" : "Generate"}
        </Button>
      </div>
      <Textarea
        value={coverLetter}
        onChange={(e) => setCoverLetter(e.target.value)}
        rows={12}
        placeholder="Your cover letter will appear here after generation, or you can type one manually..."
        className="text-sm"
      />
    </div>
  );
}

function StepReview({
  selectedSections, sectionOrder, contentCounts, coverLetter, onPreview,
}: {
  selectedSections: string[];
  sectionOrder: string[];
  contentCounts: Record<string, number>;
  coverLetter: string;
  onPreview: () => void;
}) {
  const activeSections = sectionOrder.filter((s) => selectedSections.includes(s));
  const totalItems = activeSections.reduce((sum, s) => sum + (contentCounts[s] || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Review Your Package</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeSections.length} sections · {totalItems} total items
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onPreview}>
          <Eye className="h-4 w-4 mr-1" /> Full Preview
        </Button>
      </div>

      <div className="space-y-2">
        {activeSections.map((sectionId, idx) => {
          const def = SECTION_DEFS.find((s) => s.id === sectionId);
          if (!def) return null;
          const Icon = def.icon;
          const count = contentCounts[sectionId] || 0;
          return (
            <div key={sectionId} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/40">
              <span className="text-xs text-muted-foreground tabular-nums w-5">{idx + 1}.</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm flex-1">{def.label}</span>
              <Badge variant={count > 0 ? "secondary" : "outline"} className="text-xs">
                {count}
              </Badge>
            </div>
          );
        })}
      </div>

      {!coverLetter && selectedSections.includes("cover_letter") && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-3 text-sm text-warning flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Cover letter section is selected but empty. Go back to Step 2 to generate one.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepSubmit({
  submitEmail, setSubmitEmail, onSubmit, submitting, onPreview,
}: {
  submitEmail: string;
  setSubmitEmail: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  onPreview: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm">Submit Your Response</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Email your response package. This will mark the RFP as "Submitted".
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm">Recipient email</Label>
        <input
          type="email"
          value={submitEmail}
          onChange={(e) => setSubmitEmail(e.target.value)}
          placeholder="agency@email.com"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onPreview} className="flex-1">
          <Eye className="h-4 w-4 mr-1" /> Preview First
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitting || !submitEmail}
          className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          {submitting ? "Sending..." : "Submit via Email"}
        </Button>
      </div>

      <Separator />

      <p className="text-xs text-muted-foreground">
        You can also save and close to come back later. Your draft is automatically saved.
      </p>
    </div>
  );
}
