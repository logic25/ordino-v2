import { useState, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Send, Eye, Download, Mail, FileWarning, Trash2, Gavel, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { generateInvoicePDFBlob } from "../InvoicePDFPreview";
const InvoicePDFPreview = lazy(() => import("../InvoicePDFPreview").then(m => ({ default: m.InvoicePDFPreview })));
import type { InvoiceWithRelations } from "@/hooks/useInvoices";
import type { useInvoiceActions } from "./useInvoiceActions";

interface InvoiceActionsSectionProps {
  invoice: InvoiceWithRelations;
  actions: ReturnType<typeof useInvoiceActions>;
  onSendInvoice?: (invoice: InvoiceWithRelations) => void;
  onOpenClaimFlow: () => void;
}

export function InvoiceActionsSection({ invoice, actions, onSendInvoice, onOpenClaimFlow }: InvoiceActionsSectionProps) {
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isOverdue = invoice.status === "overdue";
  const isSent = invoice.status === "sent";

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const logoUrl = actions.companyData?.logo_url || actions.companyData?.settings?.company_logo_url || "";
      const blob = await generateInvoicePDFBlob(invoice, actions.companyData?.settings, actions.companyData?.name, logoUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${invoice.invoice_number}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "PDF Error", description: err.message, variant: "destructive" });
    } finally { setDownloading(false); }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setPdfPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-2" /> Preview PDF
          </Button>
          <Button variant="outline" size="sm" className="flex-1" disabled={downloading} onClick={handleDownload}>
            {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />} Download
          </Button>
        </div>

        {(invoice.status === "draft" || invoice.status === "ready_to_send") && onSendInvoice && (
          <Button onClick={() => onSendInvoice(invoice)} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Send className="h-4 w-4 mr-2" /> Send Invoice
          </Button>
        )}

        {(isOverdue || isSent) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Collections Actions</h4>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { actions.setActiveAction("reminder"); actions.setActionNote(""); }}>
                <Mail className="h-3.5 w-3.5 mr-1.5" /> Send Reminder
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={actions.openDemandLetter}>
                <FileWarning className="h-3.5 w-3.5 mr-1.5" /> Demand Letter
              </Button>
            </div>
            {isOverdue && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground" onClick={() => { actions.setActiveAction("writeoff"); actions.setActionNote(""); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Write Off
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={onOpenClaimFlow}>
                  <Gavel className="h-3.5 w-3.5 mr-1.5" /> ClaimCurrent
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <InvoicePDFPreview invoice={invoice} open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen} />
      </Suspense>
    </>
  );
}
