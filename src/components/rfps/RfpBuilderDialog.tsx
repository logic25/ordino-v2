import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Building2, Users, Star, FileText, DollarSign, Award, GitBranch, Eye,
  Loader2, Sparkles, Mail, Download, ChevronLeft, ChevronRight, Send, Check,
  Pencil, ExternalLink, ChevronDown, Paperclip,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useRfpContent, useNotableApplications } from "@/hooks/useRfpContent";
import { useProjectSheets } from "@/hooks/useProjectSheets";
import { useUpdateRfpStatus, type Rfp, type RfpStatus } from "@/hooks/useRfps";
import { useRfpDraft, useUpsertRfpDraft, useDeleteRfpDraft } from "@/hooks/useRfpDraft";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RfpPreviewModal } from "./RfpPreviewModal";
import { buildRfpEmailHtml } from "./buildRfpEmailBody";
import { SortableSectionItem } from "./builder/SortableSectionItem";
import { useNavigate } from "react-router-dom";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useCompanySettings } from "@/hooks/useCompanySettings";

interface RfpBuilderDialogProps {
  rfp: Rfp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SECTION_DEFS = [
  { id: "cover_letter", label: "Cover Letter", icon: Mail, libraryTab: null },
  { id: "firm_overview", label: "About Our Firm", icon: FileText, libraryTab: "narratives" },
  { id: "company_info", label: "Company Details", icon: Building2, libraryTab: "company" },
  { id: "staff_bios", label: "Key Personnel", icon: Users, libraryTab: "staff" },
  { id: "org_chart", label: "Organization Chart", icon: GitBranch, libraryTab: "staff" },
  { id: "notable_projects", label: "Notable Projects", icon: Star, libraryTab: "projects" },
  { id: "narratives", label: "Narratives & Approach", icon: FileText, libraryTab: "narratives" },
  { id: "pricing", label: "Pricing / Rate Schedule", icon: DollarSign, libraryTab: "pricing" },
  { id: "certifications", label: "Certifications & Licenses", icon: Award, libraryTab: "certs" },
  { id: "attachments", label: "Attachments", icon: Paperclip, libraryTab: "attachments" },
] as const;

const STEPS = [
  { label: "Select", icon: FileText },
  { label: "Edit", icon: Pencil },
  { label: "Cover Letter", icon: Mail },
  { label: "Review", icon: Eye },
  { label: "Submit", icon: Send },
];

const DEFAULT_SECTIONS = SECTION_DEFS.map((s) => s.id);

export function RfpBuilderDialog({ rfp, open, onOpenChange }: RfpBuilderDialogProps) {
  const [step, setStep] = useState(0);
  const [selectedSections, setSelectedSections] = useState<string[]>([...DEFAULT_SECTIONS]);
  const [sectionOrder, setSectionOrder] = useState<string[]>([...DEFAULT_SECTIONS]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[] | null>(null); // null = all selected (projects opt-out)
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>([]); // attachments are opt-in
  const [includeLogo, setIncludeLogo] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitEmail, setSubmitEmail] = useState("");
  const [submitCcEmails, setSubmitCcEmails] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);

  const updateStatus = useUpdateRfpStatus();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { track } = useTelemetry();
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
  const { data: rfpAttachments = [] } = useRfpContent("attachment");
  const { data: notableProjects = [] } = useNotableApplications();
  const { data: projectSheets = [] } = useProjectSheets();

  // Merge notable applications + custom project sheets into a unified list
  const allNotableProjects = [
    ...notableProjects,
    ...projectSheets.map((s) => ({
      id: s.id,
      description: s.description,
      properties: { address: s.location },
      application_type: null,
      estimated_value: s.estimated_value,
      _isSheet: true,
      _title: s.title,
      client_name: s.client_name,
      photos: s.photos || [],
      reference_contact_name: s.reference_contact_name,
      reference_contact_title: s.reference_contact_title,
      reference_contact_email: s.reference_contact_email,
      reference_contact_phone: s.reference_contact_phone,
      completion_date: s.completion_date,
    })),
  ];

  // Initialize selectedProjectIds when projects load (select all by default)
  useEffect(() => {
    if (selectedProjectIds === null && allNotableProjects.length > 0 && !draftLoaded) {
      setSelectedProjectIds(allNotableProjects.map((p: any) => p.id));
    }
  }, [allNotableProjects, selectedProjectIds, draftLoaded]);

