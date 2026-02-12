import { useState, useMemo, useEffect } from "react";
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
import { useRfiByToken, type RfiSectionConfig, type RfiFieldConfig } from "@/hooks/useRfi";
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
} from "lucide-react";

export default function RfiForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { data: rfiData, isLoading, error } = useRfiByToken(token);
  const rfi = rfiData?.rfi;
  const property = rfiData?.property;

  const [currentStep, setCurrentStep] = useState(-1); // -1 = welcome screen
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [repeatCounts, setRepeatCounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null);

  // File upload handler
  const handleFileUpload = async (key: string, files: FileList | null, accept?: string, maxFiles?: number) => {
    if (!files || !rfi || !token) return;
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
  const sections = useMemo(() => {
    const baseSections = rfi?.sections || [];
    const workTypesKey = "building_and_scope_work_types_selected";
    const selectedWorkTypes: string[] = Array.isArray(responses[workTypesKey]) ? responses[workTypesKey] : [];
    const applicantOptions = selectedWorkTypes.filter(t => t !== "Other");

    return baseSections.map(section => {
      if (section.id === "applicant_and_owner") {
        return {
          ...section,
          fields: section.fields.map(field => {
            if (field.id === "applicant_work_types") {
              return { ...field, options: applicantOptions.length > 0 ? applicantOptions : ["No work types selected yet"] };
            }
            return field;
          }),
        };
      }
      return section;
    });
  }, [rfi, responses]);
  const totalSteps = sections.length;
  const isReviewStep = currentStep === totalSteps; // review is one past the last section
  const progress = totalSteps > 0 ? Math.max(0, ((Math.min(currentStep + 1, totalSteps)) / totalSteps) * 100) : 0;
  const currentSection = currentStep >= 0 && currentStep < totalSteps ? sections[currentStep] : null;

  // Pre-populate property data when loaded
  useEffect(() => {
    if (property && rfi) {
      const newResponses = { ...responses };
      const prefillMap: Record<string, string | null> = {
        project_address: property.address,
        borough: property.borough,
        block: property.block,
        lot: property.lot,
      };
      for (const section of rfi.sections) {
        for (const field of section.fields) {
          const prefillValue = prefillMap[field.id];
          if (prefillValue && section.id === "building_and_scope") {
            const key = `${section.id}_${field.id}`;
            if (!newResponses[key]) {
              newResponses[key] = prefillValue;
            }
          }
        }
      }
      setResponses(newResponses);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property, rfi]);

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

    // "Same as Applicant" copy logic
    const sameAsMappings: Record<string, Record<string, string>> = {
      "contractors_inspections_gc_same_as": { contractors_inspections_gc_name: "applicant_and_owner_applicant_name", contractors_inspections_gc_company: "applicant_and_owner_applicant_company", contractors_inspections_gc_phone: "applicant_and_owner_applicant_phone", contractors_inspections_gc_email: "applicant_and_owner_applicant_email" },
      "contractors_inspections_tpp_same_as": { contractors_inspections_tpp_name: "applicant_and_owner_applicant_name", contractors_inspections_tpp_email: "applicant_and_owner_applicant_email" },
      "contractors_inspections_sia_same_as": { contractors_inspections_sia_name: "applicant_and_owner_applicant_name", contractors_inspections_sia_company: "applicant_and_owner_applicant_company", contractors_inspections_sia_phone: "applicant_and_owner_applicant_phone", contractors_inspections_sia_email: "applicant_and_owner_applicant_email" },
    };

    if (value === true && sameAsMappings[key]) {
      for (const [targetKey, sourceKey] of Object.entries(sameAsMappings[key])) {
        newResponses[targetKey] = newResponses[sourceKey] || "";
      }
    }

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
    // Mark as viewed
    if (rfi && token) {
      (supabase.from("rfi_requests" as any) as any)
        .update({ viewed_at: new Date().toISOString(), status: "viewed" })
        .eq("access_token", token)
        .then(() => {});
    }
  };

  const handleSubmit = async () => {
    if (!rfi || !token) return;
    setSubmitting(true);
    try {
      await (supabase.from("rfi_requests" as any) as any)
        .update({
          responses,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("access_token", token);
      setSubmitted(true);
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

  const renderField = (field: RfiFieldConfig, sectionId: string, repeatIdx: number = 0) => {
    const key = getFieldKey(sectionId, field.id, repeatIdx);

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
                type="number"
                placeholder="0.00"
                value={getValue(key)}
                onChange={(e) => setValue(key, e.target.value)}
                className="pl-7 h-11 bg-white border-stone-200 text-stone-800 focus:border-amber-500 focus:ring-amber-500/20 transition-all"
              />
            </div>
          ) : (
            <Input
              type={field.type === "phone" ? "tel" : field.type}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
              value={getValue(key)}
              onChange={(e) => setValue(key, e.target.value)}
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
            {field.options?.map((opt) => {
              const isChecked = getCheckboxGroupValue(key).includes(opt);
              return (
                <div
                  key={opt}
                  onClick={() => toggleCheckboxGroup(key, opt)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    isChecked
                      ? "border-amber-500 bg-amber-50 shadow-sm ring-1 ring-amber-500/30"
                      : "border-stone-200 bg-white hover:border-amber-300"
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleCheckboxGroup(key, opt)}
                    className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  />
                  <span className={`text-sm ${isChecked ? "text-amber-800 font-medium" : "text-stone-600"}`}>{opt}</span>
                </div>
              );
            })}
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
                        setValue(`${key}_selected`, current.filter(v => v !== opt));
                        // Clear cost when deselected
                        const costKey = `${key}_cost_${opt.toLowerCase().replace(/\s+/g, '_')}`;
                        const newResp = { ...responses };
                        delete newResp[costKey];
                        if (opt === "Other") {
                          delete newResp[`${key}_other_label`];
                        }
                        setResponses({ ...newResp, [`${key}_selected`]: current.filter(v => v !== opt) });
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
            {/* Cost inputs for selected types */}
            {(() => {
              const selected: string[] = getCheckboxGroupValue(`${key}_selected`);
              if (selected.length === 0) return null;
              return (
                <div className="mt-4 space-y-3">
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Cost for selected work types</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selected.map((opt) => {
                      const costKey = `${key}_cost_${opt.toLowerCase().replace(/\s+/g, '_')}`;
                      return (
                        <div key={opt} className="space-y-1.5">
                          {opt === "Other" ? (
                            <>
                              <Label className="text-sm text-stone-600">Other — describe:</Label>
                              <Input
                                type="text"
                                placeholder="e.g. Elevator modernization"
                                value={getValue(`${key}_other_label`)}
                                onChange={(e) => setValue(`${key}_other_label`, e.target.value)}
                                className="h-10 bg-white border-stone-200 text-stone-800 focus:border-amber-500 focus:ring-amber-500/20 mb-1"
                              />
                            </>
                          ) : (
                            <Label className="text-sm text-stone-600">{opt}</Label>
                          )}
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={getValue(costKey)}
                              onChange={(e) => setValue(costKey, e.target.value)}
                              className="pl-7 h-10 bg-white border-stone-200 text-stone-800 focus:border-amber-500 focus:ring-amber-500/20"
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

  // Loading state
  if (isLoading) {
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
          <p className="text-stone-500 leading-relaxed">
            This link may be expired or invalid. Please contact your project manager for a new link.
          </p>
        </div>
      </div>
    );
  }

  // Already submitted
  if (submitted || rfi.status === "submitted") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-bold text-stone-800 mb-3">All Done!</h2>
          <p className="text-stone-500 leading-relaxed text-lg">
            Your project information has been submitted. Your project manager will review everything and be in touch shortly.
          </p>
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
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded">
                    Review
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-2">
                  Review & Submit
                </h2>
                <p className="text-stone-500 text-base">
                  Please review your answers below. Click any section to go back and edit.
                </p>
              </div>

              <div className="space-y-6">
                {sections.map((section, sIdx) => (
                  <div key={section.id} className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                    <button
                      onClick={() => { setDirection("back"); setCurrentStep(sIdx); }}
                      className="w-full px-6 py-4 flex items-center justify-between bg-stone-50 hover:bg-amber-50/50 transition-colors text-left border-b border-stone-200"
                    >
                      <h3 className="text-sm font-semibold text-stone-800">{section.title}</h3>
                      <span className="text-xs text-amber-600 font-medium">Edit</span>
                    </button>
                    <div className="px-6 py-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {section.fields.filter(f => f.type !== "heading").map((field) => {
                          const key = getFieldKey(section.id, field.id);

                          // Special rendering for work_type_picker
                          if (field.type === "work_type_picker") {
                            const selected: string[] = Array.isArray(responses[`${key}_selected`]) ? responses[`${key}_selected`] : [];
                            if (selected.length === 0) return null;
                            return (
                              <div key={key} className="sm:col-span-2 py-1.5">
                                <p className="text-xs text-stone-400 mb-1">{field.label}</p>
                                <div className="space-y-1">
                                  {selected.map((opt) => {
                                    const costKey = `${key}_cost_${opt.toLowerCase().replace(/\s+/g, '_')}`;
                                    const cost = responses[costKey];
                                    const label = opt === "Other" ? (responses[`${key}_other_label`] || "Other") : opt;
                                    return (
                                      <div key={opt} className="flex justify-between text-sm">
                                        <span className="text-stone-700">{label}</span>
                                        {cost && <span className="text-stone-600 font-medium">${Number(cost).toLocaleString()}</span>}
                                      </div>
                                    );
                                  })}
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
                              <div className="space-y-1">
                                {(val as { name: string; path: string }[]).map((file, fIdx) => {
                                  const publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/rfi-attachments/${file.path}`;
                                  return (
                                    <button
                                      key={fIdx}
                                      onClick={(e) => { e.stopPropagation(); setPreviewFile({ name: file.name, url: publicUrl }); }}
                                      className="flex items-center gap-2 text-sm text-amber-700 hover:text-amber-900 underline"
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
                            <div key={key} className={`py-1.5 ${field.width === "full" ? "sm:col-span-2" : ""}`}>
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
