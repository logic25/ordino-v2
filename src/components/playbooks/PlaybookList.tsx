import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, BookOpen, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { usePlaybooksForMarket, useDeletePlaybook } from "@/hooks/usePermitPlaybooks";
import AddPlaybookDialog from "./AddPlaybookDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PlaybookList({ marketId }: { marketId: string }) {
  const { data: playbooks = [], isLoading } = usePlaybooksForMarket(marketId);
  const del = useDeletePlaybook();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Permit Playbooks
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reusable jurisdiction knowledge per permit type. AI drafts; humans verify.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New Playbook
        </Button>
      </div>

      {isLoading && (
        <div className="text-center py-4 text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" />
        </div>
      )}

      {!isLoading && playbooks.length === 0 && (
        <div className="text-sm text-muted-foreground italic py-2">
          No playbooks yet. Add one for the first permit type you file in this market.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {playbooks.map((p) => {
          const total = p.qa.length;
          const verified = p.qa.filter((s) => s.verified).length;
          const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
          return (
            <Card key={p.id} className="p-3 flex items-center gap-3 hover:bg-muted/40 transition">
              <Link to={`/markets/${marketId}/playbooks/${p.id}`} className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.permit_type}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className={
                      verified === total && total > 0
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }
                  >
                    {verified} of {total} verified
                  </Badge>
                  {p.last_verified_at && (
                    <span>Fully verified {new Date(p.last_verified_at).toLocaleDateString()}</span>
                  )}
                </div>
                <div className="h-1 mt-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </Link>
              <Button
                size="icon" variant="ghost" aria-label="Delete playbook"
                onClick={() => setConfirmDel({ id: p.id, name: p.permit_type })}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </Card>
          );
        })}
      </div>

      <AddPlaybookDialog open={addOpen} onOpenChange={setAddOpen} marketId={marketId} />

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{confirmDel?.name}" playbook?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the playbook, its Q&A, and its attachments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDel) return;
                await del.mutateAsync({ id: confirmDel.id, market_id: marketId });
                setConfirmDel(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
