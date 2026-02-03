import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MoreHorizontal, Pencil, Trash2, Building2, MapPin, ChevronDown, ChevronRight, FolderKanban, FileText } from "lucide-react";
import type { Property } from "@/hooks/useProperties";
import type { ApplicationWithProperty } from "@/hooks/useApplications";

interface PropertyWithApplications extends Property {
  applications?: ApplicationWithProperty[];
}

interface PropertyTableProps {
  properties: PropertyWithApplications[];
  onEdit: (property: Property) => void;
  onDelete: (id: string) => void;
  onCreateProposal: (propertyId: string) => void;
  isDeleting?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  filed: "bg-blue-500/10 text-blue-600",
  under_review: "bg-yellow-500/10 text-yellow-600",
  objection: "bg-red-500/10 text-red-600",
  approved: "bg-green-500/10 text-green-600",
  permit_issued: "bg-emerald-500/10 text-emerald-600",
  inspection: "bg-purple-500/10 text-purple-600",
  complete: "bg-green-600/10 text-green-700",
  closed: "bg-gray-500/10 text-gray-600",
};

export function PropertyTable({
  properties,
  onEdit,
  onDelete,
  onCreateProposal,
  isDeleting,
}: PropertyTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const formatBorough = (borough: string | null) => {
    if (!borough) return null;
    return borough.replace("_", " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatStatus = (status: string | null) => {
    if (!status) return "Draft";
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[280px]">Address</TableHead>
              <TableHead>Borough</TableHead>
              <TableHead>Block / Lot</TableHead>
              <TableHead>BIN</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Building2 className="h-8 w-8" />
                    <p>No properties found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              properties.map((property) => {
                const isExpanded = expandedRows.has(property.id);
                const applicationCount = property.applications?.length || 0;

                return (
                  <Collapsible key={property.id} asChild open={isExpanded}>
                    <>
                      <TableRow className="hover:bg-accent/5">
                        <TableCell className="p-2">
                          {applicationCount > 0 && (
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleExpand(property.id)}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium">{property.address}</p>
                              {property.zip_code && (
                                <p className="text-sm text-muted-foreground">
                                  {property.zip_code}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {property.borough && (
                            <Badge variant="secondary">
                              {formatBorough(property.borough)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {property.block || property.lot ? (
                            <span className="text-sm">
                              {property.block && `Block ${property.block}`}
                              {property.block && property.lot && " / "}
                              {property.lot && `Lot ${property.lot}`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {property.bin || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {property.owner_name || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {applicationCount > 0 ? (
                            <Badge variant="outline" className="gap-1">
                              <FolderKanban className="h-3 w-3" />
                              {applicationCount}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEdit(property)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Property
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onCreateProposal(property.id)}>
                                <FileText className="mr-2 h-4 w-4" />
                                Create Proposal
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteId(property.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {applicationCount > 0 && (
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={8} className="p-0">
                              <div className="px-12 py-3 space-y-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Related Projects
                                </p>
                                <div className="grid gap-2">
                                  {property.applications?.map((app) => (
                                    <div
                                      key={app.id}
                                      className="flex items-center justify-between bg-background rounded-md border px-3 py-2"
                                    >
                                      <div className="flex items-center gap-3">
                                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                          <p className="text-sm font-medium">
                                            {app.application_type || "DOB Application"}
                                            {app.job_number && (
                                              <span className="text-muted-foreground font-normal ml-2">
                                                #{app.job_number}
                                              </span>
                                            )}
                                          </p>
                                          {app.description && (
                                            <p className="text-xs text-muted-foreground truncate max-w-md">
                                              {app.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <Badge className={STATUS_COLORS[app.status || "draft"]}>
                                        {formatStatus(app.status)}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      )}
                    </>
                  </Collapsible>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this property? This action cannot be
              undone and will also delete all associated DOB applications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
