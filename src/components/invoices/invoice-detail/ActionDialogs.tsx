import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Mail, FileWarning, Trash2, Loader2, Sparkles, Eye, Edit3, Download, FileText, Send,
} from "lucide-react";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { DemandLetterPDF } from "../DemandLetterPDF";
import type { InvoiceWithRelations } from "@/hooks/useInvoices";
import type { WorkflowAction } from "./useInvoiceActions";
import type { DemandLetterResult } from "@/hooks/useDemandLetter";

const ACTION_DIALOG_CONFIG = {
  reminder: {
    title: "Send Payment Reminder",
    buttonLabel: "Send Reminder",
    buttonIcon: <Mail className="h-4 w-4 mr-2" />,
    variant: "default" as const,
    placeholder: "Add a personal note to the reminder...",
  },
  writeoff: {
    title: "Write Off Invoice",
    buttonLabel: "Write Off",
    buttonIcon: <Trash2 className="h-4 w-4 mr-2" />,
    variant: "destructive" as const,
    placeholder: "",
  },
};

interface ActionDialogsProps {
  invoice: InvoiceWithRelations;
  activeAction: WorkflowAction;
  setActiveAction: (a: WorkflowAction) => void;
  actionNote: string;
  setActionNote: (n: string) => void;
  processing: boolean;
  aiGenerating: boolean;
  demandStep: "edit" | "preview";
  setDemandStep: (s: "edit" | "preview") => void;
  demandLetterText: string;
  setDemandLetterText: (t: string) => void;
  demandScope: "client" | "property";
  setDemandScope: (s: "client" | "property") => void;
  demandResult: DemandLetterResult | null;
  demandLoading: boolean;
  demandCc: string;
  setDemandCc: (s: string) => void;
  demandSubject: string;
  setDemandSubject: (s: string) => void;
  onRegenerateDemand: (scope: "client" | "property") => Promise<void> | void;
  onAction: () => Promise<void>;
  onGenerateAi: () => Promise<void>;
}

