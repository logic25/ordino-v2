import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontal, Edit, Trash2, Send, PenLine, Eye, Loader2, CheckCircle2, Clock, X, Phone, Bell, FileText } from "lucide-react";
import { useState } from "react";
import type { ProposalWithRelations } from "@/hooks/useProposals";
import { format, isPast, parseISO } from "date-fns";

interface ProposalTableProps {
  proposals: ProposalWithRelations[];
  onEdit: (proposal: ProposalWithRelations) => void;
  onDelete: (id: string) => void;
  onSend: (id: string) => void;
  onSign: (proposal: ProposalWithRelations) => void;
  onView: (proposal: ProposalWithRelations) => void;
  onPreview?: (proposal: ProposalWithRelations) => void;
  onMarkApproved?: (proposal: ProposalWithRelations) => void;
  onDismissFollowUp?: (id: string) => void;
  onLogFollowUp?: (id: string) => void;
  onSnoozeFollowUp?: (id: string, days: number) => void;
  isDeleting?: boolean;
  isSending?: boolean;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-transparent" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-800 border-transparent dark:bg-blue-900/40 dark:text-blue-300" },
  viewed: { label: "Viewed", className: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-900/40 dark:text-amber-300" },
  signed_internal: { label: "Signed (Internal)", className: "bg-indigo-100 text-indigo-800 border-transparent dark:bg-indigo-900/40 dark:text-indigo-300" },
  signed_client: { label: "Signed (Client)", className: "bg-violet-100 text-violet-800 border-transparent dark:bg-violet-900/40 dark:text-violet-300" },
  accepted: { label: "Accepted", className: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-900/40 dark:text-emerald-300" },
  rejected: { label: "Rejected", className: "bg-destructive text-destructive-foreground border-transparent" },
  expired: { label: "Expired", className: "bg-stone-100 text-stone-600 border-transparent dark:bg-stone-800/40 dark:text-stone-400" },
};

export function ProposalTable({
  proposals,
  onEdit,
  onDelete,
  onSend,
  onSign,
  onView,
  onPreview,
  onMarkApproved,
  onDismissFollowUp,
  onLogFollowUp,
  onSnoozeFollowUp,
  isDeleting,
  isSending,
}: ProposalTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  if (proposals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No proposals found matching your search.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Proposal #</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Follow-up</TableHead>
            <TableHead className="text-right whitespace-nowrap">Total</TableHead>
            <TableHead>Creator</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {proposals.map((proposal) => {
            const statusStyle = STATUS_STYLES[proposal.status || "draft"];

            return (
              <TableRow key={proposal.id}>
                <TableCell className="font-mono text-sm">
                  {proposal.proposal_number || "-"}
                </TableCell>
                <TableCell>
                  <div className="max-w-[200px] truncate">
                    {proposal.properties?.address || "-"}
                  </div>
                  {proposal.properties?.borough && (
                    <div className="text-xs text-muted-foreground">
                      {proposal.properties.borough}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {proposal.title}
                </TableCell>
                <TableCell>
                  {proposal.client_name || "-"}
                  {proposal.client_email && (
                    <div className="text-xs text-muted-foreground">
                      {proposal.client_email}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={statusStyle.className}>
                    {statusStyle.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {(() => {
                    const nextDate = (proposal as any).next_follow_up_date;
                    const dismissed = (proposal as any).follow_up_dismissed_at;
                    const count = (proposal as any).follow_up_count || 0;
                    if (!nextDate || dismissed) return <span className="text-xs text-muted-foreground">—</span>;
                    const isOverdue = isPast(parseISO(nextDate));
                    return (
                      <div className="flex items-center gap-1">
                        <Bell className={`h-3.5 w-3.5 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`} />
                        <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {format(parseISO(nextDate), "MMM d")}
                        </span>
                        {count > 0 && (
                          <span className="text-[10px] text-muted-foreground">(×{count})</span>
                        )}
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(Number(proposal.total_amount))}
                </TableCell>
                <TableCell className="text-sm font-medium text-primary">
                  {(proposal as any).creator
                    ? `${(proposal as any).creator.first_name} ${(proposal as any).creator.last_name}`
                    : "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {proposal.created_at
                    ? format(new Date(proposal.created_at), "MMM d, yyyy")
                    : "-"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(proposal)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View / Edit
                      </DropdownMenuItem>
                      {onPreview && (
                        <DropdownMenuItem onClick={() => onPreview(proposal)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Preview PDF
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onEdit(proposal)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {(proposal.status === "draft" || proposal.status === "sent" || proposal.status === "viewed") && (
                        <DropdownMenuItem onClick={() => onSign(proposal)}>
                          <PenLine className="h-4 w-4 mr-2" />
                          Sign & Send
                        </DropdownMenuItem>
                      )}
                      {proposal.status === "signed_internal" && (
                        <DropdownMenuItem onClick={() => onSend(proposal.id)}>
                          <Send className="h-4 w-4 mr-2" />
                          Resend to Client
                        </DropdownMenuItem>
                      )}
                      {(proposal.status === "sent" || proposal.status === "viewed") && onMarkApproved && (
                        <DropdownMenuItem onClick={() => onMarkApproved(proposal)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark as Approved
                        </DropdownMenuItem>
                      )}
                      {(proposal as any).next_follow_up_date && !(proposal as any).follow_up_dismissed_at && (
                        <>
                          {onLogFollowUp && (
                            <DropdownMenuItem onClick={() => onLogFollowUp(proposal.id)}>
                              <Phone className="h-4 w-4 mr-2" />
                              Log Follow-up
                            </DropdownMenuItem>
                          )}
                          {onSnoozeFollowUp && (
                            <DropdownMenuItem onClick={() => onSnoozeFollowUp(proposal.id, 7)}>
                              <Clock className="h-4 w-4 mr-2" />
                              Snooze 1 Week
                            </DropdownMenuItem>
                          )}
                          {onDismissFollowUp && (
                            <DropdownMenuItem onClick={() => onDismissFollowUp(proposal.id)}>
                              <X className="h-4 w-4 mr-2" />
                              Dismiss Follow-up
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(proposal.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              proposal and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
