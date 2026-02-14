import { useState, useCallback } from "react";
import { BlobProvider } from "@react-pdf/renderer";
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
  const { data: companyData } = useCompanySettings();

  if (!invoice) return null;

  const pdfDoc = (
    <InvoicePDF
      invoice={invoice}
      settings={companyData?.settings}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Invoice Preview — {invoice.invoice_number}</DialogTitle>
              <DialogDescription>Preview the invoice PDF before sending or downloading.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 rounded-lg border bg-muted/30 overflow-hidden">
          <BlobProvider document={pdfDoc}>
            {({ blob, url, loading, error }) => {
              if (loading) {
                return (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-3 text-muted-foreground">Generating PDF...</span>
                  </div>
                );
              }
              if (error) {
                return (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                    <p>Error generating PDF: {error.message}</p>
                  </div>
                );
              }
              if (!url) {
                return (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Unable to generate preview
                  </div>
                );
              }
              return (
                <div className="flex flex-col h-full">
                  <div className="flex justify-end p-2 border-b bg-background">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!blob) return;
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${invoice.invoice_number}.pdf`;
                        a.click();
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" /> Download PDF
                    </Button>
                  </div>
                  <iframe
                    src={url}
                    className="w-full flex-1"
                    title="Invoice PDF Preview"
                  />
                </div>
              );
            }}
          </BlobProvider>
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
  const { pdf } = await import("@react-pdf/renderer");
  const blob = await pdf(
    <InvoicePDF invoice={invoice} settings={settings} />
  ).toBlob();
  return blob;
}
