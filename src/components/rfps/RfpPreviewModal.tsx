import { useState, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  Printer, Send, X, Loader2, Calendar,
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type { Rfp } from "@/hooks/useRfps";
import { buildRfpEmailHtml } from "./buildRfpEmailBody";

interface PreviewData {
  rfp: Rfp | null;
  sections: string[];
  companyInfo: any;
  staffBios: any[];
  notableProjects: any[];
  narratives: any[];
  firmHistory: any[];
  pricing: any;
  certs: any[];
  coverLetter?: string;
  logoUrl?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
}

interface RfpPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PreviewData;
}

export function RfpPreviewModal({ open, onOpenChange, data }: RfpPreviewModalProps) {
  const { rfp } = data;
  const contentRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const emailHtml = useMemo(() => buildRfpEmailHtml(data), [data]);

  const handleExportPdf = async () => {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const A4_WIDTH_MM = 210;
      const A4_HEIGHT_MM = 297;
      const MARGIN_MM = 12;
      const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pxPerMM = canvas.width / CONTENT_WIDTH_MM;
      const usableHeightPx = (A4_HEIGHT_MM - MARGIN_MM * 2) * pxPerMM;

      let srcY = 0;
      let pageIndex = 0;

      while (srcY < canvas.height) {
        if (pageIndex > 0) pdf.addPage();
        const slicePx = Math.min(usableHeightPx, canvas.height - srcY);
        const sliceMM = slicePx / pxPerMM;

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = slicePx;
        const ctx = sliceCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);

        pdf.addImage(sliceCanvas.toDataURL("image/jpeg", 0.75), "JPEG", MARGIN_MM, MARGIN_MM, CONTENT_WIDTH_MM, sliceMM);
        srcY += slicePx;
        pageIndex++;
      }

      pdf.save(`RFP-Response-${rfp?.rfp_number || rfp?.title || "draft"}.pdf`);
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] p-0 overflow-hidden flex flex-col [&>button]:hidden">
        {/* Header */}
        <div className="bg-muted border-b px-6 pt-6 pb-4 flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-muted-foreground text-sm font-normal tracking-wide uppercase">
              RFP Response Preview
            </DialogTitle>
          </DialogHeader>
          <h2 className="text-xl font-bold text-foreground mt-2 pr-8">{rfp?.title || "Untitled RFP"}</h2>
          <div className="flex gap-4 text-sm mt-2 flex-wrap">
            {rfp?.rfp_number && (
              <span className="bg-accent/20 text-accent px-2 py-0.5 rounded text-xs font-mono">
                RFP #{rfp.rfp_number}
              </span>
            )}
            {rfp?.agency && (
              <span className="text-muted-foreground text-xs">Agency: {rfp.agency}</span>
            )}
            {rfp?.due_date && (
              <span className="text-muted-foreground text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due: {format(new Date(rfp.due_date), "MMM d, yyyy")}
              </span>
            )}
          </div>
        </div>

        {/* Content — renders the actual branded email HTML */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#f0f0f0]">
          <div className="max-w-[680px] mx-auto my-6 bg-white shadow-lg rounded-lg overflow-hidden">
            <div
              ref={contentRef}
              dangerouslySetInnerHTML={{ __html: emailHtml }}
            />
          </div>
        </div>

        {/* Sticky footer with actions */}
        <div className="flex-shrink-0 border-t bg-muted/50 px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}
              {exporting ? "Generating..." : "Export PDF"}
            </Button>
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Send className="h-4 w-4 mr-1" />
              Send Response
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
