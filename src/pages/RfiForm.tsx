import { useState, useMemo, useEffect } from "react";
import { formatPhoneNumber } from "@/lib/formatters";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRfiByToken, DEFAULT_PIS_SECTIONS, type RfiRequest, type RfiSectionConfig, type RfiFieldConfig } from "@/hooks/useRfi";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  FileText,
  Plus,
  Trash2,
  Building2,
  Upload,
  X,
  File,
  Eye,
  Pencil,
} from "lucide-react";

export default function RfiForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const isDemo = searchParams.get("demo") === "true";

  const { data: rfiData, isLoading, error } = useRfiByToken(isDemo ? null : token);

  // Demo mode mock data
  const demoRfi: RfiRequest | null = isDemo ? {
    id: "demo",
    company_id: "demo",
    template_id: null,
    project_id: null,
    proposal_id: null,
    property_id: null,
    title: "Project Information Sheet",
    recipient_name: "Demo User",
    recipient_email: null,
    status: "sent",
    access_token: "demo",
    sections: DEFAULT_PIS_SECTIONS,
    responses: {},
    submitted_at: null,
    sent_at: null,
    viewed_at: null,
    created_by: null,
    created_at: null,
    updated_at: null,
  } : null;

  const demoProperty = isDemo ? {
    address: "123 Broadway, New York, NY 10007",
    borough: "Manhattan",
    block: "00089",
    lot: "0001",
  } : null;

  const rfi = isDemo ? demoRfi : rfiData?.rfi;
  const property = isDemo ? demoProperty : rfiData?.property;
  const projectData = isDemo ? { building_owner_name: "ABC Realty Corp", gc_company_name: null, gc_contact_name: null, gc_phone: null, gc_email: null, architect_company_name: null, architect_contact_name: null, architect_phone: null, architect_email: null } : rfiData?.project;
  const existingPlanNames: string[] = isDemo ? ["Floor_Plan_12A.pdf", "MEP_Layout.dwg"] : (rfiData?.existingPlanNames || []);

  const [currentStep, setCurrentStep] = useState(-1); // -1 = welcome screen
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [repeatCounts, setRepeatCounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [editingAfterSubmit, setEditingAfterSubmit] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null);
  const [ownerVerified, setOwnerVerified] = useState<boolean | null>(null); // null = not yet decided

  // File upload handler
  const handleFileUpload = async (key: string, files: FileList | null, accept?: string, maxFiles?: number) => {
    if (!files || !rfi || (!token && !isDemo)) return;
    if (isDemo) { alert("File uploads are disabled in demo mode."); return; }
    const max = maxFiles || 5;
    const existing: { name: string; path: string }[] = responses[key] || [];
    if (existing.length + files.length > max) {
      alert(`Maximum ${max} files allowed.`);
      return;
    }

    setUploading((prev) => ({ ...prev, [key]: true }));
    try {
      const uploaded = [...existing];
      for (const file of Array.from(files)) {
        // Validate file size (20MB max)
        if (file.size > 20 * 1024 * 1024) {
          alert(`${file.name} is too large. Maximum 20MB per file.`);
          continue;
        }
        // Sanitize filename
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${rfi.id}/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage
          .from('rfi-attachments')
          .upload(filePath, file, { upsert: false });
        if (error) {
          console.error('Upload error:', error);
          alert(`Failed to upload ${file.name}`);
          continue;
        }
        uploaded.push({ name: file.name, path: filePath });
      }
      setValue(key, uploaded);
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const removeFile = async (key: string, index: number) => {
    const files: { name: string; path: string }[] = responses[key] || [];
    const file = files[index];
    if (file?.path) {
      await supabase.storage.from('rfi-attachments').remove([file.path]);
    }
    const updated = files.filter((_, i) => i !== index);
    setValue(key, updated);
  };

  // Dynamically inject selected work types into applicant_work_types options
  // Each applicant only sees work types not already claimed by other applicants
  const getApplicantWorkTypeOptions = (repeatIdx: number): string[] => {
    const workTypesKey = "building_and_scope_work_types_selected";
    const selectedWorkTypes: string[] = Array.isArray(responses[workTypesKey]) ? responses[workTypesKey] : [];
    const allOptions = selectedWorkTypes.filter(t => t !== "Other");
    if (allOptions.length === 0) return ["No work types selected yet"];

    // Gather work types claimed by OTHER applicants
    const repeatGroupId = "applicant_and_owner_repeat";
    const repeatCount = getRepeatCount(repeatGroupId);
    const takenByOthers = new Set<string>();
    for (let i = 0; i < repeatCount; i++) {
      if (i === repeatIdx) continue;
      const key = i > 0
        ? `applicant_and_owner_${i}_applicant_work_types`
        : `applicant_and_owner_applicant_work_types`;
      const claimed: string[] = Array.isArray(responses[key]) ? responses[key] : [];
      claimed.forEach(t => takenByOthers.add(t));
    }

    // Keep types not taken by others (but keep ones this applicant already selected)
    const myKey = repeatIdx > 0
      ? `applicant_and_owner_${repeatIdx}_applicant_work_types`
      : `applicant_and_owner_applicant_work_types`;
    const mySelected: string[] = Array.isArray(responses[myKey]) ? responses[myKey] : [];

    return allOptions.filter(t => !takenByOthers.has(t) || mySelected.includes(t));
  };

  const sections = useMemo(() => {
    const baseSections = rfi?.sections || [];
    return baseSections.length > 0 ? baseSections : DEFAULT_PIS_SECTIONS;
  }, [rfi]);
  const totalSteps = sections.length;
  const isReviewStep = currentStep === totalSteps; // review is one past the last section
  const progress = totalSteps > 0 ? Math.max(0, ((Math.min(currentStep + 1, totalSteps)) / totalSteps) * 100) : 0;
  const currentSection = currentStep >= 0 && currentStep < totalSteps ? sections[currentStep] : null;

  // Pre-populate property data + project data (applicant, owner, GC) when loaded
  useEffect(() => {
    if (!rfi) return;
    const newResponses = { ...responses };
    let changed = false;

    const setIfEmpty = (key: string, val: string | null | undefined) => {
      if (val && !newResponses[key]) {
        newResponses[key] = val;
        changed = true;
      }
    };

    // Property fields
    if (property) {
      setIfEmpty("building_and_scope_project_address", property.address);
      setIfEmpty("building_and_scope_borough", property.borough);
      setIfEmpty("building_and_scope_block", property.block);
      setIfEmpty("building_and_scope_lot", property.lot);
    }

    // Job description and unit from project/proposal
    if (projectData) {
      setIfEmpty("building_and_scope_job_description", (projectData as any).job_description);
      setIfEmpty("building_and_scope_apt_numbers", (projectData as any).unit_number);
    }

    // Applicant (architect/engineer) from project
    if (projectData) {
      // Split architect name into first/last for new fields
      const architectName = projectData.architect_contact_name || "";
      const nameParts = architectName.trim().split(/\s+/);
      setIfEmpty("applicant_and_owner_applicant_first_name", nameParts[0] || null);
      setIfEmpty("applicant_and_owner_applicant_last_name", nameParts.length > 1 ? nameParts.slice(1).join(" ") : null);
      setIfEmpty("applicant_and_owner_applicant_business_name", projectData.architect_company_name);
      setIfEmpty("applicant_and_owner_applicant_phone", projectData.architect_phone);
      setIfEmpty("applicant_and_owner_applicant_email", projectData.architect_email);
      setIfEmpty("applicant_and_owner_applicant_lic_type", (projectData as any).architect_license_type);
      setIfEmpty("applicant_and_owner_applicant_nys_lic", (projectData as any).architect_license_number);

      // Building owner — entity names go to company field, not person name
      const ownerVal = projectData.building_owner_name;
      if (ownerVal) {
        // If it looks like a company (contains LLC, Corp, Inc, LP, etc.), put in company field
        const isEntity = /\b(llc|corp|inc|ltd|lp|partnership|associates|group|realty|holdings|trust|co\b)/i.test(ownerVal);
        if (isEntity) {
          setIfEmpty("applicant_and_owner_owner_company", ownerVal);
        } else {
          setIfEmpty("applicant_and_owner_owner_name", ownerVal);
        }
      }

      // GC — pre-fill and auto-expand if data exists
      if (projectData.gc_contact_name || projectData.gc_company_name) {
        setIfEmpty("contractors_inspections_gc_known", "Yes");
      }
      setIfEmpty("contractors_inspections_gc_name", projectData.gc_contact_name);
      setIfEmpty("contractors_inspections_gc_company", projectData.gc_company_name);
      setIfEmpty("contractors_inspections_gc_phone", projectData.gc_phone);
      setIfEmpty("contractors_inspections_gc_email", projectData.gc_email);

      // SIA — pre-fill from proposal data
      if ((projectData as any).sia_name || (projectData as any).sia_company) {
        setIfEmpty("contractors_inspections_sia_known", "Yes");
      }
      setIfEmpty("contractors_inspections_sia_name", (projectData as any).sia_name);
      setIfEmpty("contractors_inspections_sia_company", (projectData as any).sia_company);
      setIfEmpty("contractors_inspections_sia_phone", (projectData as any).sia_phone);
      setIfEmpty("contractors_inspections_sia_email", (projectData as any).sia_email);

      // TPP — pre-fill from proposal data
      if ((projectData as any).tpp_name || (projectData as any).tpp_email) {
        setIfEmpty("contractors_inspections_tpp_known", "Yes");
      }
      setIfEmpty("contractors_inspections_tpp_name", (projectData as any).tpp_name);
      setIfEmpty("contractors_inspections_tpp_email", (projectData as any).tpp_email);
    }

    if (changed) {
      setResponses(newResponses);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property, rfi, projectData]);

  // Auto-fill TPP fields when "Same as Applicant" is selected
  useEffect(() => {
    const tppKnown = responses["contractors_inspections_tpp_known"];
    if (tppKnown === "Yes — Same as Applicant") {
      const firstName = responses["applicant_and_owner_applicant_first_name"] || "";
      const lastName = responses["applicant_and_owner_applicant_last_name"] || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      const email = responses["applicant_and_owner_applicant_email"] || "";
      
      const newResponses = { ...responses };
      let changed = false;
      if (newResponses["contractors_inspections_tpp_name"] !== fullName) {
        newResponses["contractors_inspections_tpp_name"] = fullName;
        changed = true;
      }
      if (newResponses["contractors_inspections_tpp_email"] !== email) {
        newResponses["contractors_inspections_tpp_email"] = email;
        changed = true;
      }
      if (changed) setResponses(newResponses);
    }
  }, [
    responses["contractors_inspections_tpp_known"],
    responses["applicant_and_owner_applicant_first_name"],
    responses["applicant_and_owner_applicant_last_name"],
    responses["applicant_and_owner_applicant_email"],
  ]);

  const getRepeatCount = (sectionId: string) => repeatCounts[sectionId] || 1;

  const addRepeat = (sectionId: string, max: number) => {
    const current = getRepeatCount(sectionId);
    if (current < max) {
      setRepeatCounts({ ...repeatCounts, [sectionId]: current + 1 });
    }
  };

  const removeRepeat = (sectionId: string) => {
    const current = getRepeatCount(sectionId);
    if (current > 1) {
      setRepeatCounts({ ...repeatCounts, [sectionId]: current - 1 });
      const newResponses = { ...responses };
      Object.keys(newResponses).forEach((key) => {
        if (key.startsWith(`${sectionId}_${current - 1}_`)) {
          delete newResponses[key];
        }
      });
      setResponses(newResponses);
    }
  };

  const getFieldKey = (sectionId: string, fieldId: string, repeatIdx?: number) => {
    if (repeatIdx !== undefined && repeatIdx > 0) {
      return `${sectionId}_${repeatIdx}_${fieldId}`;
    }
    return `${sectionId}_${fieldId}`;
  };

  const getValue = (key: string) => responses[key] || "";
  const setValue = (key: string, value: any) => {
    const newResponses = { ...responses, [key]: value };
    setResponses(newResponses);
  };

  const getCheckboxGroupValue = (key: string): string[] => {
    const val = responses[key];
    return Array.isArray(val) ? val : [];
  };

  const toggleCheckboxGroup = (key: string, option: string) => {
    const current = getCheckboxGroupValue(key);
    if (current.includes(option)) {
      setValue(key, current.filter((v) => v !== option));
    } else {
      setValue(key, [...current, option]);
    }
  };

  const validateCurrentStep = (): boolean => {
    if (!currentSection) return true;
    const count = currentSection.repeatable ? getRepeatCount(currentSection.id) : 1;
    for (let r = 0; r < count; r++) {
      for (const field of currentSection.fields) {
        if (field.required) {
          const key = getFieldKey(currentSection.id, field.id, r);
          const val = responses[key];
          if (!val || (typeof val === "string" && val.trim() === "")) return false;
          if (Array.isArray(val) && val.length === 0) return false;
        }
      }
    }
    return true;
  };

  const goNext = () => {
    setDirection("forward");
    if (currentStep < totalSteps) { // allow going to review step
      setCurrentStep((s) => s + 1);
    }
  };

  const goBack = () => {
    setDirection("back");
    setCurrentStep((s) => Math.max(-1, s - 1));
  };

  const startForm = () => {
    setDirection("forward");
    setCurrentStep(0);
    // Mark as viewed (skip in demo mode)
    if (rfi && token && !isDemo) {
      (supabase.from("rfi_requests" as any) as any)
        .update({ viewed_at: new Date().toISOString(), status: "viewed" })
        .eq("access_token", token)
        .then(() => {});
    }
  };

  const handleSubmit = async () => {
    if (!rfi) return;
    if (isDemo) {
      setSubmitted(true);
      return;
    }
    if (!token) return;
    setSubmitting(true);
    try {
      await (supabase.from("rfi_requests" as any) as any)
        .update({
          responses,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("access_token", token);

      // Notify PM that PIS was submitted
      if (rfi.project_id && rfi.company_id) {
        // Look up the assigned PM for this project
        const { data: project } = await supabase
          .from("projects")
          .select("assigned_pm_id, name")
          .eq("id", rfi.project_id)
          .maybeSingle();

        if (project?.assigned_pm_id) {
          await supabase.from("notifications").insert({
            company_id: rfi.company_id,
            user_id: project.assigned_pm_id,
            type: "pis_submitted",
            title: `PIS submitted: ${project.name || rfi.title}`,
            body: `The client has submitted the Project Information Sheet for ${property?.address || project.name}. Review the responses and update the project.`,
            link: `/projects/${rfi.project_id}`,
            project_id: rfi.project_id,
          } as any);
        }

        // If owner was updated via "Update Below", add as a proposal contact
        const ownerUpdated = responses["applicant_and_owner_owner_verified"] === "false";
        const ownerName = responses["applicant_and_owner_owner_name"];
        if (ownerUpdated && ownerName && rfi.proposal_id) {
          const ownerContact = {
            proposal_id: rfi.proposal_id,
            company_id: rfi.company_id,
            name: ownerName,
            company_name: responses["applicant_and_owner_owner_company"] || null,
            role: "owner",
            email: responses["applicant_and_owner_owner_email"] || null,
            phone: responses["applicant_and_owner_owner_phone"] || null,
          };
          // Check if an owner contact already exists for this proposal
          const { data: existingContact } = await (supabase.from("proposal_contacts" as any) as any)
            .select("id")
            .eq("proposal_id", rfi.proposal_id)
            .eq("role", "owner")
            .maybeSingle();
          
          if (existingContact) {
            await (supabase.from("proposal_contacts" as any) as any)
              .update(ownerContact)
              .eq("id", existingContact.id);
          } else {
            await (supabase.from("proposal_contacts" as any) as any)
              .insert(ownerContact);
          }
        }
      }

      setSubmitted(true);
      setEditingAfterSubmit(false);
    } catch (err) {
      console.error("Error submitting RFI:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Count answered fields in a section
  const getSectionProgress = (section: RfiSectionConfig) => {
    let total = 0;
    let filled = 0;
    const count = section.repeatable ? getRepeatCount(section.id) : 1;
    for (let r = 0; r < count; r++) {
      for (const field of section.fields) {
        if (field.type === "heading") continue;
        total++;
        const key = getFieldKey(section.id, field.id, r);
        const val = responses[key];
        if (val && ((typeof val === "string" && val.trim() !== "") || (Array.isArray(val) && val.length > 0) || typeof val === "boolean")) {
          filled++;
        }
      }
    }
    return { total, filled };
  };

  // Fields that should only show when the "known" select is "Yes"
  const knownGroupFields: Record<string, string[]> = {
    "contractors_inspections_gc_known": ["gc_name", "gc_company", "gc_phone", "gc_email", "gc_address", "gc_dob_tracking", "gc_hic_lic"],
    "contractors_inspections_tpp_known": ["tpp_name", "tpp_email", "rent_controlled", "rent_stabilized", "units_occupied"],
    "contractors_inspections_sia_known": ["sia_name", "sia_company", "sia_phone", "sia_email", "sia_number", "sia_nys_lic"],
  };

  // Fields that should only show for Corporation/Partnership ownership
  const corpOfficerFields = ["corp_officer_name", "corp_officer_title"];

  const isFieldHiddenByTbd = (sectionId: string, fieldId: string): boolean => {
    // Hide Corporate Officer fields unless ownership is Corporation or Partnership
    if (sectionId === "applicant_and_owner" && corpOfficerFields.includes(fieldId)) {
      const ownershipType = responses["applicant_and_owner_ownership_type"];
      if (ownershipType !== "Corporation" && ownershipType !== "Partnership") return true;
    }
    // Hide Corporate Officer heading too
    if (sectionId === "applicant_and_owner" && fieldId === "corp_officer_heading") {
      const ownershipType = responses["applicant_and_owner_ownership_type"];
      if (ownershipType !== "Corporation" && ownershipType !== "Partnership") return true;
    }

    for (const [knownKey, showFields] of Object.entries(knownGroupFields)) {
      if (knownKey.startsWith(sectionId) && showFields.includes(fieldId)) {
        const knownValue = responses[knownKey];
        // Show fields for "Yes" or "Yes — Same as Applicant"
        if (knownValue === "Yes" || knownValue === "Yes — Same as Applicant") return false;
        return true;
      }
    }
    return false;
  };

  const renderField = (field: RfiFieldConfig, sectionId: string, repeatIdx: number = 0) => {
    const key = getFieldKey(sectionId, field.id, repeatIdx);

    // Hide fields when their group's TBD is checked
    if (isFieldHiddenByTbd(sectionId, field.id)) return null;

    if (field.type === "heading") {
      return (
        <div key={key} className="col-span-full pt-4 pb-1">
          <h4 className="text-base font-semibold text-stone-800">{field.label}</h4>
          <div className="h-px bg-stone-200 mt-2" />
        </div>
      );
    }

    const widthClass = field.width === "half" ? "col-span-1" : "col-span-full";

    return (
      <div key={key} className={`space-y-2 ${widthClass}`}>
        <Label className="text-sm font-medium text-stone-600">
          {field.label}
          {field.required && <span className="text-amber-600 ml-0.5">*</span>}
        </Label>

        {(field.type === "text" || field.type === "phone" || field.type === "email" || field.type === "number" || field.type === "currency") ? (
          field.type === "currency" ? (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={getValue(key) ? Number(getValue(key)).toLocaleString() : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.]/g, "");
                  setValue(key, raw);
                }}
                className="pl-7 h-11 bg-white border-stone-200 text-stone-800 focus:border-amber-500 focus:ring-amber-500/20 transition-all"
              />
            </div>
          ) : (
            <Input
              type={field.type === "phone" ? "tel" : field.type}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
              value={field.type === "phone" ? formatPhoneNumber(getValue(key)) : getValue(key)}
              onChange={(e) => {
                if (field.type === "phone") {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setValue(key, digits);
                } else {
                  setValue(key, e.target.value);
                }
              }}
              className="h-11 bg-white border-stone-200 text-stone-800 focus:border-amber-500 focus:ring-amber-500/20 transition-all"
            />
          )
        ) : field.type === "textarea" ? (
          <Textarea
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            value={getValue(key)}
            onChange={(e) => setValue(key, e.target.value)}
            rows={3}
            className="bg-white border-stone-200 text-stone-800 focus:border-amber-500 focus:ring-amber-500/20 transition-all resize-none"
          />
        ) : field.type === "select" ? (
          <Select value={getValue(key)} onValueChange={(v) => setValue(key, v)}>
            <SelectTrigger className="h-11 bg-white border-stone-200 text-stone-800 focus:border-amber-500 focus:ring-amber-500/20">
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.type === "checkbox" ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 bg-white hover:border-amber-400 transition-colors cursor-pointer"
            onClick={() => setValue(key, !getValue(key))}
          >
            <Checkbox
              checked={!!getValue(key)}
              onCheckedChange={(checked) => setValue(key, !!checked)}
              className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
            />
            <span className="text-sm text-stone-700">{field.placeholder || "Yes"}</span>
          </div>
        ) : field.type === "checkbox_group" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(() => {
              // For applicant_work_types, use dynamic per-applicant options
              const options = field.id === "applicant_work_types"
                ? getApplicantWorkTypeOptions(repeatIdx)
                : (field.options || []);
              return options.map((opt) => {
                const isChecked = getCheckboxGroupValue(key).includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={() => opt !== "No work types selected yet" && toggleCheckboxGroup(key, opt)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      opt === "No work types selected yet"
                        ? "border-stone-200 bg-stone-50 cursor-default"
                        : isChecked
                        ? "border-amber-500 bg-amber-50 shadow-sm ring-1 ring-amber-500/30"
                        : "border-stone-200 bg-white hover:border-amber-300"
                    }`}
                  >
                    {opt !== "No work types selected yet" && (
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleCheckboxGroup(key, opt)}
                        className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                    )}
                    <span className={`text-sm ${isChecked ? "text-amber-800 font-medium" : "text-stone-600"}`}>{opt}</span>
                  </div>
                );
              });
            })()}
          </div>
        ) : field.type === "work_type_picker" ? (
          <div className="space-y-3">
            {/* Picklist chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {field.options?.map((opt) => {
                const selected: string[] = getCheckboxGroupValue(`${key}_selected`);
                const isChecked = selected.includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={() => {
                      const current = getCheckboxGroupValue(`${key}_selected`);
                      if (current.includes(opt)) {
                        const updated = current.filter(v => v !== opt);
                        const newResp = { ...responses, [`${key}_selected`]: updated };
                        if (opt === "Other") delete newResp[`${key}_other_label`];
                        // Remove cost for deselected type
                        delete newResp[`${key}_cost_${opt.toLowerCase().replace(/\s+/g, '_')}`];
                        setResponses(newResp);
                      } else {
                        setValue(`${key}_selected`, [...current, opt]);
                      }
                    }}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-sm ${
                      isChecked
                        ? "border-amber-500 bg-amber-50 shadow-sm ring-1 ring-amber-500/30 text-amber-800 font-medium"
                        : "border-stone-200 bg-white hover:border-amber-300 text-stone-600"
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                    />
                    {opt}
                  </div>
                );
              })}
            </div>
            {/* Other description if selected */}
            {getCheckboxGroupValue(`${key}_selected`).includes("Other") && (
              <div className="space-y-1.5">
                <Label className="text-sm text-stone-600">Describe other work type:</Label>
                <Input
                  type="text"
                  placeholder="e.g. Elevator modernization"
                  value={getValue(`${key}_other_label`)}
                  onChange={(e) => setValue(`${key}_other_label`, e.target.value)}
                  className="h-10 bg-white border-stone-200 text-stone-800 focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
            )}
            {/* Cost fields for each selected work type */}
            {(() => {
              const selected: string[] = getCheckboxGroupValue(`${key}_selected`);
              if (selected.length === 0) return null;
              return (
                <div className="space-y-2 mt-4">
                  <Label className="text-sm font-semibold text-stone-700">
                    Estimated Cost per Work Type <span className="text-amber-600">*</span>
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selected.map((wt) => {
                      const costKey = `${key}_cost_${wt.toLowerCase().replace(/\s+/g, '_')}`;
                      const label = wt === "Other" ? (getValue(`${key}_other_label`) || "Other") : wt;
                      return (
                        <div key={wt} className="space-y-1">
                          <Label className="text-xs text-stone-500">{label}</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={getValue(costKey) ? Number(getValue(costKey)).toLocaleString() : ""}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9.]/g, "");
                                setValue(costKey, raw);
                              }}
                              className="pl-7 h-10 bg-white border-stone-200 text-stone-800 focus:border-amber-500 focus:ring-amber-500/20 transition-all"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : field.type === "file_upload" ? (
          <div className="space-y-3">
            {/* Show existing plans already on file */}
            {field.id === "plans_upload" && existingPlanNames.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs font-semibold text-amber-800 mb-1.5">Plans already on file:</p>
                <ul className="space-y-1">
                  {existingPlanNames.map((name, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-amber-700">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      {name}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-600 mt-2">Upload additional or revised drawings below if needed.</p>
              </div>
            )}
            {/* Uploaded files list */}
            {((responses[key] as { name: string; path: string }[]) || []).map((file, idx) => {
              const publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/rfi-attachments/${file.path}`;
              const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
              return (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 bg-white">
                  <File className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-sm text-stone-700 truncate flex-1">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setPreviewFile({ name: file.name, url: publicUrl })}
                    className="text-amber-600 hover:text-amber-800 transition-colors"
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(key, idx)}
                    className="text-stone-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            {/* Upload area */}
            {((responses[key] as any[]) || []).length < (field.maxFiles || 5) && (
              <label className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer">
                {uploading[key] ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                    <span className="text-sm text-stone-500">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-stone-400" />
                    <span className="text-sm text-stone-500">{field.placeholder || "Click to upload files"}</span>
                    <span className="text-xs text-stone-400">Max {field.maxFiles || 5} files, 20MB each</span>
                  </>
                )}
                <input
                  type="file"
                  multiple
                  accept={field.accept}
                  className="hidden"
                  disabled={!!uploading[key]}
                  onChange={(e) => handleFileUpload(key, e.target.files, field.accept, field.maxFiles)}
                />
              </label>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  // Loading state (skip for demo)
  if (isLoading && !isDemo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          <p className="text-stone-500 text-sm">Loading your form...</p>
        </div>
      </div>
    );
  }

  // Invalid/not found
  if (!rfi || error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-6">
            <FileText className="h-8 w-8 text-stone-400" />
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-3">Form Not Found</h2>
          <p className="text-stone-500 leading-relaxed mb-6">
            This link may be expired or invalid. Please contact your project manager for a new link.
          </p>
          {!isDemo && (
            <Button
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("demo", "true");
                window.location.href = url.toString();
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              Try Demo
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Already submitted — show summary with option to edit
  if ((submitted || rfi.status === "submitted") && !editingAfterSubmit) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-bold text-stone-800 mb-3">All Done!</h2>
          <p className="text-stone-500 leading-relaxed text-lg mb-6">
            Your project information has been submitted. Your project manager will review everything and be in touch shortly.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setEditingAfterSubmit(true);
              setSubmitted(false);
              setCurrentStep(0);
            }}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Edit Responses
          </Button>
        </div>
      </div>
    );
  }

  // Welcome screen
  if (currentStep === -1) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/50 flex items-center justify-center mx-auto mb-8">
            <Building2 className="h-8 w-8 text-amber-600" />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-stone-800 mb-4 leading-tight">
            {rfi.title}
          </h1>

          {property && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 mb-6 shadow-sm">
              <Building2 className="h-4 w-4 text-amber-600" />
              <span className="text-stone-700 text-sm font-medium">{property.address}</span>
              {property.borough && (
                <span className="text-stone-400 text-sm">· {property.borough}</span>
              )}
            </div>
          )}

          <p className="text-stone-500 text-lg mb-10 leading-relaxed max-w-md mx-auto">
            Please verify the pre-filled details and provide any additional information needed to get your project started.
          </p>

          {/* Section preview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-10 max-w-md mx-auto">
            {sections.map((section, i) => (
              <div
                key={section.id}
                className="px-3 py-2 rounded-lg bg-white border border-stone-200 text-left shadow-sm"
              >
                <span className="text-[10px] font-mono text-amber-600/70">{String(i + 1).padStart(2, "0")}</span>
                <p className="text-xs text-stone-600 leading-snug mt-0.5">{section.title}</p>
              </div>
            ))}
          </div>

          <Button
            onClick={startForm}
            size="lg"
            className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-8 h-12 text-base rounded-xl shadow-lg shadow-amber-600/20 transition-all hover:shadow-amber-600/30 hover:scale-[1.02]"
          >
            Get Started
            <ChevronRight className="h-5 w-5 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // Question view
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-stone-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-stone-500 hover:text-stone-800 transition-colors text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            {currentStep === 0 ? "Back" : "Previous"}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-stone-400">
              {isReviewStep ? "Review" : `${currentStep + 1} / ${totalSteps}`}
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-stone-100">
          <div
            className="h-full bg-amber-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-2xl">
          {/* Review step */}
          {isReviewStep && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded">
                    Review
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-stone-800 mb-1">
                  Review & Submit
                </h2>
                <p className="text-stone-500 text-sm">
                  Click any section to edit.
                </p>
              </div>

              <div className="space-y-4">
                {sections.map((section, sIdx) => (
                  <div key={section.id} className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                    <button
                      onClick={() => { setDirection("back"); setCurrentStep(sIdx); }}
                      className="w-full px-5 py-3 flex items-center justify-between bg-stone-50 hover:bg-amber-50/50 transition-colors text-left border-b border-stone-100"
                    >
                      <h3 className="text-sm font-semibold text-stone-700">{section.title}</h3>
                      <span className="text-xs text-amber-600 font-medium">Edit</span>
                    </button>
                    <div className="px-5 py-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2">
                        {section.fields.filter(f => f.type !== "heading").map((field) => {
                          const key = getFieldKey(section.id, field.id);

                          if (isFieldHiddenByTbd(section.id, field.id)) return null;

                          if (field.type === "work_type_picker") {
                            const selected: string[] = Array.isArray(responses[`${key}_selected`]) ? responses[`${key}_selected`] : [];
                            if (selected.length === 0) return null;
                            const otherLabel = responses[`${key}_other_label`];
                            return (
                              <div key={key} className="col-span-full py-1">
                                <p className="text-xs text-stone-400 mb-1">{field.label}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {selected.map((opt) => (
                                    <span key={opt} className="inline-flex px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-800">
                                      {opt === "Other" && otherLabel ? otherLabel : opt}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          }

                          const val = responses[key];
                          if (!val || (typeof val === "string" && val.trim() === "") || (Array.isArray(val) && val.length === 0)) return null;

                          let displayVal: React.ReactNode;
                          if (field.type === "currency" && val) {
                            displayVal = `$${Number(val).toLocaleString()}`;
                          } else if (field.type === "file_upload" && Array.isArray(val)) {
                            displayVal = (
                              <div className="space-y-0.5">
                                {(val as { name: string; path: string }[]).map((file, fIdx) => {
                                  const publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/rfi-attachments/${file.path}`;
                                  return (
                                    <button
                                      key={fIdx}
                                      onClick={(e) => { e.stopPropagation(); setPreviewFile({ name: file.name, url: publicUrl }); }}
                                      className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 underline"
                                    >
                                      <Eye className="h-3 w-3 shrink-0" />
                                      {file.name}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          } else if (field.type === "checkbox" && val === true) {
                            displayVal = "Yes";
                          } else if (Array.isArray(val)) {
                            displayVal = val.join(", ");
                          } else {
                            displayVal = String(val);
                          }

                          return (
                            <div key={key} className={`py-1 ${field.width === "full" ? "col-span-full" : ""}`}>
                              <p className="text-xs text-stone-400">{field.label}</p>
                              <div className="text-sm text-stone-700">{displayVal}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regular section step */}
          {currentSection && !isReviewStep && (
            <div key={currentSection.id} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Section header */}
              <div className="mb-8">
                {/* Project context */}
                {property && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 mb-4 text-xs text-stone-500">
                    <Building2 className="h-3 w-3 text-amber-600" />
                    <span className="font-medium text-stone-700">{rfi.title}</span>
                    <span>·</span>
                    <span>{property.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono text-amber-600 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded">
                    {String(currentStep + 1).padStart(2, "0")}
                  </span>
                  {currentSection.repeatable && (
                    <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
                      repeatable
                    </span>
                  )}
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-2">
                  {currentSection.title}
                </h2>
                {currentSection.description && (
                  <p className="text-stone-500 text-base">{currentSection.description}</p>
                )}
              </div>

              {/* Fields — with repeatableGroup support */}
              {(() => {
                // Split fields into groups: find repeatableGroup heading and its fields
                const fields = currentSection.fields;
                const repeatableIdx = fields.findIndex(f => f.type === "heading" && f.repeatableGroup);

                if (repeatableIdx === -1) {
                  // No repeatable group — render normally
                  return (
                    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {fields.map((field) => renderField(field, currentSection.id))}
                      </div>
                    </div>
                  );
                }

                // Find the next heading after the repeatable group to know where it ends
                const nextHeadingIdx = fields.findIndex((f, i) => i > repeatableIdx && f.type === "heading" && !f.repeatableGroup);
                const repeatableFields = fields.slice(repeatableIdx, nextHeadingIdx === -1 ? undefined : nextHeadingIdx);
                const afterFields = nextHeadingIdx === -1 ? [] : fields.slice(nextHeadingIdx);
                const repeatGroupId = `${currentSection.id}_repeat`;
                const repeatCount = getRepeatCount(repeatGroupId);
                const maxRepeat = repeatableFields[0]?.maxRepeatGroup || 5;

                return (
                  <div className="space-y-6">
                    {/* Repeatable applicant entries */}
                    {Array.from({ length: repeatCount }).map((_, repeatIdx) => (
                      <div key={repeatIdx} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-5">
                          <h3 className="text-sm font-semibold text-stone-800">
                            {repeatableFields[0]?.label || "Entry"} {repeatCount > 1 ? `#${repeatIdx + 1}` : ""}
                          </h3>
                          {repeatIdx > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => removeRepeat(repeatGroupId)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Remove
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {repeatableFields.slice(1).map((field) => renderField(field, currentSection.id, repeatIdx))}
                        </div>
                      </div>
                    ))}
                    {repeatCount < maxRepeat && (
                      <button
                        onClick={() => addRepeat(repeatGroupId, maxRepeat)}
                        className="w-full py-3 rounded-xl border border-dashed border-stone-300 text-stone-400 hover:text-amber-600 hover:border-amber-400 transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <Plus className="h-4 w-4" />
                        Add Another Applicant
                      </button>
                    )}

                    {/* Owner & other fields after the repeatable group */}
                    {afterFields.length > 0 && (
                      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                        {/* Owner verification banner */}
                        {currentSection.id === "applicant_and_owner" && projectData?.building_owner_name && (
                          <div className={`mb-5 p-4 rounded-xl border ${
                            ownerVerified === true
                              ? "bg-emerald-50 border-emerald-200"
                              : ownerVerified === false
                              ? "bg-amber-50 border-amber-200"
                              : "bg-stone-50 border-stone-200"
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-stone-500" />
                                <span className="text-sm font-semibold text-stone-700">Owner on File</span>
                              </div>
                              {ownerVerified === true && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 className="h-3 w-3" /> Verified
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-stone-600 mb-3">
                              Our records show: <span className="font-medium">{projectData.building_owner_name}</span>
                            </p>
                            <p className="text-xs text-stone-400 mb-3">
                              Please verify this is correct. If the signatory differs, you can update below — this won't change our company records.
                            </p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant={ownerVerified === true ? "default" : "outline"}
                                size="sm"
                                className={`gap-1.5 text-xs ${ownerVerified === true ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                                onClick={() => {
                                  setOwnerVerified(true);
                                  setValue("applicant_and_owner_owner_verified", "true");
                                }}
                              >
                                <CheckCircle2 className="h-3 w-3" /> Correct
                              </Button>
                              <Button
                                type="button"
                                variant={ownerVerified === false ? "default" : "outline"}
                                size="sm"
                                className={`gap-1.5 text-xs ${ownerVerified === false ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                                onClick={() => {
                                  setOwnerVerified(false);
                                  setValue("applicant_and_owner_owner_verified", "false");
                                }}
                              >
                                <Pencil className="h-3 w-3" /> Update Below
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {afterFields.map((field) => renderField(field, currentSection.id))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Section progress hint */}
              {(() => {
                const { total, filled } = getSectionProgress(currentSection);
                return total > 0 ? (
                  <p className="text-xs text-stone-400 mt-4">
                    {filled} of {total} fields completed
                  </p>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="sticky bottom-0 bg-white/80 backdrop-blur-xl border-t border-stone-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Step dots */}
          <div className="hidden sm:flex items-center gap-1.5">
            {sections.map((section, i) => {
              const { total, filled } = getSectionProgress(section);
              const isCurrent = i === currentStep;
              const isComplete = filled === total && total > 0;
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    setDirection(i > currentStep ? "forward" : "back");
                    setCurrentStep(i);
                  }}
                  className={`h-2 rounded-full transition-all ${
                    isCurrent
                      ? "w-6 bg-amber-500"
                      : isComplete
                      ? "w-2 bg-emerald-500"
                      : "w-2 bg-stone-200 hover:bg-stone-300"
                  }`}
                  title={section.title}
                />
              );
            })}
            {/* Review dot */}
            <button
              onClick={() => { setDirection("forward"); setCurrentStep(totalSteps); }}
              className={`h-2 rounded-full transition-all ${
                isReviewStep ? "w-6 bg-emerald-500" : "w-2 bg-stone-200 hover:bg-stone-300"
              }`}
              title="Review & Submit"
            />
          </div>

          {/* Action button */}
          {isReviewStep ? (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 h-11 rounded-xl ml-auto disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-6 h-11 rounded-xl ml-auto"
            >
              {currentStep === totalSteps - 1 ? "Review" : "Continue"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
      {/* File Preview Modal */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <File className="h-4 w-4" />
              {previewFile?.name}
            </DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="mt-2">
              {/\.(jpg|jpeg|png|gif|webp)$/i.test(previewFile.name) ? (
                <img src={previewFile.url} alt={previewFile.name} className="w-full rounded-lg" />
              ) : /\.pdf$/i.test(previewFile.name) ? (
                <iframe src={previewFile.url} className="w-full h-[70vh] rounded-lg border" title={previewFile.name} />
              ) : (
                <div className="text-center py-12 space-y-4">
                  <FileText className="h-12 w-12 text-stone-300 mx-auto" />
                  <p className="text-stone-500">Preview not available for this file type.</p>
                  <a
                    href={previewFile.url}
                    download
                    className="inline-flex items-center gap-2 text-sm text-amber-700 hover:text-amber-900 underline"
                  >
                    Download {previewFile.name}
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
