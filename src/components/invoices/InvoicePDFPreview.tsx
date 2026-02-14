import { useState, useEffect } from "react";
import { pdf } from "@react-pdf/renderer";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { InvoicePDF } from "./InvoicePDF";
import type { InvoiceWithRelations } from "@/hooks/useInvoices";
import { useCompanySettings } from "@/hooks/useCompanySettings";

interface InvoicePDFPreviewProps {
  invoice: InvoiceWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoicePDFPreview({ invoice, open, onOpenChange }: InvoicePDFPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { data: companyData } = useCompanySettings();

  useEffect(() => {
    if (!open || !invoice) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }

    let cancelled = false;
    setLoading(true);

    const generate = async () => {
      try {
        const blob = await pdf(
          <InvoicePDF
            invoice={invoice}
            companyName={companyData ? undefined : undefined}
            settings={companyData?.settings}
          />
        ).toBlob();
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      } catch (err) {
        console.error("PDF generation failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    generate();
    return () => { cancelled = true; };
  }, [open, invoice, companyData]);

  const handleDownload = () => {
    if (!blobUrl || !invoice) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${invoice.invoice_number}.pdf`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Invoice Preview — {invoice?.invoice_number}</DialogTitle>
              <DialogDescription>Preview the invoice PDF before sending or downloading.</DialogDescription>
            </div>
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={!blobUrl}>
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 rounded-lg border bg-muted/30 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Generating PDF...</span>
            </div>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              className="w-full h-full"
              title="Invoice PDF Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Unable to generate preview
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Utility: generate PDF blob for an invoice (used by SendInvoiceModal) */
export async function generateInvoicePDFBlob(
  invoice: InvoiceWithRelations,
  settings?: import("@/hooks/useCompanySettings").CompanySettings,
): Promise<Blob> {
  const blob = await pdf(
    <InvoicePDF invoice={invoice} settings={settings} />
  ).toBlob();
  return blob;
}
