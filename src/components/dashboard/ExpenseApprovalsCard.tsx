import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, FileText, Check, X, ExternalLink, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePendingExpenseApprovals, useApproveExpense, useDenyExpense, getReceiptSignedUrl } from "@/hooks/useProjectExpenses";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

export function ExpenseApprovalsCard() {
  const { data: expenses = [], isLoading } = usePendingExpenseApprovals();
  const approve = useApproveExpense();
  const deny = useDenyExpense();
  const navigate = useNavigate();
  const [denying, setDenying] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");

  const openReceipt = async (path: string) => {
    try {
      const url = await getReceiptSignedUrl(path);
      window.open(url, "_blank");
    } catch (err: any) {
      toast({ title: "Could not load receipt", description: err.message, variant: "destructive" });
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approve.mutateAsync({ expenseId: id });
      toast({ title: "Expense approved" });
    } catch (err: any) {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDeny = async () => {
    if (!denying || !denyReason.trim()) return;
    try {
      await deny.mutateAsync({ expenseId: denying, reason: denyReason.trim() });
      toast({ title: "Expense denied" });
      setDenying(null);
      setDenyReason("");
    } catch (err: any) {
      toast({ title: "Deny failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-600" />
            Expense Approvals
            {expenses.length > 0 && (
              <Badge variant="destructive" className="ml-auto">{expenses.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>PM-requested expenses waiting on your approval.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nothing waiting on you. Nice.</p>
          ) : (
            expenses.map((e: any) => {
              const requester = e.created_by_profile;
              const reqName = requester?.display_name || `${requester?.first_name || ""} ${requester?.last_name || ""}`.trim() || "PM";
              const proj = e.projects;
              return (
                <div key={e.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => navigate(`/projects/${e.project_id}`)}
                          className="font-medium text-sm hover:underline text-left truncate"
                        >
                          {proj?.project_number ? `${proj.project_number} — ` : ""}{proj?.name || "Project"}
                        </button>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                      {proj?.properties?.address && (
                        <p className="text-xs text-muted-foreground truncate">{proj.properties.address}</p>
                      )}
                      <p className="text-sm mt-1">{e.description}{e.vendor ? ` · ${e.vendor}` : ""}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Requested by {reqName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold tabular-nums">{formatCurrency(Number(e.amount))}</p>
                      {Number(e.markup_pct) > 0 && (
                        <p className="text-xs text-muted-foreground">+{e.markup_pct}% → {formatCurrency(Number(e.billable_amount))}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {e.receipt_url && (
                      <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => openReceipt(e.receipt_url)}>
                        <FileText className="h-3.5 w-3.5" /> Receipt
                      </Button>
                    )}
                    <div className="flex-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => { setDenying(e.id); setDenyReason(""); }}
                      disabled={deny.isPending}
                    >
                      <X className="h-3.5 w-3.5" /> Deny
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 gap-1.5"
                      onClick={() => handleApprove(e.id)}
                      disabled={approve.isPending}
                    >
                      {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={!!denying} onOpenChange={(o) => { if (!o) { setDenying(null); setDenyReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Why are you denying this expense? The requester will see your reason.</p>
            <Textarea value={denyReason} onChange={(e) => setDenyReason(e.target.value)} placeholder="e.g. Need quote from client first" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDenying(null); setDenyReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeny} disabled={!denyReason.trim() || deny.isPending}>
              {deny.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Deny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
