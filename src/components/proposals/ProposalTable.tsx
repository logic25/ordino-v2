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
import { MoreHorizontal, Edit, Trash2, Send, PenLine, Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ProposalWithRelations } from "@/hooks/useProposals";
import { format } from "date-fns";

interface ProposalTableProps {
  proposals: ProposalWithRelations[];
  onEdit: (proposal: ProposalWithRelations) => void;
  onDelete: (id: string) => void;
  onSend: (id: string) => void;
  onSign: (proposal: ProposalWithRelations) => void;
  onView: (proposal: ProposalWithRelations) => void;
  isDeleting?: boolean;
  isSending?: boolean;
}

const STATUS_STYLES: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  sent: { variant: "default", label: "Sent" },
  viewed: { variant: "outline", label: "Viewed" },
  signed_internal: { variant: "default", label: "Signed (Internal)" },
  signed_client: { variant: "default", label: "Signed (Client)" },
  accepted: { variant: "default", label: "Accepted" },
  rejected: { variant: "destructive", label: "Rejected" },
  expired: { variant: "secondary", label: "Expired" },
};

export function ProposalTable({
  proposals,
  onEdit,
  onDelete,
  onSend,
  onSign,
  onView,
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proposal #</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
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
                  <Badge variant={statusStyle.variant}>
                    {statusStyle.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(Number(proposal.total_amount))}
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
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(proposal)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {proposal.status === "draft" && (
                        <DropdownMenuItem onClick={() => onSend(proposal.id)}>
                          <Send className="h-4 w-4 mr-2" />
                          Send to Client
                        </DropdownMenuItem>
                      )}
                      {(proposal.status === "draft" || proposal.status === "sent" || proposal.status === "viewed") && (
                        <DropdownMenuItem onClick={() => onSign(proposal)}>
                          <PenLine className="h-4 w-4 mr-2" />
                          Sign & Convert to Project
                        </DropdownMenuItem>
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
