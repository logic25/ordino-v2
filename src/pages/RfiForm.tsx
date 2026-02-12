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

  const sections = useMemo(() => rfi?.sections || [], [rfi]);
  const totalSteps = sections.length;
  const progress = totalSteps > 0 ? Math.max(0, ((currentStep + 1) / totalSteps) * 100) : 0;
  const currentSection = currentStep >= 0 ? sections[currentStep] : null;

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
          if (prefillValue && section.id === "project_info") {
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
  const setValue = (key: string, value: any) => setResponses({ ...responses, [key]: value });

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
    if (currentStep < totalSteps - 1) {
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
          <h4 className="text-base font-semibold text-foreground">{field.label}</h4>
          <div className="h-px bg-border mt-2" />
        </div>
      );
    }

    const widthClass = field.width === "half" ? "col-span-1" : "col-span-full";

    return (
      <div key={key} className={`space-y-2 ${widthClass}`}>
        <Label className="text-sm font-medium text-slate-300">
          {field.label}
          {field.required && <span className="text-amber-500 ml-0.5">*</span>}
        </Label>

        {(field.type === "text" || field.type === "phone" || field.type === "email" || field.type === "number" || field.type === "currency") ? (
          field.type === "currency" ? (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                placeholder="0.00"
                value={getValue(key)}
                onChange={(e) => setValue(key, e.target.value)}
                className="pl-7 h-11 bg-card border-border/60 focus:border-amber-500/50 focus:ring-amber-500/20 transition-all"
              />
            </div>
          ) : (
            <Input
              type={field.type === "phone" ? "tel" : field.type}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
              value={getValue(key)}
              onChange={(e) => setValue(key, e.target.value)}
              className="h-11 bg-card border-border/60 focus:border-amber-500/50 focus:ring-amber-500/20 transition-all"
            />
          )
        ) : field.type === "textarea" ? (
          <Textarea
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            value={getValue(key)}
            onChange={(e) => setValue(key, e.target.value)}
            rows={3}
            className="bg-card border-border/60 focus:border-amber-500/50 focus:ring-amber-500/20 transition-all resize-none"
          />
        ) : field.type === "select" ? (
          <Select value={getValue(key)} onValueChange={(v) => setValue(key, v)}>
            <SelectTrigger className="h-11 bg-card border-border/60 focus:border-amber-500/50 focus:ring-amber-500/20">
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.type === "checkbox" ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card hover:border-amber-500/30 transition-colors cursor-pointer"
            onClick={() => setValue(key, !getValue(key))}
          >
            <Checkbox
              checked={!!getValue(key)}
              onCheckedChange={(checked) => setValue(key, !!checked)}
              className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
            />
            <span className="text-sm">{field.placeholder || "Yes"}</span>
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
                      ? "border-amber-500/60 bg-amber-500/5 shadow-sm"
                      : "border-border/60 bg-card hover:border-amber-500/30"
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleCheckboxGroup(key, opt)}
                    className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  />
                  <span className="text-sm">{opt}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-slate-400 text-sm">Loading your form...</p>
        </div>
      </div>
    );
  }

  // Invalid/not found
  if (!rfi || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-6">
            <FileText className="h-8 w-8 text-slate-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Form Not Found</h2>
          <p className="text-slate-400 leading-relaxed">
            This link may be expired or invalid. Please contact your project manager for a new link.
          </p>
        </div>
      </div>
    );
  }

  // Already submitted
  if (submitted || rfi.status === "submitted") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">All Done!</h2>
          <p className="text-slate-400 leading-relaxed text-lg">
            Your project information has been submitted. Your project manager will review everything and be in touch shortly.
          </p>
        </div>
      </div>
    );
  }

  // Welcome screen
  if (currentStep === -1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center">
          {/* Logo / branding area */}
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-8">
            <Building2 className="h-8 w-8 text-amber-500" />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            {rfi.title}
          </h1>

          {property && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/80 border border-slate-700/50 mb-6">
              <Building2 className="h-4 w-4 text-amber-500" />
              <span className="text-slate-300 text-sm font-medium">{property.address}</span>
              {property.borough && (
                <span className="text-slate-500 text-sm">· {property.borough}</span>
              )}
            </div>
          )}

          <p className="text-slate-400 text-lg mb-10 leading-relaxed max-w-md mx-auto">
            We need some information about your project to get started. This should take about <span className="text-white font-medium">{Math.max(5, totalSteps * 2)} minutes</span>.
          </p>

          {/* Section preview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-10 max-w-md mx-auto">
            {sections.map((section, i) => (
              <div
                key={section.id}
                className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/30 text-left"
              >
                <span className="text-[10px] font-mono text-amber-500/70">{String(i + 1).padStart(2, "0")}</span>
                <p className="text-xs text-slate-300 leading-snug mt-0.5">{section.title}</p>
              </div>
            ))}
          </div>

          <Button
            onClick={startForm}
            size="lg"
            className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8 h-12 text-base rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/30 hover:scale-[1.02]"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            {currentStep === 0 ? "Back" : "Previous"}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-500">
              {currentStep + 1} / {totalSteps}
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-slate-800">
          <div
            className="h-full bg-amber-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-2xl">
          {currentSection && (
            <div key={currentSection.id} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Section header */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                    {String(currentStep + 1).padStart(2, "0")}
                  </span>
                  {currentSection.repeatable && (
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                      repeatable
                    </span>
                  )}
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  {currentSection.title}
                </h2>
                {currentSection.description && (
                  <p className="text-slate-400 text-base">{currentSection.description}</p>
                )}
              </div>

              {/* Fields */}
              {currentSection.repeatable ? (
                <div className="space-y-6">
                  {Array.from({ length: getRepeatCount(currentSection.id) }).map((_, repeatIdx) => (
                    <div key={repeatIdx} className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-medium text-slate-400">
                          Entry {repeatIdx + 1}
                        </h3>
                        {repeatIdx > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => removeRepeat(currentSection.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {currentSection.fields.map((field) => renderField(field, currentSection.id, repeatIdx))}
                      </div>
                    </div>
                  ))}
                  {getRepeatCount(currentSection.id) < (currentSection.maxRepeat || 4) && (
                    <button
                      onClick={() => addRepeat(currentSection.id, currentSection.maxRepeat || 4)}
                      className="w-full py-3 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:text-amber-400 hover:border-amber-500/40 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Add Another
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {currentSection.fields.map((field) => renderField(field, currentSection.id))}
                  </div>
                </div>
              )}

              {/* Section progress hint */}
              {(() => {
                const { total, filled } = getSectionProgress(currentSection);
                return total > 0 ? (
                  <p className="text-xs text-slate-600 mt-4">
                    {filled} of {total} fields completed
                  </p>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="sticky bottom-0 bg-slate-900/80 backdrop-blur-xl border-t border-slate-700/50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Step dots */}
          <div className="hidden sm:flex items-center gap-1">
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
                      : "w-2 bg-slate-700 hover:bg-slate-600"
                  }`}
                  title={section.title}
                />
              );
            })}
          </div>

          {/* Action button */}
          {currentStep < totalSteps - 1 ? (
            <Button
              onClick={goNext}
              className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 h-11 rounded-xl ml-auto"
            >
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !validateCurrentStep()}
              className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 h-11 rounded-xl ml-auto disabled:opacity-50"
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
          )}
        </div>
      </div>
    </div>
  );
}
