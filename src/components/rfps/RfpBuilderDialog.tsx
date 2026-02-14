import { useState, useEffect } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Users,
  Star,
  FileText,
  DollarSign,
  Award,
  GitBranch,
  Eye,
  GripVertical,
  Loader2,
} from "lucide-react";
import { useRfpContent, useNotableApplications } from "@/hooks/useRfpContent";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import type { Rfp } from "@/hooks/useRfps";
import { RfpPreviewModal } from "./RfpPreviewModal";

interface RfpBuilderDialogProps {
  rfp: Rfp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SECTION_DEFS = [
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

  const contentCounts: Record<string, number> = {
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
            Select and order the sections to include in your RFP response package. Toggle sections on/off and reorder them.
          </p>

          <div className="space-y-2 mt-2">
            {sectionOrder.map((sectionId, idx) => {
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
                        disabled={idx === sectionOrder.length - 1}
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

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedSections.length} of {SECTION_DEFS.length} sections selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-1" /> Preview Response
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
