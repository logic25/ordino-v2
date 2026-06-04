import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, ExternalLink, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useApproveExpense, useDenyExpense, getReceiptSignedUrl } from "@/hooks/useProjectExpenses";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface Props {
  expenseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Auto-close after a successful approval/denial */
  closeOnSuccess?: boolean;
}

/**
 * Compact dialog to approve or deny a single expense.
 * Used by the pending-approval pill on the dashboard, project page, and the
 * email "Review & Approve" landing link.
 */
export function ApproveExpenseDialog({ expenseId, open, onOpenChange, closeOnSuccess = true }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const approve = useApproveExpense();
  const deny = useDenyExpense();
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [denyMode, setDenyMode] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !expenseId) {
      setExpense(null);
      setDenyMode(false);
      setDenyReason("");
      setReceiptUrl(null);
      return;
    }
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("project_expenses" as any)
        .select(`*,
          projects:project_id (id, project_number, name, properties:property_id (address)),
          created_by_profile:profiles!project_expenses_created_by_fkey (id, first_name, last_name, display_name)
        `)
        .eq("id", expenseId)
        .maybeSingle();
      if (error) {
        toast({ title: "Could not load expense", description: error.message, variant: "destructive" });
      } else {
        setExpense(data);
        if ((data as any)?.receipt_url) {
          try {
            const url = await getReceiptSignedUrl((data as any).receipt_url);
            setReceiptUrl(url);
          } catch { /* ignore */ }
        }
      }
      setLoading(false);
    })();
  }, [open, expenseId, toast]);

  const handleApprove = async () => {
    if (!expenseId) return;
    try {
      await approve.mutateAsync({ expenseId });
      toast({ title: "Expense approved" });
      if (closeOnSuccess) onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDeny = async () => {
    if (!expenseId || !denyReason.trim()) return;
    try {
      await deny.mutateAsync({ expenseId, reason: denyReason.trim() });
      toast({ title: "Expense denied" });
      if (closeOnSuccess) onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Deny failed", description: err.message, variant: "destructive" });
    }
  };

  const e = expense;
  const proj = e?.projects;
  const requester = e?.created_by_profile;
  const reqName =
    requester?.display_name ||
    `${requester?.first_name || ""} ${requester?.last_name || ""}`.trim() ||
    "PM";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve Expense</DialogTitle>
          <DialogDescription>Quick review — Approve, Deny, or open the project for more context.</DialogDescription>
        </DialogHeader>

        {loading || !e ? (
          <div className="py-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button
                  onClick={() => { onOpenChange(false); navigate(`/projects/${e.project_id}`); }}
                  className="font-medium hover:underline text-left inline-flex items-center gap-1"
                >
                  {proj?.project_number ? `${proj.project_number} — ` : ""}{proj?.name || "Project"}
                  <ExternalLink className="h-3 w-3" />
                </button>
                {proj?.properties?.address && (
                  <p className="text-xs text-muted-foreground">{proj.properties.address}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold tabular-nums text-lg">{formatCurrency(Number(e.amount))}</p>
                {Number(e.markup_pct) > 0 && (
                  <p className="text-xs text-muted-foreground">+{e.markup_pct}% → {formatCurrency(Number(e.billable_amount))}</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-1 text-sm">
              <p className="font-medium">{e.description}</p>
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                {e.vendor && <span>{e.vendor}</span>}
                {e.category && <Badge variant="outline" className="text-xs">{e.category}</Badge>}
                <span>· Requested by {reqName}</span>
              </div>
            </div>

            {receiptUrl && (
              <div className="rounded-lg border overflow-hidden">
                <a href={receiptUrl} target="_blank" rel="noreferrer" className="block">
                  {/^.+\.(pdf)$/i.test(e.receipt_url || "") ? (
                    <div className="p-4 flex items-center gap-2 text-sm text-primary hover:underline">
                      <FileText className="h-4 w-4" /> Open receipt PDF
                    </div>
                  ) : (
                    <img src={receiptUrl} alt="Receipt" className="max-h-40 w-full object-contain bg-muted" />
                  )}
                </a>
              </div>
            )}

            {denyMode && (
              <Textarea
                value={denyReason}
                onChange={(ev) => setDenyReason(ev.target.value)}
                placeholder="Reason — the requester will see this"
                rows={3}
              />
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {!denyMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => { onOpenChange(false); if (e?.project_id) navigate(`/projects/${e.project_id}`); }}
                disabled={!e}
              >
                Open project
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive gap-1.5"
                onClick={() => setDenyMode(true)}
                disabled={!e || approve.isPending}
              >
                <X className="h-4 w-4" /> Deny
              </Button>
              <Button onClick={handleApprove} disabled={!e || approve.isPending} className="gap-1.5">
                {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Approve
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setDenyMode(false); setDenyReason(""); }}>Back</Button>
              <Button
                variant="destructive"
                onClick={handleDeny}
                disabled={!denyReason.trim() || deny.isPending}
                className="gap-1.5"
              >
                {deny.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Deny
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