  // Load draft only once on open
  useEffect(() => {
    if (draft && !draftLoaded && !dirty && open) {
      setSelectedSections(draft.selected_sections.length ? draft.selected_sections : [...DEFAULT_SECTIONS]);
      setSectionOrder(draft.section_order.length ? draft.section_order : [...DEFAULT_SECTIONS]);
      setCoverLetter(draft.cover_letter || "");
      setSubmitEmail(draft.submit_email || "");
      setStep(draft.wizard_step || 0);
      const draftAny = draft as any;
      if (draftAny.selected_project_ids && Array.isArray(draftAny.selected_project_ids) && draftAny.selected_project_ids.length > 0) {
        setSelectedProjectIds(draftAny.selected_project_ids);
      } else if (allNotableProjects.length > 0) {
        setSelectedProjectIds(allNotableProjects.map((p: any) => p.id));
      }
      // Attachments: opt-in. Use draft selection if present, otherwise empty.
      if (draftAny.selected_attachment_ids && Array.isArray(draftAny.selected_attachment_ids)) {
        // Intersect with current library so stale IDs drop out
        const libIds = new Set(rfpAttachments.map((a: any) => a.id));
        setSelectedAttachmentIds(draftAny.selected_attachment_ids.filter((id: string) => libIds.has(id)));
      } else {
        setSelectedAttachmentIds([]);
      }
      if (typeof draftAny.include_logo === "boolean") {
        setIncludeLogo(draftAny.include_logo);
      }
      setDraftLoaded(true);
    }
  }, [draft, draftLoaded, dirty, open, allNotableProjects, rfpAttachments]);

  useEffect(() => {
    if (!open) { setDraftLoaded(false); setDirty(false); setSelectedProjectIds(null); setSelectedAttachmentIds([]); setIncludeLogo(true); }
  }, [open]);

