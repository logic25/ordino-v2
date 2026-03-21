import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, GitBranch, Trash2, AlertTriangle, ShieldCheck, PenLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDeleteChangeOrder } from "@/hooks/useChangeOrders";
import { formatCurrency } from "@/lib/utils";
import { coStatusStyles } from "@/components/projects/projectMockData";
import { format } from "date-fns";
import type { ChangeOrder } from "@/hooks/useChangeOrders";

export function ChangeOrdersFull({ changeOrders, projectId, companyId, serviceNames, onOpenCreate, onSelectCO }: {
  changeOrders: ChangeOrder[];
  projectId: string;
  companyId: string;
  serviceNames: string[];
  onOpenCreate: () => void;
  onSelectCO: (co: ChangeOrder) => void;
}) {
  const coTotal = changeOrders.filter(co => co.status === "approved").reduce((s, co) => s + Number(co.amount), 0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const deleteCO = useDeleteChangeOrder();
  const { toast } = useToast();

  const toggleAll = () => {
    if (selectedIds.size === changeOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(changeOrders.map(co => co.id)));
    }
  };

  const handleBulkDelete = async () => {
    const toDelete = changeOrders.filter(co => selectedIds.has(co.id));
    let deleted = 0;
    for (const co of toDelete) {
      try {
        await deleteCO.mutateAsync({ id: co.id, project_id: projectId });
        deleted++;
      } catch { /* continue */ }
    }
    toast({ title: `${deleted} CO${deleted !== 1 ? "s" : ""} deleted`, description: deleteReason ? `Reason: ${deleteReason}` : undefined });
    setSelectedIds(new Set());
    setDeleteConfirmOpen(false);
    setDeleteReason("");
  };

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {changeOrders.length} change order{changeOrders.length !== 1 ? "s" : ""}
            {coTotal > 0 && <> · Approved: <span className="font-semibold text-foreground">{formatCurrency(coTotal)}</span></>}
          </span>
          {selectedIds.size > 0 && (
            <Button size="sm" variant="destructive" className="gap-1.5 h-7 text-xs" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="h-3 w-3" /> Delete {selectedIds.size}
            </Button>
          )}
        </div>
        <Button size="sm" className="gap-1.5" onClick={onOpenCreate}>
          <Plus className="h-4 w-4" /> Create Change Order
        </Button>
      </div>

      {changeOrders.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <GitBranch className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No change orders yet</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={onOpenCreate}>
            <Plus className="h-3.5 w-3.5" /> Create Change Order
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.size === changeOrders.length && changeOrders.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>CO #</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Signed</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changeOrders.map((co) => {
              const style = coStatusStyles[co.status] || coStatusStyles.draft;
              const internalSigned = !!co.internal_signed_at;
              const clientSigned = !!co.client_signed_at;
              return (
                <TableRow key={co.id} className={`cursor-pointer hover:bg-muted/20 ${selectedIds.has(co.id) ? "bg-muted/30" : ""}`} onClick={() => onSelectCO(co)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(co.id)}
                      onCheckedChange={() => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(co.id)) next.delete(co.id); else next.add(co.id);
                          return next;
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-medium">{co.co_number}</TableCell>
                  <TableCell>{co.title}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.className}`}>{style.label}</span>
                  </TableCell>
                  <TableCell>
                    {internalSigned && clientSigned ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <ShieldCheck className="h-3.5 w-3.5" /> Fully Executed
                      </span>
                    ) : co.status !== "draft" ? (
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className={internalSigned ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                          {internalSigned ? `✓ Internal ${co.internal_signed_at ? format(new Date(co.internal_signed_at), "MM/dd/yy") : ""}` : "⏳ Internal"}
                        </span>
                        <span className={clientSigned ? "text-emerald-600 dark:text-emerald-400" : co.sent_at ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"}>
                          {clientSigned ? `✓ Client ${co.client_signed_at ? format(new Date(co.client_signed_at), "MM/dd/yy") : ""}` : co.sent_at ? `📧 Sent ${format(new Date(co.sent_at), "MM/dd/yy")}` : "⏳ Client"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{co.requested_by || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(co.created_at), "MM/dd/yyyy")}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(Number(co.amount))}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete {selectedIds.size} Change Order{selectedIds.size !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Please provide a reason for deleting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="delete-reason">Reason *</Label>
            <Textarea
              id="delete-reason"
              placeholder="Why are these change orders being deleted?"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={!deleteReason.trim() || deleteCO.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCO.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
