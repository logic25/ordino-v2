import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Library, Upload, LayoutGrid, List, Loader2, FileUp, Sparkles, Radar } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useRfps, useCreateRfp } from "@/hooks/useRfps";
import { RfpKanbanBoard } from "@/components/rfps/RfpKanbanBoard";
import { RfpTableView } from "@/components/rfps/RfpTableView";
import { RfpSummaryCards, type RfpFilter } from "@/components/rfps/RfpSummaryCards";
import { RfpBuilderDialog } from "@/components/rfps/RfpBuilderDialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTelemetry } from "@/hooks/useTelemetry";
import { supabase } from "@/integrations/supabase/client";
import type { Rfp } from "@/hooks/useRfps";
import { AgencyCombobox } from "@/components/rfps/AgencyCombobox";

export default function Rfps() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<"kanban" | "table">("table");
  const [cardFilter, setCardFilter] = useState<RfpFilter>(null);
  const { data: rfps = [], isLoading } = useRfps();
  const createRfp = useCreateRfp();
  const { toast } = useToast();
  const { track } = useTelemetry();
  const [newOpen, setNewOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [aiExtracted, setAiExtracted] = useState<any>(null);
  const [buildingRfp, setBuildingRfp] = useState<Rfp | null>(null);

  // Auto-open builder when navigated from Discovery with ?openBuilder=<id>
  useEffect(() => {
    const openBuilderId = searchParams.get("openBuilder");
    if (openBuilderId && rfps.length > 0) {
      const rfp = rfps.find((r) => r.id === openBuilderId);
      if (rfp) {
        setBuildingRfp(rfp);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, rfps]);
  const [form, setForm] = useState({
    title: "",
    rfp_number: "",
    agency: "",
    due_date: "",
    contract_value: "",
    mwbe_goal_min: "",
    submission_method: "",
    notes: "",
  });

  const resetForm = () => {
    setForm({ title: "", rfp_number: "", agency: "", due_date: "", contract_value: "", mwbe_goal_min: "", submission_method: "", notes: "" });
    setUploadedFile(null);
    setAiExtracted(null);
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setExtracting(true);
    setAiExtracted(null);

    try {
      // Upload to storage
      const path = `uploads/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("rfp-documents")
        .upload(path, file);
      if (uploadError) throw uploadError;

      // Call AI extraction
      const { data, error } = await supabase.functions.invoke("extract-rfp", {
        body: { storagePath: path },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const ext = data.extracted;
      setAiExtracted(ext);

      // Pre-fill form
      setForm({
        title: ext.title || "",
        rfp_number: ext.rfp_number || "",
        agency: ext.agency || "",
        due_date: ext.due_date || "",
        contract_value: ext.contract_value?.toString() || "",
        mwbe_goal_min: ext.mwbe_goal_min?.toString() || "",
        submission_method: ext.submission_method || "",
        notes: [
          ext.scope_summary || "",
          ext.contract_value_source === "estimated" ? `⚡ Contract value is AI-estimated based on scope analysis` : "",
          ext.estimated_staff_count ? `Estimated staff needed: ${ext.estimated_staff_count}` : "",
          ext.estimated_duration_months ? `Estimated duration: ${ext.estimated_duration_months} months` : "",
          ext.notes || "",
          ext.key_dates?.length ? `\nKey Dates:\n${ext.key_dates.map((d: any) => `• ${d.label}: ${d.date}`).join("\n")}` : "",
          ext.required_sections?.length ? `\nRequired Sections: ${ext.required_sections.join(", ")}` : "",
        ].filter(Boolean).join("\n"),
      });

      toast({ title: "AI extracted RFP details", description: "Review and adjust the pre-filled fields." });
    } catch (e: any) {
      console.error("Extraction error:", e);
      toast({ title: "Extraction failed", description: e.message, variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title) { toast({ title: "Title is required", variant: "destructive" }); return; }
    try {
      const extraFields: Record<string, any> = {};
      if (aiExtracted?.insurance_requirements) {
        extraFields.insurance_requirements = aiExtracted.insurance_requirements;
      }
      if (aiExtracted?.requirements) {
        extraFields.requirements = aiExtracted.requirements;
      }

      const result = await createRfp.mutateAsync({
        title: form.title,
        rfp_number: form.rfp_number || null,
        agency: form.agency || null,
        status: "prospect",
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        contract_value: form.contract_value ? parseFloat(form.contract_value) : null,
        mwbe_goal_min: form.mwbe_goal_min ? parseFloat(form.mwbe_goal_min) : null,
        submission_method: form.submission_method || null,
        notes: form.notes || null,
        ...extraFields,
      });
      track("rfps", "create_completed", { used_ai_extract: !!aiExtracted });
      toast({ title: "RFP created — now build your response" });
      setNewOpen(false);
      resetForm();
      setBuildingRfp(result as Rfp);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">RFPs</h1>
            <p className="text-muted-foreground text-sm">
              Track and respond to Requests for Proposals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "kanban" | "table")} size="sm" variant="outline">
              <ToggleGroupItem value="table" aria-label="Table view">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="kanban" aria-label="Kanban view">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button variant="outline" onClick={() => navigate("/rfps/discover")}>
              <Radar className="h-4 w-4 mr-2" /> Discover
            </Button>
            <Button variant="outline" onClick={() => navigate("/rfps/library")}>
              <Library className="h-4 w-4 mr-2" /> Content Library
            </Button>
            <Button onClick={() => { resetForm(); setNewOpen(true); }}>
              <Upload className="h-4 w-4 mr-2" /> New RFP
            </Button>
          </div>
        </div>

        <RfpSummaryCards rfps={rfps} activeFilter={cardFilter} onFilterChange={setCardFilter} />

        {view === "kanban" ? (
          <RfpKanbanBoard rfps={rfps} isLoading={isLoading} />
        ) : (
          <RfpTableView rfps={rfps} isLoading={isLoading} cardFilter={cardFilter} />
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New RFP</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Upload Section */}
            <div className="border-2 border-dashed rounded-lg p-4 text-center space-y-2">
              {extracting ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">AI is analyzing the RFP document...</p>
                </div>
              ) : uploadedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{uploadedFile.name}</span>
                  {aiExtracted && (
                    <Badge variant="secondary" className="text-xs">
                      <Sparkles className="h-3 w-3 mr-0.5" /> AI Extracted
                    </Badge>
                  )}
                </div>
              ) : (
                <>
                  <FileUp className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Upload the RFP document and AI will extract the details
                  </p>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Sparkles className="h-4 w-4 mr-1" /> Upload & Extract with AI
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">Or fill in manually below</p>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. DOE School Renovation Expediting" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>RFP #</Label>
                <Input value={form.rfp_number} onChange={(e) => setForm({ ...form, rfp_number: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Agency</Label>
                <AgencyCombobox value={form.agency} onChange={(v) => setForm({ ...form, agency: v })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Contract Value ($)</Label>
                <Input
                  value={form.contract_value ? Number(form.contract_value).toLocaleString("en-US") : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9.]/g, "");
                    setForm({ ...form, contract_value: raw });
                  }}
                  placeholder="150,000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>M/WBE Goal %</Label>
                <Input type="number" value={form.mwbe_goal_min} onChange={(e) => setForm({ ...form, mwbe_goal_min: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Submission Method</Label>
                <Select value={form.submission_method} onValueChange={(v) => setForm({ ...form, submission_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                    <SelectItem value="in-person">In Person</SelectItem>
                    <SelectItem value="mail">Mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* AI-detected insurance requirements */}
            {aiExtracted?.insurance_requirements && Object.keys(aiExtracted.insurance_requirements).length > 0 && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Detected Insurance Requirements
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(aiExtracted.insurance_requirements).map(([key, val]) => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {key.replace(/_/g, " ")}: {val as string}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* AI-detected required sections */}
            {aiExtracted?.required_sections?.length > 0 && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Required Response Sections
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {aiExtracted.required_sections.map((s: string) => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createRfp.isPending || !form.title}>
              {createRfp.isPending ? "Creating..." : "Create RFP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RfpBuilderDialog
        rfp={buildingRfp}
        open={!!buildingRfp}
        onOpenChange={(open) => !open && setBuildingRfp(null)}
      />
    </AppLayout>
  );
}
