import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRfiByToken, type RfiSectionConfig, type RfiFieldConfig } from "@/hooks/useRfi";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Send, FileText, Plus, Trash2 } from "lucide-react";

export default function RfiForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { data: rfi, isLoading, error } = useRfiByToken(token);

  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [repeatCounts, setRepeatCounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const sections = useMemo(() => rfi?.sections || [], [rfi]);
  const totalSteps = sections.length;
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;
  const currentSection = sections[currentStep];

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
      // Clean up responses for removed repeat
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

  const renderField = (field: RfiFieldConfig, sectionId: string, repeatIdx: number = 0) => {
    const key = getFieldKey(sectionId, field.id, repeatIdx);

    if (field.type === "heading") {
      return (
        <div key={key} className="col-span-2 pt-2">
          <h4 className="font-medium text-foreground">{field.label}</h4>
        </div>
      );
    }

    const widthClass = field.width === "half" ? "col-span-1" : "col-span-2";

    return (
      <div key={key} className={`space-y-1.5 ${widthClass}`}>
        <Label className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>

        {(field.type === "text" || field.type === "phone" || field.type === "email" || field.type === "number" || field.type === "currency") ? (
          field.type === "currency" ? (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                placeholder="0.00"
                value={getValue(key)}
                onChange={(e) => setValue(key, e.target.value)}
                className="pl-7 bg-background"
              />
            </div>
          ) : (
            <Input
              type={field.type === "phone" ? "tel" : field.type}
              placeholder={field.placeholder}
              value={getValue(key)}
              onChange={(e) => setValue(key, e.target.value)}
              className="bg-background"
            />
          )
        ) : field.type === "textarea" ? (
          <Textarea
            placeholder={field.placeholder}
            value={getValue(key)}
            onChange={(e) => setValue(key, e.target.value)}
            rows={3}
            className="bg-background"
          />
        ) : field.type === "select" ? (
          <Select value={getValue(key)} onValueChange={(v) => setValue(key, v)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.type === "checkbox" ? (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={!!getValue(key)}
              onCheckedChange={(checked) => setValue(key, !!checked)}
            />
            <span className="text-sm">{field.placeholder || "Yes"}</span>
          </div>
        ) : field.type === "checkbox_group" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 border rounded-lg bg-background">
            {field.options?.map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  checked={getCheckboxGroupValue(key).includes(opt)}
                  onCheckedChange={() => toggleCheckboxGroup(key, opt)}
                />
                <span className="text-sm">{opt}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Invalid/not found
  if (!rfi || error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Form Not Found</h2>
            <p className="text-muted-foreground">
              This link may be expired or invalid. Please contact your project manager for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already submitted
  if (submitted || rfi.status === "submitted") {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-accent mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Thank You!</h2>
            <p className="text-muted-foreground">
              Your project information has been submitted successfully. Your project manager will review it and follow up with you shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-semibold">{rfi.title}</h1>
              <p className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {totalSteps}
                {currentSection && ` · ${currentSection.title}`}
              </p>
            </div>
            <Badge variant="secondary">{Math.round(progress)}%</Badge>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {currentSection && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">{currentSection.title}</h2>
              {currentSection.description && (
                <p className="text-muted-foreground mt-1">{currentSection.description}</p>
              )}
            </div>

            {currentSection.repeatable ? (
              <div className="space-y-6">
                {Array.from({ length: getRepeatCount(currentSection.id) }).map((_, repeatIdx) => (
                  <Card key={repeatIdx}>
                    <CardContent className="pt-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">
                          Entry {repeatIdx + 1}
                        </h3>
                        {repeatIdx > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => removeRepeat(currentSection.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {currentSection.fields.map((field) => renderField(field, currentSection.id, repeatIdx))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {getRepeatCount(currentSection.id) < (currentSection.maxRepeat || 4) && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => addRepeat(currentSection.id, currentSection.maxRepeat || 4)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another {currentSection.title.replace(/Info$/, "").trim()}
                  </Button>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    {currentSection.fields.map((field) => renderField(field, currentSection.id))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {currentStep < totalSteps - 1 ? (
            <Button
              onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
              disabled={!validateCurrentStep()}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !validateCurrentStep()}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
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