  const saveDraft = useCallback((overrideStep?: number) => {
    if (!rfp?.id) return;
    upsertDraft.mutate({
      rfp_id: rfp.id,
      selected_sections: selectedSections,
      section_order: sectionOrder,
      cover_letter: coverLetter || null,
      submit_email: submitEmail || null,
      wizard_step: overrideStep ?? step,
      selected_project_ids: selectedProjectIds ?? undefined,
      selected_attachment_ids: selectedAttachmentIds,
      include_logo: includeLogo,
    } as any);
  }, [rfp?.id, selectedSections, sectionOrder, coverLetter, submitEmail, step, selectedProjectIds, selectedAttachmentIds, includeLogo]);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDirty(true);
      setSectionOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const toggleSection = (id: string) => {
    setDirty(true);
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
      track("rfps", "builder_cover_letter_generated", { rfp_id: rfp.id });
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

    // Helper: jsonb fields sometimes round-trip as JSON strings — normalize.
    const asObj = (v: any): Record<string, any> | null => {
      if (!v) return null;
      if (typeof v === "string") {
        try { return JSON.parse(v); } catch { return null; }
      }
      return typeof v === "object" ? v : null;
    };

    console.log("[RFP submit] starting", {
      selectedAttachmentIds,
      rfpAttachmentsCount: rfpAttachments.length,
      filteredRfpAttachmentsCount: filteredRfpAttachments.length,
      certsCount: certs.length,
      staffBiosCount: staffBios.length,
      sectionsIncludesStaffBios: selectedSections.includes("staff_bios"),
    });

    try {
      // Collect certification file attachments from content.document_path or file_url
      const attachments: { filename: string; content: string; mime_type: string }[] = [];
      const failedAttachments: string[] = [];
      for (const cert of certs) {
        const content = asObj(cert.content);
        const docPath = content?.document_path as string | undefined;
        const docName = content?.document_name as string | undefined;
        const fileUrl = cert.file_url;

        if (!docPath && !fileUrl) continue;

        try {
          let blob: Blob;
          if (docPath) {
            // Download from rfp-documents storage bucket
            const { data, error: dlErr } = await supabase.storage.from("rfp-documents").download(docPath);
            if (dlErr || !data) { console.warn("[RFP submit] Failed to download cert from storage:", docPath, dlErr); continue; }
            blob = data;
          } else {
            const res = await fetch(fileUrl!);
            if (!res.ok) continue;
            blob = await res.blob();
          }
          const arrayBuf = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          const ext = (docName || docPath || fileUrl || "file.pdf").split(".").pop()?.split("?")[0] || "pdf";
          const filename = `${cert.title.replace(/[^a-zA-Z0-9_\- ]/g, "")}.${ext}`;
          attachments.push({
            filename,
            content: base64,
            mime_type: blob.type || "application/pdf",
          });
        } catch (e) {
          console.warn("[RFP submit] Failed to fetch cert attachment:", cert.title, e);
        }
      }

      const ccList = submitCcEmails.split(",").map(e => e.trim()).filter(Boolean).join(",");

      // Collect staff resume attachments
      if (selectedSections.includes("staff_bios")) {
        for (const staff of staffBios) {
          const content = asObj(staff.content);
          const resumeUrl = content?.resume_url as string | undefined;
          const resumeFilename = content?.resume_filename as string | undefined;
          const staffName = content?.name || staff.title || "Staff";

          if (!resumeUrl) continue;

          try {
            const { data, error: dlErr } = await supabase.storage.from("rfp-documents").download(resumeUrl);
            if (dlErr || !data) {
              console.warn("[RFP submit] Failed to download resume:", resumeUrl, dlErr);
              failedAttachments.push(`Resume for ${staffName}`);
              continue;
            }
            const arrayBuf = await data.arrayBuffer();
            const bytes = new Uint8Array(arrayBuf);
            let binary = "";
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            const base64 = btoa(binary);
            const ext = (resumeFilename || "resume.pdf").split(".").pop()?.split("?")[0] || "pdf";
            const filename = `Resume - ${staffName.replace(/[^a-zA-Z0-9_\- ]/g, "")}.${ext}`;
            attachments.push({
              filename,
              content: base64,
              mime_type: data.type || "application/pdf",
            });
          } catch (e) {
            console.warn("[RFP submit] Failed to fetch resume for:", staffName, e);
            failedAttachments.push(`Resume for ${staffName}`);
          }
        }
      }

      // Collect uploaded attachment files
      console.log("[RFP submit] processing filtered library attachments", filteredRfpAttachments.map(a => ({
        id: a.id, title: a.title,
      })));
      if (filteredRfpAttachments.length > 0) {
        for (const att of filteredRfpAttachments) {
          const c = asObj(att.content);
          const filePath = c?.file_path as string | undefined;
          const attFilename = c?.filename as string | undefined;
          const mimeType = c?.mime_type as string | undefined;
          const label = attFilename || att.title || filePath || "attachment";
          if (!filePath) {
            console.warn("[RFP submit] skipping attachment with no file_path", att.id, att.title);
            failedAttachments.push(label);
            continue;
          }
          try {
            const { data, error: dlErr } = await supabase.storage.from("rfp-documents").download(filePath);
            if (dlErr || !data) {
              console.warn("[RFP submit] Failed to download attachment:", filePath, dlErr);
              failedAttachments.push(label);
              continue;
            }
            const arrayBuf = await data.arrayBuffer();
            const bytes = new Uint8Array(arrayBuf);
            if (bytes.length === 0) {
              console.warn("[RFP submit] Attachment downloaded as 0 bytes:", filePath);
              failedAttachments.push(label);
              continue;
            }
            let binary = "";
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            const base64 = btoa(binary);
            const ext = (attFilename || filePath).split(".").pop()?.split("?")[0] || "pdf";
            const safeName = (attFilename || filePath.split("/").pop() || "attachment").replace(/[^a-zA-Z0-9_\-. ]/g, "");
            attachments.push({
              filename: safeName.includes(".") ? safeName : `${safeName}.${ext}`,
              content: base64,
              mime_type: mimeType || data.type || "application/octet-stream",
            });
            console.log("[RFP submit] attachment added", safeName, "size_bytes≈", bytes.length);
          } catch (e) {
            console.warn("[RFP submit] Failed to fetch attachment:", label, e);
            failedAttachments.push(label);
          }
        }
      }

      // If anything the user explicitly selected failed to load, ABORT
      // rather than send an email missing the file. This is the regression
      // guard for the "logo isn't on the email" bug that hid for months
      // because the loop silently `continue`d past download failures.
      if (failedAttachments.length > 0) {
        const list = failedAttachments.join(", ");
        toast({
          title: "Couldn't attach files — RFP not sent",
          description: `Failed to load: ${list}. Please re-upload these files and try again.`,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      console.log("[RFP submit] invoking gmail-send with", attachments.length, "attachment(s)");

      const { error } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: submitEmail,
          cc: ccList || undefined,
          subject: `RFP Response: ${rfp.title}${rfp.rfp_number ? ` (#${rfp.rfp_number})` : ""}`,
          html_body: await buildEmailBody(),
          attachments: attachments.length > 0 ? attachments : undefined,
        },
      });
      if (error) throw error;
      await updateStatus.mutateAsync({
        id: rfp.id,
        status: "submitted" as RfpStatus,
        submitted_at: new Date().toISOString(),
      });
      deleteDraft.mutate(rfp.id);
      track("rfps", "builder_submitted", { rfp_id: rfp.id, submit_email: submitEmail });
      toast({ title: "RFP response submitted!", description: `Sent to ${submitEmail}.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Submit failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const buildEmailBody = async () => {
    return await buildRfpEmailHtml(assembledContent);
  };

  // Filtered notable projects based on selection
  const filteredNotableProjects = selectedProjectIds
    ? allNotableProjects.filter((p: any) => selectedProjectIds.includes(p.id))
    : allNotableProjects;

  // Filtered RFP attachments based on selection (opt-in)
  const filteredRfpAttachments = rfpAttachments.filter((a: any) =>
    selectedAttachmentIds.includes(a.id)
  );

  const contentCounts: Record<string, number> = {
    cover_letter: coverLetter ? 1 : 0,
    firm_overview: firmHistory.length,
    company_info: companyInfo.length,
    staff_bios: staffBios.length,
    org_chart: staffBios.filter((s) => (s.content as any)?.include_in_org_chart !== false).length,
    notable_projects: filteredNotableProjects.length,
    narratives: narratives.length,
    pricing: pricing.length,
    certifications: certs.length,
    attachments: selectedAttachmentIds.length,
  };

  // Content data map for editing
  const sectionContentMap: Record<string, { items: any[]; type: string }> = {
    company_info: { items: companyInfo, type: "company_info" },
    firm_overview: { items: firmHistory, type: "firm_history" },
    staff_bios: { items: staffBios, type: "staff_bio" },
    org_chart: { items: staffBios, type: "staff_bio" },
    notable_projects: { items: allNotableProjects, type: "notable_project" },
    narratives: { items: [...narratives], type: "narrative" },
    pricing: { items: pricing, type: "pricing" },
    certifications: { items: certs, type: "certification" },
    attachments: { items: rfpAttachments, type: "attachments" },
  };

  const { data: companyData } = useCompanySettings();

  // Prefer a logo uploaded into the RFP Content Library (Files tab, tagged "logo")
  // over the global company settings logo. Resolve to a signed URL since the
  // rfp-documents bucket is private.
  const [rfpLogoUrl, setRfpLogoUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    // Only use the logo if it's currently selected (otherwise the user has
    // chosen to exclude it from this response).
    const logoAttachment = filteredRfpAttachments.find((a) => {
      const c = a.content as any;
      return c?.tag === "logo" && c?.file_path;
    });
    if (!logoAttachment) {
      setRfpLogoUrl(undefined);
      return;
    }
    const path = (logoAttachment.content as any).file_path as string;
    supabase.storage
      .from("rfp-documents")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setRfpLogoUrl(data?.signedUrl || undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [filteredRfpAttachments]);

  const assembledContent = {
    rfp,
    sections: sectionOrder.filter((s) => selectedSections.includes(s)),
    companyInfo: companyInfo[0],
    staffBios,
    notableProjects: filteredNotableProjects,
    narratives: [...narratives],
    firmHistory: [...firmHistory],
    pricing: pricing[0],
    certs,
    coverLetter,
    logoUrl: includeLogo ? (rfpLogoUrl || companyData?.settings?.company_logo_url || companyData?.logo_url || undefined) : undefined,
    companyName: companyData?.name || undefined,
    companyAddress: companyData?.address || companyData?.settings?.company_address || undefined,
    companyPhone: companyData?.phone || companyData?.settings?.company_phone || undefined,
    companyEmail: companyData?.email || companyData?.settings?.company_email || undefined,
    companyWebsite: companyData?.website || companyData?.settings?.company_website || undefined,
    attachments: filteredRfpAttachments,
  };

  const draggableSections = sectionOrder.filter((s) => s !== "cover_letter");

  const toggleProjectSelection = (projectId: string) => {
    setDirty(true);
    setSelectedProjectIds((prev) => {
      const ids = prev || allNotableProjects.map((p: any) => p.id);
      return ids.includes(projectId)
        ? ids.filter((id) => id !== projectId)
        : [...ids, projectId];
    });
  };

  const selectAllProjects = () => {
    setDirty(true);
    setSelectedProjectIds(allNotableProjects.map((p: any) => p.id));
  };

  const clearProjectSelection = () => {
    setDirty(true);
    setSelectedProjectIds([]);
  };

  const toggleAttachmentSelection = (attachmentId: string) => {
    setDirty(true);
    setSelectedAttachmentIds((prev) =>
      prev.includes(attachmentId)
        ? prev.filter((id) => id !== attachmentId)
        : [...prev, attachmentId]
    );
  };

  const selectAllAttachments = () => {
    setDirty(true);
    setSelectedAttachmentIds(rfpAttachments.map((a: any) => a.id));
  };

  const clearAttachmentSelection = () => {
    setDirty(true);
    setSelectedAttachmentIds([]);
  };

  const goNext = () => { const next = Math.min(step + 1, STEPS.length - 1); setDirty(true); saveDraft(next); setStep(next); };
  const goBack = () => { setDirty(true); setStep((s) => Math.max(s - 1, 0)); };

  const goToLibrary = (tab?: string | null) => {
    saveDraft();
    onOpenChange(false);
    navigate(`/rfps/library${tab ? `?tab=${tab}` : ""}${rfp?.id ? `${tab ? "&" : "?"}returnTo=${rfp.id}` : ""}`);
  };

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
            <div className="flex items-center gap-1 flex-wrap">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = i === step;
                const isDone = i < step;
                return (
                  <button
                    key={i}
                    onClick={() => { setDirty(true); saveDraft(i); setStep(i); }}
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
              <StepEditContent
                selectedSections={selectedSections}
                sectionOrder={sectionOrder}
                sectionContentMap={sectionContentMap}
                onGoToLibrary={goToLibrary}
                selectedProjectIds={selectedProjectIds || allNotableProjects.map((p: any) => p.id)}
                onToggleProject={toggleProjectSelection}
                onSelectAllProjects={selectAllProjects}
                onClearProjects={clearProjectSelection}
                selectedAttachmentIds={selectedAttachmentIds}
                onToggleAttachment={toggleAttachmentSelection}
                onSelectAllAttachments={selectAllAttachments}
                onClearAttachments={clearAttachmentSelection}
                includeLogo={includeLogo}
                onToggleIncludeLogo={() => { setDirty(true); setIncludeLogo((v) => !v); }}
              />
            )}
            {step === 2 && (
              <StepCoverLetter
                coverLetter={coverLetter}
                setCoverLetter={setCoverLetter}
                onGenerate={generateCoverLetter}
                generating={generatingLetter}
              />
            )}
            {step === 3 && (
              <StepReview
                selectedSections={selectedSections}
                sectionOrder={sectionOrder}
                contentCounts={contentCounts}
                coverLetter={coverLetter}
                onPreview={() => setPreviewOpen(true)}
              />
            )}
            {step === 4 && (
              <StepSubmit
                submitEmail={submitEmail}
                setSubmitEmail={setSubmitEmail}
                submitCcEmails={submitCcEmails}
                setSubmitCcEmails={setSubmitCcEmails}
                onSubmit={handleSubmitViaEmail}
                submitting={submitting}
                onPreview={() => setPreviewOpen(true)}
              />
            )}
          </div>

          {/* Footer */}
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

// ─── Step: Select Sections ───

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

// ─── Step: Edit Content ───

function StepEditContent({
  selectedSections,
  sectionOrder,
  sectionContentMap,
  onGoToLibrary,
  selectedProjectIds,
  onToggleProject,
  onSelectAllProjects,
  onClearProjects,
  selectedAttachmentIds,
  onToggleAttachment,
  onSelectAllAttachments,
  onClearAttachments,
  includeLogo,
  onToggleIncludeLogo,
}: {
  selectedSections: string[];
  sectionOrder: string[];
  sectionContentMap: Record<string, { items: any[]; type: string }>;
  onGoToLibrary: (tab?: string | null) => void;
  selectedProjectIds: string[];
  onToggleProject: (id: string) => void;
  onSelectAllProjects: () => void;
  onClearProjects: () => void;
  selectedAttachmentIds: string[];
  onToggleAttachment: (id: string) => void;
  onSelectAllAttachments: () => void;
  onClearAttachments: () => void;
  includeLogo: boolean;
  onToggleIncludeLogo: () => void;
}) {
  const activeSections = sectionOrder
    .filter((s) => selectedSections.includes(s) && s !== "cover_letter");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Edit Section Content</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and quick-edit content, or open the full Content Library.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {activeSections.map((sectionId) => {
          const def = SECTION_DEFS.find((s) => s.id === sectionId);
          if (!def) return null;
          const Icon = def.icon;
          const content = sectionContentMap[sectionId];
          const items = content?.items || [];
          const isNotableProjects = sectionId === "notable_projects";
          const isAttachments = sectionId === "attachments";
          const isToggleable = isNotableProjects || isAttachments;
          const currentSelectedIds = isAttachments ? selectedAttachmentIds : selectedProjectIds;
          const onToggleItem = isAttachments ? onToggleAttachment : onToggleProject;
          const onSelectAll = isAttachments ? onSelectAllAttachments : onSelectAllProjects;
          const onClear = isAttachments ? onClearAttachments : onClearProjects;
          const toggleHelp = isAttachments
            ? "Choose exactly which uploaded files (logo, attachments) to include in this response."
            : "Choose exactly which project sheets and notable projects to include in this response.";
          const selectedCount = isToggleable ? currentSelectedIds.length : items.length;

          return (
            <Collapsible key={sectionId}>
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
                    <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium flex-1">{def.label}</span>
                    <Badge variant={selectedCount > 0 ? "secondary" : "outline"} className="text-xs">
                      {isToggleable ? `${selectedCount}/${items.length} selected` : `${items.length} ${items.length === 1 ? "item" : "items"}`}
                    </Badge>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t px-4 py-3 space-y-3 bg-muted/10">
                    {isAttachments && (
                      <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 cursor-pointer">
                        <Checkbox
                          checked={includeLogo}
                          onCheckedChange={onToggleIncludeLogo}
                        />
                        <div className="text-xs">
                          <p className="font-medium">Include company logo in header</p>
                          <p className="text-muted-foreground">Adds your company logo to the top of the response email and PDF.</p>
                        </div>
                      </label>
                    )}
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No content yet. Use the button below to add items.
                      </p>
                    ) : (
                      <>
                        {isToggleable && (
                          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
                            <p className="text-xs text-muted-foreground">
                              {toggleHelp}
                            </p>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onSelectAll}>
                                Select All
                              </Button>
                              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onClear}>
                                Clear
                              </Button>
                            </div>
                          </div>
                        )}
                        <ScrollArea className="h-[320px] rounded-md">
                          <div className="space-y-2 pr-3">
                            {items.map((item: any, idx: number) => {
                              const checked = isToggleable ? currentSelectedIds.includes(item.id) : false;
                              return (
                                <div
                                  key={item.id || idx}
                                  role="button"
                                  tabIndex={0}
                                  className="w-full rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                                  onClick={(e) => {
                                    if (!isToggleable) return;
                                    // Prevent double-toggle: if the click originated from the Checkbox (a <button>), skip — onCheckedChange already handled it
                                    const target = e.target as HTMLElement;
                                    if (target.closest('[role="checkbox"]') || target.closest('button[type="button"]')) return;
                                    onToggleItem(item.id);
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isToggleable && onToggleItem(item.id); } }}
                                >
                                  <div className="flex items-start gap-2">
                                    {isToggleable && (
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={() => onToggleItem(item.id)}
                                        className="mt-2.5 flex-shrink-0"
                                      />
                                    )}
                                    <div className={isToggleable ? "flex-1 min-w-0" : "w-full"}>
                                      <div className={isToggleable && checked ? "rounded-lg ring-1 ring-accent/40" : undefined}>
                                        <SectionContentPreview item={item} type={sectionId} />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </>
                    )}
                    {def.libraryTab && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => onGoToLibrary(def.libraryTab)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1.5" />
                          Open Content Library
                        </Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

function SectionContentPreview({ item, type }: { item: any; type: string }) {
  const content = item.content as any;

  if (type === "company_info") {
    return (
      <div className="text-xs space-y-1 bg-card rounded-lg p-2.5 border">
        {content?.legal_name && <p><span className="text-muted-foreground">Name:</span> <span className="font-medium">{content.legal_name}</span></p>}
        {content?.address && <p><span className="text-muted-foreground">Address:</span> {content.address}</p>}
        {content?.phone && <p><span className="text-muted-foreground">Phone:</span> {content.phone}</p>}
        {content?.email && <p><span className="text-muted-foreground">Email:</span> {content.email}</p>}
      </div>
    );
  }

  if (type === "staff_bios" || type === "org_chart") {
    return (
      <div className="flex items-center gap-2 bg-card rounded-lg p-2.5 border">
        <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center text-[10px] font-bold text-accent flex-shrink-0">
          {content?.name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "?"}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{content?.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{content?.title}</p>
        </div>
        {content?.years_experience && (
          <Badge variant="outline" className="text-[10px] ml-auto flex-shrink-0">{content.years_experience} yrs</Badge>
        )}
      </div>
    );
  }

  if (type === "notable_projects") {
    const props = item.properties as any;
    const isSheet = item._isSheet;
    return (
      <div className="text-xs bg-card rounded-lg p-2.5 border">
        <div className="flex items-center gap-1.5">
          <p className="font-medium">{isSheet ? item._title : (props?.address || item.description || "Project")}</p>
          {isSheet && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">Custom</Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5">
          {isSheet
            ? [item.client_name, item.estimated_value ? `$${item.estimated_value.toLocaleString("en-US")}` : null].filter(Boolean).join(" · ") || "Project Sheet"
            : `${item.application_type || ""}${item.estimated_value ? ` · $${item.estimated_value.toLocaleString("en-US")}` : ""}`
          }
        </p>
      </div>
    );
  }

  if (type === "narratives") {
    return (
      <div className="text-xs bg-card rounded-lg p-2.5 border">
        <p className="font-medium">{item.title}</p>
        <p className="text-muted-foreground mt-0.5 line-clamp-2">{content?.text || ""}</p>
      </div>
    );
  }

  if (type === "pricing") {
    const classifications = content?.labor_classifications || [];
    return (
      <div className="text-xs bg-card rounded-lg p-2.5 border">
        <p className="font-medium">{item.title || "Rate Schedule"}</p>
        <p className="text-muted-foreground mt-0.5">{classifications.length} classifications</p>
      </div>
    );
  }

  if (type === "certifications") {
    return (
      <div className="text-xs bg-card rounded-lg p-2.5 border flex items-center gap-2">
        <Award className="h-3.5 w-3.5 text-info flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-medium truncate">{item.title}</p>
          <p className="text-muted-foreground truncate">
            {content?.cert_type} #{content?.cert_number}
          </p>
        </div>
      </div>
    );
  }

  if (type === "attachments") {
    return (
      <div className="text-xs bg-card rounded-lg p-2.5 border flex items-center gap-2">
        <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{content?.filename || item.title}</p>
          {content?.tag && content.tag !== "other" && (
            <p className="text-muted-foreground truncate capitalize">{content.tag.replace(/_/g, " ")}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="text-xs bg-card rounded-lg p-2.5 border">
      <p className="font-medium">{item.title || "Item"}</p>
    </div>
  );
}

// ─── Step: Cover Letter ───

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

// ─── Step: Review ───

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
            Cover letter is selected but empty. Go back to generate one.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Step: Submit ───

function StepSubmit({
  submitEmail, setSubmitEmail, submitCcEmails, setSubmitCcEmails, onSubmit, submitting, onPreview,
}: {
  submitEmail: string;
  setSubmitEmail: (v: string) => void;
  submitCcEmails: string;
  setSubmitCcEmails: (v: string) => void;
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
        <Input
          type="email"
          value={submitEmail}
          onChange={(e) => setSubmitEmail(e.target.value)}
          placeholder="agency@email.com"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-sm">CC (optional)</Label>
        <Input
          type="text"
          value={submitCcEmails}
          onChange={(e) => setSubmitCcEmails(e.target.value)}
          placeholder="chris@company.com, team@company.com"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated emails. CC recipients get the same email with all attachments.
        </p>
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
