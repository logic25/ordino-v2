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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MoreHorizontal, Trash2, FileText, Loader2, UserPlus, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import type { Lead } from "@/hooks/useLeads";
import { useLeadNotes, useCreateLeadNote } from "@/hooks/useLeadNotes";

interface LeadsTableProps {
  leads: Lead[];
  onDelete: (id: string) => void;
  onConvertToProposal: (lead: Lead) => void;
  onUpdateLead?: (id: string, updates: { status?: string; notes?: string }) => void;
  isDeleting?: boolean;
}

const STATUS_OPTIONS: { value: string; variant: "default" | "secondary" | "outline" | "destructive"; label: string }[] = [
  { value: "new", variant: "default", label: "New" },
  { value: "contacted", variant: "outline", label: "Contacted" },
  { value: "qualified", variant: "default", label: "Qualified" },
  { value: "converted", variant: "secondary", label: "Converted" },
  { value: "lost", variant: "destructive", label: "Lost" },
];

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

export function LeadsTable({ leads, onDelete, onConvertToProposal, onUpdateLead, isDeleting }: LeadsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
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
            <TableHead className="w-[30px]"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => {
            const isExpanded = expandedId === lead.id;
            const statusOption = STATUS_OPTIONS.find(s => s.value === lead.status) || STATUS_OPTIONS[0];
            return (
              <>
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => toggleRow(lead.id)}
                >
                  <TableCell className="pr-0">
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                  </TableCell>
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
                    <Badge variant={statusOption.variant}>{statusOption.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(lead.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
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

                {isExpanded && (
                  <TableRow key={`${lead.id}-detail`}>
                    <TableCell colSpan={10} className="bg-muted/30 p-0">
                      <LeadDetailPanel
                        lead={lead}
                        onUpdateLead={onUpdateLead}
                        onConvertToProposal={onConvertToProposal}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </>
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

// --- Inline detail panel ---

function LeadDetailPanel({
  lead,
  onUpdateLead,
  onConvertToProposal,
}: {
  lead: Lead;
  onUpdateLead?: (id: string, updates: { status?: string; notes?: string }) => void;
  onConvertToProposal: (lead: Lead) => void;
}) {
  const [newNote, setNewNote] = useState("");
  const { data: notes = [], isLoading: notesLoading } = useLeadNotes(lead.id);
  const createNote = useCreateLeadNote();
  const isMock = lead.id.startsWith("mock-");

  const handleStatusChange = (value: string) => {
    onUpdateLead?.(lead.id, { status: value });
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await createNote.mutateAsync({ lead_id: lead.id, content: newNote.trim() });
    setNewNote("");
  };

  return (
    <div className="px-6 py-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={lead.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Assigned To */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Assigned To</label>
          <div className="text-sm py-2">
            {lead.assignee
              ? `${lead.assignee.first_name} ${lead.assignee.last_name}`
              : <span className="text-muted-foreground">Unassigned</span>}
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Contact</label>
          <div className="text-sm space-y-0.5">
            {lead.contact_phone && <div>{lead.contact_phone}</div>}
            {lead.contact_email && <div className="text-muted-foreground">{lead.contact_email}</div>}
            {lead.property_address && <div className="text-muted-foreground">{lead.property_address}</div>}
          </div>
        </div>
      </div>

      {/* Notes section */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-muted-foreground">Notes</label>

        {/* Show legacy notes from leads.notes field if present */}
        {lead.notes && (
          <div className="rounded-md border border-dashed bg-background p-3 text-sm space-y-1">
            <p className="whitespace-pre-wrap">{lead.notes}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="font-medium">
                {lead.creator
                  ? `${lead.creator.first_name} ${lead.creator.last_name}`
                  : "System"}
              </span>
              <span>·</span>
              <span>{format(new Date(lead.created_at), "MMM d, yyyy h:mm a")}</span>
              {lead.assignee && (
                <>
                  <span>·</span>
                  <span>Assigned to <span className="font-medium">{lead.assignee.first_name} {lead.assignee.last_name}</span></span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Notes timeline */}
        {notes.length > 0 && (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {notes.map((note) => (
              <div key={note.id} className="rounded-md border bg-background p-3 text-sm space-y-1">
                <p className="whitespace-pre-wrap">{note.content}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {note.author
                      ? `${note.author.first_name} ${note.author.last_name}`
                      : "Unknown"}
                  </span>
                  <span>·</span>
                  <span title={format(new Date(note.created_at), "MMM d, yyyy h:mm a")}>
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!lead.notes && notes.length === 0 && !isMock && (
          <p className="text-xs text-muted-foreground py-1">No notes yet</p>
        )}

        {/* Add note input */}
        {!isMock && (
          <div className="space-y-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Type a note..."
              rows={2}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!newNote.trim() || createNote.isPending}
              >
                {createNote.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Note
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {lead.status !== "converted" && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onConvertToProposal(lead)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Create Proposal
          </Button>
        </div>
      )}
    </div>
  );
}
