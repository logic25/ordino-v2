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
import { MoreHorizontal, Trash2, FileText, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import type { Lead } from "@/hooks/useLeads";

interface LeadsTableProps {
  leads: Lead[];
  onDelete: (id: string) => void;
  onConvertToProposal: (lead: Lead) => void;
  isDeleting?: boolean;
}

const STATUS_STYLES: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
  new: { variant: "default", label: "New" },
  contacted: { variant: "outline", label: "Contacted" },
  qualified: { variant: "default", label: "Qualified" },
  converted: { variant: "secondary", label: "Converted" },
  lost: { variant: "destructive", label: "Lost" },
};

const SOURCE_LABELS: Record<string, string> = {
  phone_call: "Phone",
  email: "Email",
  website_form: "Website",
};

const CLIENT_TYPE_LABELS: Record<string, string> = {
  homeowner: "Homeowner",
  property_manager: "Property Manager",
  contractor: "Contractor",
  architect: "Architect",
  developer: "Developer",
  management_company: "Mgmt Company",
  government: "Government",
  other: "Other",
};

export function LeadsTable({ leads, onDelete, onConvertToProposal, isDeleting }: LeadsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <UserPlus className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">No leads yet</h3>
        <p className="text-muted-foreground mt-1">
          Capture your first lead using the button above
        </p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const statusStyle = STATUS_STYLES[lead.status] || STATUS_STYLES.new;
            return (
              <TableRow key={lead.id}>
                <TableCell className="font-medium">{lead.full_name}</TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {CLIENT_TYPE_LABELS[lead.client_type || ""] || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  {lead.contact_phone && (
                    <div className="text-sm">{lead.contact_phone}</div>
                  )}
                  {lead.contact_email && (
                    <div className="text-xs text-muted-foreground">{lead.contact_email}</div>
                  )}
                  {!lead.contact_phone && !lead.contact_email && "—"}
                </TableCell>
                <TableCell>
                  <div className="max-w-[200px] truncate text-sm">
                    {lead.property_address || "—"}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{lead.subject || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {SOURCE_LABELS[lead.source] || lead.source}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusStyle.variant}>{statusStyle.label}</Badge>
                </TableCell>
                <TableCell className="text-sm text-primary">
                  {lead.assignee
                    ? `${lead.assignee.first_name} ${lead.assignee.last_name}`
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(lead.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {lead.status !== "converted" && (
                        <DropdownMenuItem onClick={() => onConvertToProposal(lead)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Create Proposal
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(lead.id)}
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
            <AlertDialogTitle>Delete Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
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
