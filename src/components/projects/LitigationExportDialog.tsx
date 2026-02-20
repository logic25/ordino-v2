import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from "date-fns";
import { CalendarIcon, Download, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { pdf } from "@react-pdf/renderer";
import { LitigationPDF } from "./LitigationPDF";
import type { ProjectWithRelations } from "@/hooks/useProjects";
import type {
  MockService, MockContact, MockMilestone,
  MockEmail, MockDocument, MockTimeEntry,
} from "./projectMockData";
import type { ChangeOrder } from "@/hooks/useChangeOrders";

interface LitigationExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithRelations;
  milestones: MockMilestone[];
  emails: MockEmail[];
  documents: MockDocument[];
  timeEntries: MockTimeEntry[];
  changeOrders: ChangeOrder[];
  contacts: MockContact[];
  services: MockService[];
}

const INCLUDE_OPTIONS = [
  { key: "emails", label: "Emails & Communications" },
  { key: "timeline", label: "Timeline Events" },
  { key: "documents", label: "Document Register" },
  { key: "timeLogs", label: "Time Logs" },
  { key: "financials", label: "Financial Summary" },
  { key: "decisions", label: "Critical Decisions" },
  { key: "changeOrders", label: "Change Orders" },
  { key: "contacts", label: "Project Contacts" },
] as const;

type IncludeKey = typeof INCLUDE_OPTIONS[number]["key"];

export function LitigationExportDialog({
  open, onOpenChange, project, milestones, emails, documents,
  timeEntries, changeOrders, contacts, services,
}: LitigationExportDialogProps) {
  const [startDate, setStartDate] = useState<Date>(new Date("2026-01-01"));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [includes, setIncludes] = useState<Record<IncludeKey, boolean>>({
    emails: true, timeline: true, documents: true, timeLogs: true,
    financials: true, decisions: true, changeOrders: true, contacts: true,
  });
  const [outputFormat, setOutputFormat] = useState<"pdf" | "pdf_zip">("pdf");
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const toggleInclude = (key: IncludeKey) => {
    setIncludes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const blob = await pdf(
        <LitigationPDF
          project={project}
          milestones={milestones}
          emails={emails}
          documents={documents}
          timeEntries={timeEntries}
          changeOrders={changeOrders}
          contacts={contacts}
          services={services}
          startDate={startDate}
          endDate={endDate}
          includes={includes}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Litigation-Package-${project.project_number || project.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Litigation Package Generated", description: "PDF downloaded successfully." });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Generate Litigation Package
          </DialogTitle>
          <DialogDescription>
            Generate a chronological audit trail for legal defense. All project events, communications, and decisions will be compiled into a structured PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Date Range</Label>
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal gap-2")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {format(startDate, "MM/dd/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} />
                </PopoverContent>
              </Popover>
              <span className="text-sm text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[140px] justify-start text-left font-normal gap-2")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {format(endDate, "MM/dd/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Include Sections */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Include Sections</Label>
            <div className="grid grid-cols-2 gap-2">
              {INCLUDE_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md hover:bg-muted/40 transition-colors">
                  <Checkbox
                    checked={includes[opt.key]}
                    onCheckedChange={() => toggleInclude(opt.key)}
                    className="h-4 w-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Output Format */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Output Format</Label>
            <RadioGroup value={outputFormat} onValueChange={(v) => setOutputFormat(v as "pdf" | "pdf_zip")} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="pdf" /> PDF Only
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground">
                <RadioGroupItem value="pdf_zip" disabled /> PDF + ZIP (coming soon)
              </label>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generating ? "Generating..." : "Generate Package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
