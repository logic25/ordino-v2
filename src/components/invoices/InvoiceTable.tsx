import { useState, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { MoreHorizontal, Eye, Send, Trash2, ChevronRight, ChevronDown, Mail, MailOpen, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
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

interface ClientGroup {
  clientId: string | null;
  clientName: string;
  invoices: InvoiceWithRelations[];
  totalDue: number;
  projects: ProjectGroup[];
}

interface ProjectGroup {
  projectId: string | null;
  projectLabel: string;
  invoices: InvoiceWithRelations[];
  totalDue: number;
}

export function InvoiceTable({
  invoices, isLoading, onViewInvoice, onSendInvoice, onDeleteInvoice,
  selectedIds, onSelectionChange,
}: InvoiceTableProps) {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

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

  const toggleClient = (key: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleProject = (key: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Group invoices: Client → Project → Invoices
  const clientGroups = useMemo((): ClientGroup[] => {
    const clientMap = new Map<string, ClientGroup>();

    invoices.forEach((inv) => {
      const clientKey = inv.client_id || "__no_client__";
      const clientName = inv.clients?.name || "No Client";

      if (!clientMap.has(clientKey)) {
        clientMap.set(clientKey, {
          clientId: inv.client_id,
          clientName,
          invoices: [],
          totalDue: 0,
          projects: [],
        });
      }

      const group = clientMap.get(clientKey)!;
      group.invoices.push(inv);
      group.totalDue += Number(inv.total_due) || 0;
    });

    // Sub-group by project within each client
    clientMap.forEach((group) => {
      const projectMap = new Map<string, ProjectGroup>();

      group.invoices.forEach((inv) => {
        const projKey = inv.project_id || "__no_project__";
        const projLabel = inv.projects
          ? `${inv.projects.project_number || ""} - ${inv.projects.name || "Untitled"}`
          : "No Project";

        if (!projectMap.has(projKey)) {
          projectMap.set(projKey, {
            projectId: inv.project_id,
            projectLabel: projLabel,
            invoices: [],
            totalDue: 0,
          });
        }

        const pGroup = projectMap.get(projKey)!;
        pGroup.invoices.push(inv);
        pGroup.totalDue += Number(inv.total_due) || 0;
      });

      group.projects = Array.from(projectMap.values());
    });

    return Array.from(clientMap.values()).sort((a, b) => b.totalDue - a.totalDue);
  }, [invoices]);

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

  const getDeliveryIcon = (inv: InvoiceWithRelations) => {
    if (inv.status === "paid") return <MailOpen className="h-3.5 w-3.5 text-success" />;
    if (inv.sent_at) return <Mail className="h-3.5 w-3.5 text-primary" />;
    return null;
  };

  const allClientKeys = clientGroups.map((g) => g.clientId || "__no_client__");
  const allProjectKeys = clientGroups.flatMap((g) =>
    g.projects.map((p) => `${g.clientId || "__no_client__"}__${p.projectId || "__no_project__"}`)
  );
  const allExpanded = expandedClients.size === allClientKeys.length && expandedProjects.size === allProjectKeys.length;

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedClients(new Set());
      setExpandedProjects(new Set());
    } else {
      setExpandedClients(new Set(allClientKeys));
      setExpandedProjects(new Set(allProjectKeys));
    }
  };

  return (
    <div>
      <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          </TableHead>
          <TableHead className="w-8"></TableHead>
          <TableHead>Client / Project / Invoice</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Delivery</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="w-10 text-right">
            <Button variant="ghost" size="icon" onClick={toggleExpandAll} className="h-7 w-7 text-muted-foreground" title={allExpanded ? "Collapse all" : "Expand all"}>
              {allExpanded ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
            </Button>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clientGroups.map((clientGroup) => {
          const clientKey = clientGroup.clientId || "__no_client__";
          const clientExpanded = expandedClients.has(clientKey);

          return (
            <>
              {/* Client row */}
              <TableRow
                key={`client-${clientKey}`}
                className="bg-muted/30 hover:bg-muted/50 cursor-pointer font-medium"
                onClick={() => toggleClient(clientKey)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={clientGroup.invoices.every((i) => selectedIds.includes(i.id))}
                    onCheckedChange={() => {
                      const ids = clientGroup.invoices.map((i) => i.id);
                      const allChecked = ids.every((id) => selectedIds.includes(id));
                      onSelectionChange(
                        allChecked
                          ? selectedIds.filter((id) => !ids.includes(id))
                          : [...new Set([...selectedIds, ...ids])]
                      );
                    }}
                  />
                </TableCell>
                <TableCell>
                  {clientExpanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </TableCell>
                <TableCell colSpan={1}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" data-clarity-mask="true">{clientGroup.clientName}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {clientGroup.invoices.length} invoice{clientGroup.invoices.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums font-bold">
                  <span data-clarity-mask="true">${clientGroup.totalDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
              </TableRow>

              {/* Project rows */}
              {clientExpanded && clientGroup.projects.map((projGroup) => {
                const projKey = `${clientKey}__${projGroup.projectId || "__no_project__"}`;
                const projExpanded = expandedProjects.has(projKey);

                return (
                  <>
                    <TableRow
                      key={`proj-${projKey}`}
                      className="bg-muted/10 hover:bg-muted/20 cursor-pointer"
                      onClick={() => toggleProject(projKey)}
                    >
                      <TableCell></TableCell>
                      <TableCell className="pl-6">
                        {projExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 pl-2">
                          <span className="text-sm font-medium">{projGroup.projectLabel}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {projGroup.invoices.length}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        <span data-clarity-mask="true">${projGroup.totalDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>

                    {/* Invoice rows */}
                    {projExpanded && projGroup.invoices.map((inv) => (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => onViewInvoice(inv)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(inv.id)}
                            onCheckedChange={() => toggleOne(inv.id)}
                          />
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell>
                          <div className="pl-6">
                            <span className="text-sm font-medium">
                              {inv.invoice_number}
                            </span>
                            {inv.billed_to_contact?.name && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                → <span data-clarity-mask="true">{inv.billed_to_contact.name}</span>
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          <span data-clarity-mask="true">${Number(inv.total_due).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        </TableCell>
                        <TableCell>
                          <InvoiceStatusBadge status={inv.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {getDeliveryIcon(inv)}
                            {inv.sent_at && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(inv.sent_at), "M/d")}
                              </span>
                            )}
                          </div>
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
                            <DropdownMenuContent align="end" className="bg-popover border shadow-md z-50">
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
                  </>
                );
              })}
            </>
          );
        })}
      </TableBody>
    </Table>
    </div>
  );
}