function money(n: number) {
  return `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

async function downloadDemandPdf(data: DemandLetterResult, body: string) {
  const React = await import("react");
  const element = React.createElement(DemandLetterPDF, { data, bodyOverride: body });
  const blob = await pdf(element as any).toBlob();
  const url = URL.createObjectURL(blob);
  const safeName = `Demand-Letter-${(data.recipient?.name || "Client").replace(/[^a-z0-9]+/gi, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ActionDialogs(props: ActionDialogsProps) {
  const {
    invoice, activeAction, setActiveAction,
    actionNote, setActionNote, processing, aiGenerating,
    demandStep, setDemandStep, demandLetterText, setDemandLetterText,
    demandScope, demandResult, demandLoading,
    demandCc, setDemandCc, demandSubject, setDemandSubject,
    onRegenerateDemand, onAction, onGenerateAi,
  } = props;

  const formatAmount = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const pdfElement = useMemo(() => {
    if (!demandResult) return null;
    return <DemandLetterPDF data={demandResult} bodyOverride={demandLetterText} />;
  }, [demandResult, demandLetterText]);

  return (
    <>
      {/* Reminder / Write-Off Dialog */}
      {activeAction && activeAction !== "demand" && (
        <Dialog open={!!activeAction} onOpenChange={(o) => !o && setActiveAction(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className={activeAction === "writeoff" ? "text-destructive" : ""}>
                {ACTION_DIALOG_CONFIG[activeAction].title}
              </DialogTitle>
              <DialogDescription>
                {activeAction === "reminder"
                  ? `Send a reminder for invoice ${invoice.invoice_number}`
                  : `Permanently write off invoice ${invoice.invoice_number} (${formatAmount(Number(invoice.total_due))}). This cannot be undone.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/50 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-mono font-medium">{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="tabular-nums font-medium" data-clarity-mask="true">{formatAmount(Number(invoice.total_due))}</span>
                </div>
              </div>
              {activeAction === "reminder" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Message</Label>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onGenerateAi} disabled={aiGenerating}>
                      {aiGenerating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                      Generate with AI
                    </Button>
                  </div>
                  <Textarea value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder={ACTION_DIALOG_CONFIG.reminder.placeholder} rows={aiGenerating ? 6 : 3} />
                </div>
              )}
              {activeAction === "writeoff" && (
                <p className="text-sm text-destructive/80">⚠️ This will mark the invoice as closed with zero collection. The amount will be reflected as a loss.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveAction(null)}>Cancel</Button>
              <Button variant={ACTION_DIALOG_CONFIG[activeAction].variant} onClick={onAction} disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {ACTION_DIALOG_CONFIG[activeAction].buttonIcon}
                {ACTION_DIALOG_CONFIG[activeAction].buttonLabel}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Demand Letter Dialog */}
      {activeAction === "demand" && (
        <Dialog open onOpenChange={(o) => { if (!o) { setActiveAction(null); setDemandStep("edit"); } }}>
          <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <FileWarning className="h-5 w-5" />
                Formal Demand Letter
              </DialogTitle>
              <DialogDescription>
                Drafted from invoice + signed-agreement context. Review carefully — this is a legal escalation.
              </DialogDescription>
            </DialogHeader>

            {/* Scope toggle */}
            <div className="flex items-center gap-2 -mt-1">
              <span className="text-xs text-muted-foreground">Aggregation:</span>
              <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
                <button
                  onClick={() => onRegenerateDemand("client")}
                  disabled={demandLoading || processing}
                  className={`px-2.5 py-1 text-xs rounded ${demandScope === "client" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                >
                  This client (all past-due)
                </button>
                <button
                  onClick={() => onRegenerateDemand("property")}
                  disabled={demandLoading || processing}
                  className={`px-2.5 py-1 text-xs rounded ${demandScope === "property" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                >
                  This property only
                </button>
              </div>
              {demandLoading && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1 ml-auto">
                  <Loader2 className="h-3 w-3 animate-spin" /> Drafting from agreement context…
                </span>
              )}
            </div>

            {/* Summary chips */}
            {demandResult && !demandLoading && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="text-xs">
                  {demandResult.invoice_count} invoice{demandResult.invoice_count !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {demandResult.property_count} propert{demandResult.property_count !== 1 ? "ies" : "y"}
                </Badge>
                <Badge variant="secondary" className="text-xs font-mono">
                  {money(demandResult.grand_principal)} principal
                </Badge>
                {demandResult.grand_interest > 0 && (
                  <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 text-xs font-mono">
                    + {money(demandResult.grand_interest)} interest
                  </Badge>
                )}
                <Badge variant="destructive" className="text-xs font-mono">
                  {money(demandResult.grand_total)} demanded
                </Badge>
              </div>
            )}

            {/* Subject + CC */}
            {demandResult && !demandLoading && (
              <div className="space-y-2">
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <Input value={demandSubject} onChange={(e) => setDemandSubject(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <Label className="text-xs text-muted-foreground">CC admins</Label>
                  <Input value={demandCc} onChange={(e) => setDemandCc(e.target.value)} placeholder="comma-separated emails (leave blank for none)" className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <div className="text-sm font-medium" data-clarity-mask="true">
                    {demandResult.recipient?.name} {demandResult.recipient?.email && <span className="text-muted-foreground font-normal">&lt;{demandResult.recipient.email}&gt;</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Letter body | PDF preview */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-[300px]">
              <Tabs defaultValue="body" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="self-start">
                  <TabsTrigger value="body" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1.5" /> Letter Body</TabsTrigger>
                  <TabsTrigger value="pdf" className="text-xs" disabled={!demandResult}><FileWarning className="h-3.5 w-3.5 mr-1.5" /> PDF Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="body" className="flex-1 overflow-y-auto mt-2">
                  {demandStep === "preview" ? (
                    <div className="rounded-lg border p-6 bg-background whitespace-pre-wrap text-sm leading-relaxed font-serif min-h-[200px]">
                      {demandLoading ? "Drafting…" : demandLetterText}
                    </div>
                  ) : (
                    <Textarea
                      value={demandLetterText}
                      onChange={(e) => setDemandLetterText(e.target.value)}
                      rows={20}
                      className="font-mono text-sm h-full"
                      disabled={demandLoading}
                    />
                  )}
                </TabsContent>
                <TabsContent value="pdf" className="flex-1 mt-2 overflow-hidden">
                  {pdfElement ? (
                    <div className="h-full min-h-[400px] border rounded-md overflow-hidden">
                      <PDFViewer width="100%" height="100%" showToolbar={false}>
                        {pdfElement}
                      </PDFViewer>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground p-4">No PDF available yet.</div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2 flex-wrap">
              <Button variant="outline" onClick={() => { setActiveAction(null); setDemandStep("edit"); }}>Cancel</Button>
              {demandResult && (
                <Button variant="outline" onClick={() => downloadDemandPdf(demandResult, demandLetterText)}>
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </Button>
              )}
              {demandStep === "preview" ? (
                <Button variant="outline" onClick={() => setDemandStep("edit")} disabled={demandLoading}>
                  <Edit3 className="h-4 w-4 mr-2" /> Edit
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setDemandStep("preview")} disabled={demandLoading}>
                  <Eye className="h-4 w-4 mr-2" /> Preview
                </Button>
              )}
              <Button variant="destructive" onClick={onAction} disabled={processing || demandLoading || !demandLetterText.trim()}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" />
                Send Demand Letter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
