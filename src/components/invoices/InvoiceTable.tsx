import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { MoreHorizontal, Eye, Send, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import type { InvoiceWithRelations } from "@/hooks/useInvoices";

interface InvoiceTableProps {
  invoices: InvoiceWithRelations[];
  isLoading: boolean;
  onViewInvoice: (invoice: InvoiceWithRelations) => void;
  onSendInvoice?: (invoice: InvoiceWithRelations) => void;
  onDeleteInvoice?: (id: string) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function InvoiceTable({
  invoices, isLoading, onViewInvoice, onSendInvoice, onDeleteInvoice,
  selectedIds, onSelectionChange,
}: InvoiceTableProps) {
  const allSelected = invoices.length > 0 && selectedIds.length === invoices.length;

  const toggleAll = () => {
    onSelectionChange(allSelected ? [] : invoices.map((i) => i.id));
  };

  const toggleOne = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading invoices...
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h3 className="text-lg font-medium">No invoices found</h3>
        <p className="text-muted-foreground mt-1">
          Create an invoice or adjust your filters
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          </TableHead>
          <TableHead>Invoice #</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Project</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((inv) => (
          <TableRow
            key={inv.id}
            className="cursor-pointer"
            onClick={() => onViewInvoice(inv)}
          >
            <TableCell onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selectedIds.includes(inv.id)}
                onCheckedChange={() => toggleOne(inv.id)}
              />
            </TableCell>
            <TableCell className="font-mono text-sm font-medium">
              {inv.invoice_number}
            </TableCell>
            <TableCell>{inv.clients?.name || "—"}</TableCell>
            <TableCell className="max-w-[200px] truncate">
              {inv.projects
                ? `${inv.projects.project_number || ""} - ${inv.projects.name || "Untitled"}`
                : "—"}
            </TableCell>
            <TableCell className="text-right font-mono">
              ${Number(inv.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </TableCell>
            <TableCell>
              <InvoiceStatusBadge status={inv.status} />
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {inv.created_at ? format(new Date(inv.created_at), "MM/dd/yy") : "—"}
            </TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onViewInvoice(inv)}>
                    <Eye className="h-4 w-4 mr-2" /> View
                  </DropdownMenuItem>
                  {(inv.status === "draft" || inv.status === "ready_to_send") && onSendInvoice && (
                    <DropdownMenuItem onClick={() => onSendInvoice(inv)}>
                      <Send className="h-4 w-4 mr-2" /> Send
                    </DropdownMenuItem>
                  )}
                  {inv.status === "draft" && onDeleteInvoice && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDeleteInvoice(inv.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
