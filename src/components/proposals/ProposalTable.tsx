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
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
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
import { MoreHorizontal, Edit, Trash2, Send, PenLine, Eye, Loader2, CheckCircle2, Clock, X, Phone, Bell, FileText, Settings2, XCircle, FolderOpen, ExternalLink, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  onMarkLost?: (id: string) => void;
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
  executed: { label: "Executed", className: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-900/40 dark:text-emerald-300" },
  lost: { label: "Lost", className: "bg-red-100 text-red-800 border-transparent dark:bg-red-900/40 dark:text-red-300" },
  expired: { label: "Expired", className: "bg-stone-100 text-stone-600 border-transparent dark:bg-stone-800/40 dark:text-stone-400" },
};

type ColumnKey = "proposal_number" | "property" | "title" | "client" | "pm" | "status" | "follow_up" | "total" | "creator" | "created";

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "proposal_number", label: "Proposal #" },
  { key: "property", label: "Property" },
  { key: "title", label: "Title" },
  { key: "client", label: "Client" },
  { key: "pm", label: "PM" },
  { key: "status", label: "Status" },
  { key: "follow_up", label: "Follow-up" },
  { key: "total", label: "Total" },
  { key: "creator", label: "Creator" },
  { key: "created", label: "Created" },
];

const DEFAULT_VISIBLE: ColumnKey[] = ["proposal_number", "property", "title", "client", "pm", "status", "follow_up", "total", "creator", "created"];

const STORAGE_KEY = "proposal-table-columns";

function loadVisibleColumns(): Set<ColumnKey> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return new Set(JSON.parse(stored) as ColumnKey[]);
  } catch {}
  return new Set(DEFAULT_VISIBLE);
}

export function ProposalTable({
  proposals,
  onEdit,
  onDelete,
  onSend,
  onSign,
  onView,
  onPreview,
  onMarkApproved,
  onMarkLost,
  onDismissFollowUp,
  onLogFollowUp,
  onSnoozeFollowUp,
  isDeleting,
  isSending,
}: ProposalTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(loadVisibleColumns);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 3) return prev; // minimum 3 columns
        next.delete(key);
      } else {
        next.add(key);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const show = (key: ColumnKey) => visibleCols.has(key);

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
        <div className="flex justify-end mb-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <Settings2 className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_COLUMNS.map(col => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleCols.has(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                  className="text-xs"
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      <Table>
        <TableHeader>
          <TableRow>
            {show("proposal_number") && <TableHead className="whitespace-nowrap">Proposal #</TableHead>}
            {show("property") && <TableHead>Property</TableHead>}
            {show("title") && <TableHead>Title</TableHead>}
            {show("client") && <TableHead>Client</TableHead>}
            {show("pm") && <TableHead>PM</TableHead>}
            {show("status") && <TableHead>Status</TableHead>}
            {show("follow_up") && <TableHead>Follow-up</TableHead>}
            {show("total") && <TableHead className="text-right whitespace-nowrap">Total</TableHead>}
            {show("creator") && <TableHead>Creator</TableHead>}
            {show("created") && <TableHead>Created</TableHead>}
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {proposals.map((proposal) => {
            const statusStyle = STATUS_STYLES[proposal.status || "draft"];

            return (
              <TableRow key={proposal.id}>
                {show("proposal_number") && (
                  <TableCell className="font-mono text-sm">
                    {proposal.proposal_number || "-"}
                  </TableCell>
                )}
                {show("property") && (
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
                )}
                {show("title") && (
                  <TableCell className="font-medium">
                    {proposal.title}
                  </TableCell>
                )}
                {show("client") && (
                  <TableCell data-clarity-mask="true">
                    {proposal.client_name || "-"}
                    {proposal.client_email && (
                      <div className="text-xs text-muted-foreground">
                        {proposal.client_email}
                      </div>
                    )}
                  </TableCell>
                )}
                {show("pm") && (
                  <TableCell className="text-sm text-muted-foreground">
                    {(proposal as any).assigned_pm
                      ? `${(proposal as any).assigned_pm.first_name} ${(proposal as any).assigned_pm.last_name}`
                      : "-"}
                  </TableCell>
                )}
                {show("status") && (
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      {proposal.status === "executed" && (proposal as any).converted_project?.project_number ? (
                        <Badge
                          className="cursor-pointer hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-transparent gap-1 text-xs px-1.5 py-0 font-mono"
                          onClick={() => {
                            const projectId = (proposal as any).converted_project?.id;
                            if (projectId) window.location.href = `/projects/${projectId}`;
                          }}
                        >
                          <FolderOpen className="h-3 w-3" />
                          {(proposal as any).converted_project.project_number}
                        </Badge>
                      ) : (
                        <Badge className={statusStyle.className}>
                          {statusStyle.label}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                )}
                {show("follow_up") && (
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
                )}
                {show("total") && (
                  <TableCell className="text-right font-medium" data-clarity-mask="true">
                    {formatCurrency(Number(proposal.total_amount))}
                  </TableCell>
                )}
                {show("creator") && (
                  <TableCell className="text-sm font-medium text-primary">
                    {(proposal as any).creator
                      ? `${(proposal as any).creator.first_name} ${(proposal as any).creator.last_name}`
                      : "-"}
                  </TableCell>
                )}
                {show("created") && (
                  <TableCell className="text-muted-foreground">
                    {proposal.created_at
                      ? format(new Date(proposal.created_at), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                )}
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
                      {(proposal as any).public_token && (
                        <DropdownMenuItem onClick={() => window.open(`/proposal/${(proposal as any).public_token}`, '_blank')}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Client Preview
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onEdit(proposal)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {(proposal.status === "draft" || proposal.status === "viewed") && (
                        <DropdownMenuItem onClick={() => onSign(proposal)}>
                          <PenLine className="h-4 w-4 mr-2" />
                          Sign & Send
                        </DropdownMenuItem>
                      )}
                      {proposal.status === "sent" && (
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
                      {proposal.status === "executed" && !(proposal as any).converted_project_id && onMarkApproved && (
                        <DropdownMenuItem onClick={() => onMarkApproved(proposal)}>
                          <FolderOpen className="h-4 w-4 mr-2" />
                          Convert to Project
                        </DropdownMenuItem>
                      )}
                      {["sent", "viewed", "draft"].includes(proposal.status || "") && onMarkLost && (
                        <DropdownMenuItem onClick={() => onMarkLost(proposal.id)}>
                          <XCircle className="h-4 w-4 mr-2" />
                          Mark as Lost
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
