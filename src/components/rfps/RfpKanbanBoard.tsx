import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Calendar, DollarSign, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useRfps, useUpdateRfpStatus, type Rfp, type RfpStatus } from "@/hooks/useRfps";
import { RfpStatusBadge } from "./RfpStatusBadge";
import { format, differenceInDays, isPast } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const columns: { status: RfpStatus; label: string; color: string }[] = [
  { status: "prospect", label: "Prospect", color: "border-t-muted-foreground" },
  { status: "drafting", label: "Drafting", color: "border-t-blue-500" },
  { status: "submitted", label: "Submitted", color: "border-t-purple-500" },
  { status: "won", label: "Won", color: "border-t-green-500" },
  { status: "lost", label: "Lost", color: "border-t-red-500" },
];

function DueDateDisplay({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  const daysUntil = differenceInDays(date, new Date());
  const overdue = isPast(date);

  return (
    <div className="flex items-center gap-1 text-xs">
      <Calendar className="h-3 w-3" />
      <span>{format(date, "MMM d, yyyy")}</span>
      {overdue ? (
        <span className="text-destructive font-medium ml-1">
          <AlertTriangle className="h-3 w-3 inline mr-0.5" />
          {Math.abs(daysUntil)}d overdue
        </span>
      ) : daysUntil <= 7 ? (
        <span className="text-yellow-600 dark:text-yellow-400 font-medium ml-1">{daysUntil}d left</span>
      ) : null}
    </div>
  );
}

function RfpCard({ rfp, onDragStart }: { rfp: Rfp; onDragStart: (e: React.DragEvent, rfp: Rfp) => void }) {
  const requirements = rfp.requirements as Record<string, any> | null;
  const scopeItems = requirements?.scope_of_work?.length || 0;

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, rfp)}
      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <CardContent className="p-3 space-y-2">
        <div className="font-medium text-sm leading-tight">{rfp.title}</div>
        {rfp.rfp_number && (
          <div className="text-xs text-muted-foreground font-mono">#{rfp.rfp_number}</div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {rfp.agency && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {rfp.agency}
            </div>
          )}
          <DueDateDisplay dueDate={rfp.due_date} />
        </div>
        {rfp.contract_value && rfp.status === "won" && (
          <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400 font-medium">
            <DollarSign className="h-3 w-3" />
            {rfp.contract_value.toLocaleString()}
          </div>
        )}
        {scopeItems > 0 && (
          <div className="text-xs text-muted-foreground">{scopeItems} scope items</div>
        )}
        {(rfp.mwbe_goal_min || rfp.mwbe_goal_max) && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            M/WBE {rfp.mwbe_goal_min}–{rfp.mwbe_goal_max}%
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export function RfpKanbanBoard() {
  const { data: rfps = [], isLoading } = useRfps();
  const updateStatus = useUpdateRfpStatus();
  const [draggedRfp, setDraggedRfp] = useState<Rfp | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ rfp: Rfp; newStatus: RfpStatus } | null>(null);

  const handleDragStart = (_e: React.DragEvent, rfp: Rfp) => {
    setDraggedRfp(rfp);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (newStatus: RfpStatus) => {
    if (!draggedRfp || draggedRfp.status === newStatus) {
      setDraggedRfp(null);
      return;
    }
    if (newStatus === "won" || newStatus === "lost") {
      setConfirmDialog({ rfp: draggedRfp, newStatus });
    } else {
      updateStatus.mutate({ id: draggedRfp.id, status: newStatus });
    }
    setDraggedRfp(null);
  };

  const confirmStatusChange = () => {
    if (!confirmDialog) return;
    updateStatus.mutate({
      id: confirmDialog.rfp.id,
      status: confirmDialog.newStatus,
      outcome: confirmDialog.newStatus,
    });
    setConfirmDialog(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-5 gap-4 min-h-[500px]">
        {columns.map((col) => {
          const colRfps = rfps.filter((r) => r.status === col.status);
          return (
            <div
              key={col.status}
              className={`bg-muted/30 rounded-lg border border-t-4 ${col.color} p-3 flex flex-col gap-3`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(col.status)}
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  {colRfps.length}
                </Badge>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {colRfps.map((rfp) => (
                  <RfpCard key={rfp.id} rfp={rfp} onDragStart={handleDragStart} />
                ))}
                {colRfps.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground py-8">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmDialog?.newStatus === "won" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Mark as {confirmDialog?.newStatus === "won" ? "Won" : "Lost"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark "{confirmDialog?.rfp.title}" as{" "}
              <strong>{confirmDialog?.newStatus}</strong>? You can change this later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
