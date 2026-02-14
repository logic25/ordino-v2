import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Users,
  Star,
  FileText,
  DollarSign,
  Award,
  GitBranch,
  Eye,
  Loader2,
  Sparkles,
  Mail,
  Download,
} from "lucide-react";
import { useRfpContent, useNotableApplications } from "@/hooks/useRfpContent";
import { useUpdateRfpStatus, type Rfp, type RfpStatus } from "@/hooks/useRfps";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RfpPreviewModal } from "./RfpPreviewModal";

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

export function RfpBuilderDialog({ rfp, open, onOpenChange }: RfpBuilderDialogProps) {
  const [selectedSections, setSelectedSections] = useState<string[]>(
    SECTION_DEFS.map((s) => s.id)
  );
  const [sectionOrder, setSectionOrder] = useState<string[]>(
    SECTION_DEFS.map((s) => s.id)
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitEmail, setSubmitEmail] = useState("");
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const updateStatus = useUpdateRfpStatus();
  const { toast } = useToast();

  // Fetch all content
  const { data: companyInfo = [] } = useRfpContent("company_info");
  const { data: staffBios = [] } = useRfpContent("staff_bio");
  const { data: narratives = [] } = useRfpContent("narrative_template");
  const { data: firmHistory = [] } = useRfpContent("firm_history");
  const { data: pricing = [] } = useRfpContent("pricing");
  const { data: certs = [] } = useRfpContent("certification");
  const { data: notableProjects = [] } = useNotableApplications();

  const toggleSection = (id: string) => {
    setSelectedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const moveSection = (id: string, direction: "up" | "down") => {
    setSectionOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
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
      // Send via gmail-send edge function
      const { data, error } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: submitEmail,
          subject: `RFP Response: ${rfp.title}${rfp.rfp_number ? ` (#${rfp.rfp_number})` : ""}`,
          body: buildEmailBody(),
        },
      });
      if (error) throw error;

      // Update RFP status to submitted
      await updateStatus.mutateAsync({
        id: rfp.id,
        status: "submitted" as RfpStatus,
        submitted_at: new Date().toISOString(),
      });

      toast({ title: "RFP response submitted!", description: `Sent to ${submitEmail} and status updated to Submitted.` });
      setShowSubmitForm(false);
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

  const handleExportPDF = () => {
    // Open print-friendly preview for PDF export
    setPreviewOpen(true);
    toast({ title: "Use your browser's Print function (Ctrl+P) to save as PDF from the preview" });
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Build RFP Response — {rfp?.title}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Select and order the sections to include in your RFP response package.
          </p>

          {/* Cover Letter Section */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">AI Cover Letter</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateCoverLetter}
                  disabled={generatingLetter}
                >
                  {generatingLetter ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-1" />
                  )}
                  {coverLetter ? "Regenerate" : "Generate"}
                </Button>
              </div>
              {coverLetter && (
                <Textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={6}
                  className="text-sm"
                />
              )}
            </CardContent>
          </Card>

          <div className="space-y-2 mt-2">
            {sectionOrder.filter((s) => s !== "cover_letter").map((sectionId, idx) => {
              const def = SECTION_DEFS.find((s) => s.id === sectionId);
              if (!def) return null;
              const Icon = def.icon;
              const count = contentCounts[sectionId] || 0;
              const isSelected = selectedSections.includes(sectionId);

              return (
                <Card key={sectionId} className={!isSelected ? "opacity-50" : ""}>
                  <CardContent className="py-3 flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSection(sectionId)}
                    />
                    <div className="flex flex-col gap-0.5">
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => moveSection(sectionId, "up")}
                        disabled={idx === 0}
                      >
                        ▲
                      </button>
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => moveSection(sectionId, "down")}
                        disabled={idx === sectionOrder.filter((s) => s !== "cover_letter").length - 1}
                      >
                        ▼
                      </button>
                    </div>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm flex-1">{def.label}</span>
                    <Badge variant={count > 0 ? "secondary" : "outline"} className="text-xs">
                      {count} {count === 1 ? "item" : "items"}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Separator className="my-2" />

          {/* Submit Form */}
          {showSubmitForm && (
            <Card className="border-primary/30">
              <CardContent className="py-3 space-y-3">
                <Label className="text-sm font-medium">Submit via Email</Label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={submitEmail}
                    onChange={(e) => setSubmitEmail(e.target.value)}
                    placeholder="agency@email.com"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button
                    size="sm"
                    onClick={handleSubmitViaEmail}
                    disabled={submitting || !submitEmail}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4 mr-1" />
                    )}
                    Send
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This will email the response and mark this RFP as "Submitted".
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedSections.length} sections selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-1" /> Preview
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSubmitForm(!showSubmitForm)}
              >
                <Mail className="h-4 w-4 mr-1" /> Email Submit
              </Button>
            </div>
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
