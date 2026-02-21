import React, { Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import { MoreHorizontal, Edit, Trash2, Loader2, Eye, ChevronRight, ChevronDown, User, Pencil } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Client } from "@/hooks/useClients";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { EditContactDialog } from "./EditContactDialog";

function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return value;
}

interface ClientTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onView: (client: Client) => void;
  isDeleting?: boolean;
}

function ContactRows({ clientId }: { clientId: string }) {
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["client-contacts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("*")
        .eq("client_id", clientId)
        .order("is_primary", { ascending: false })
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="bg-muted/20 pl-10">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        </TableCell>
      </TableRow>
    );
  }

  if (contacts.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="bg-muted/20 pl-10 text-xs text-muted-foreground italic">
          No contacts
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {contacts.map((contact) => (
        <TableRow key={contact.id} className="bg-muted/20 hover:bg-muted/30 cursor-pointer" onClick={() => setEditingContact(contact)}>
          <TableCell className="pl-10">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm">{contact.name}</span>
              {contact.is_primary && (
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  Primary
                </span>
              )}
            </div>
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">{contact.title || "—"}</TableCell>
          <TableCell className="text-xs text-muted-foreground">{contact.email || "—"}</TableCell>
          <TableCell className="text-xs text-muted-foreground">{formatPhone(contact.phone) || formatPhone(contact.mobile) || "—"}</TableCell>
          <TableCell className="text-xs text-muted-foreground">{contact.company_name || "—"}</TableCell>
          <TableCell />
          <TableCell className="text-right">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingContact(contact); }}>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </TableCell>
        </TableRow>
      ))}
      {editingContact && (
        <EditContactDialog
          open={!!editingContact}
          onOpenChange={(open) => { if (!open) setEditingContact(null); }}
          contact={editingContact}
        />
      )}
    </>
  );
}

export function ClientTable({
  clients,
  onEdit,
  onDelete,
  onView,
  isDeleting,
}: ClientTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  if (clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No clients found matching your search.
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
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => {
            const isExpanded = expandedIds.has(client.id);
            return (
              <Fragment key={client.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpand(client.id)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(client.id);
                        }}
                        className="p-0.5 rounded hover:bg-accent/50 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      {client.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(client as any).client_type || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatPhone(client.phone) || "—"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {client.address || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.created_at
                      ? format(new Date(client.created_at), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(client)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(client)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(client.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                {isExpanded && <ContactRows clientId={client.id} />}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              company record.
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