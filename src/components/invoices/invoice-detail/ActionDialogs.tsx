import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Mail, FileWarning, Trash2, Loader2, Sparkles, Eye, Edit3,
} from "lucide-react";
import type { InvoiceWithRelations } from "@/hooks/useInvoices";
import type { WorkflowAction } from "./useInvoiceActions";

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
  onAction: () => Promise<void>;
  onGenerateAi: () => Promise<void>;
}

export function ActionDialogs({
  invoice, activeAction, setActiveAction,
  actionNote, setActionNote, processing, aiGenerating,
  demandStep, setDemandStep, demandLetterText, setDemandLetterText,
  onAction, onGenerateAi,
}: ActionDialogsProps) {
  const formatAmount = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

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
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-destructive">
                {demandStep === "preview" ? "Preview Demand Letter" : "Edit Demand Letter"}
              </DialogTitle>
              <DialogDescription>
                {demandStep === "preview" ? "Review the letter below before sending. Click Edit to make changes." : "Make edits to the demand letter. Click Preview when ready."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="rounded-lg border p-3 bg-muted/50 space-y-1">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">To</span><span className="font-medium" data-clarity-mask="true">{invoice.clients?.name || "—"}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Re: Invoice</span><span className="font-mono font-medium">{invoice.invoice_number}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="tabular-nums font-bold text-destructive" data-clarity-mask="true">{formatAmount(Number(invoice.total_due))}</span></div>
              </div>
              {demandStep === "preview" ? (
                <div className="rounded-lg border p-6 bg-background whitespace-pre-wrap text-sm leading-relaxed font-serif min-h-[200px]">{demandLetterText}</div>
              ) : (
                <Textarea value={demandLetterText} onChange={(e) => setDemandLetterText(e.target.value)} rows={16} className="font-mono text-sm" />
              )}
            </div>
            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" onClick={() => { setActiveAction(null); setDemandStep("edit"); }}>Cancel</Button>
              {demandStep === "preview" ? (
                <>
                  <Button variant="outline" onClick={() => setDemandStep("edit")}><Edit3 className="h-4 w-4 mr-2" /> Edit</Button>
                  <Button variant="destructive" onClick={onAction} disabled={processing}>
                    {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <FileWarning className="h-4 w-4 mr-2" /> Send Demand Letter
                  </Button>
                </>
              ) : (
                <Button onClick={() => setDemandStep("preview")}><Eye className="h-4 w-4 mr-2" /> Preview</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
