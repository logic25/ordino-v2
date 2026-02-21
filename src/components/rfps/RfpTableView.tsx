import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import { useUpdateRfpStatus, useUpdateRfpNotes, useDeleteRfp, type Rfp, type RfpStatus } from "@/hooks/useRfps";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RfpStatusBadge } from "./RfpStatusBadge";
import { RfpEditDialog } from "./RfpEditDialog";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowUpDown, Search, StickyNote, Shield, Calendar, AlertTriangle, ChevronRight, Pencil, FileText, Trash2 } from "lucide-react";
import { RfpBuilderDialog } from "./RfpBuilderDialog";
import { format, differenceInDays, isPast } from "date-fns";
import type { RfpFilter } from "./RfpSummaryCards";

type SortKey = "due_date" | "status" | "agency" | "title";
type SortDir = "asc" | "desc";

const statusOrder: Record<string, number> = { prospect: 0, drafting: 1, submitted: 2, won: 3, lost: 4 };

interface RfpTableViewProps {
  rfps: Rfp[];
  isLoading: boolean;
  cardFilter: RfpFilter;
}

function InsuranceBadges({ insurance }: { insurance: Record<string, string> | null }) {
  if (!insurance || Object.keys(insurance).length === 0) return <span className="text-muted-foreground text-sm">None</span>;
  const labels: Record<string, string> = {
    general_liability: "GL", workers_comp: "WC", umbrella: "Umb", professional_liability: "Prof",
    pollution: "Poll", auto: "Auto", cyber_liability: "Cyber", railroad_protective: "RR",
  };
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(insurance).map(([key, val]) => (
        <Badge key={key} variant="outline" className="text-[10px] px-1.5 py-0 whitespace-nowrap">
          {labels[key] || key} {val}
        </Badge>
      ))}
    </div>
  );
}

function DueDateCell({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return <span className="text-muted-foreground">—</span>;
  const date = new Date(dueDate);
  const daysUntil = differenceInDays(date, new Date());
  const overdue = isPast(date);
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{format(date, "MMM d, yyyy")}</span>
      {overdue ? (
        <span className="text-destructive font-medium text-xs flex items-center gap-0.5">
          <AlertTriangle className="h-3 w-3" />{Math.abs(daysUntil)}d overdue
        </span>
      ) : daysUntil <= 14 ? (
        <span className="text-yellow-600 dark:text-yellow-400 font-medium text-xs">{daysUntil}d left</span>
      ) : null}
    </div>
  );
}

function InlineNotes({ rfp }: { rfp: Rfp }) {
  const updateNotes = useUpdateRfpNotes();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rfp.notes || "");

  const save = () => {
    updateNotes.mutate({ id: rfp.id, notes: draft });
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        <StickyNote className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
        <button
          onClick={(e) => { e.stopPropagation(); setDraft(rfp.notes || ""); setEditing(true); }}
          className="text-sm text-left text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {rfp.notes || "Add a note..."}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} className="text-sm" autoFocus />
      <div className="flex gap-2">
        <Button size="sm" onClick={save}>Save</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function ExpandedRow({ rfp, onEdit, onBuild, onDelete }: { rfp: Rfp; onEdit: (rfp: Rfp) => void; onBuild: (rfp: Rfp) => void; onDelete: (rfp: Rfp) => void }) {
  const updateStatus = useUpdateRfpStatus();
  const insurance = rfp.insurance_requirements as Record<string, string> | null;

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/40">
      <TableCell colSpan={7} className="py-4 px-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Insurance</div>
              <InsuranceBadges insurance={insurance} />
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">M/WBE Goal</div>
              <p className="text-sm">
                {rfp.mwbe_goal_min || rfp.mwbe_goal_max ? `${rfp.mwbe_goal_min}–${rfp.mwbe_goal_max}%` : "—"}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</div>
              <Select
                value={rfp.status}
                onValueChange={(val) => updateStatus.mutate({ id: rfp.id, status: val as RfpStatus })}
              >
                <SelectTrigger className="h-8 w-[140px] text-xs" onClick={(e) => e.stopPropagation()}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="drafting">Drafting</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Submitted</div>
              <p className="text-sm">
                {rfp.submitted_at ? format(new Date(rfp.submitted_at), "MMM d, yyyy") : "—"}
                {(rfp as any).submission_method && (
                  <span className="text-muted-foreground ml-1">via {(rfp as any).submission_method}</span>
                )}
              </p>
            </div>
            <div className="md:col-span-4 space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</div>
              <InlineNotes rfp={rfp} />
            </div>
          </div>
          <div className="flex gap-2 border-t pt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); onEdit(rfp); }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit RFP
            </Button>
            <Button
              size="sm"
              onClick={(e) => { e.stopPropagation(); onBuild(rfp); }}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Build Response
            </Button>
            <div className="ml-auto">
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => { e.stopPropagation(); onDelete(rfp); }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
              </Button>
            </div>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

const activeStatuses = ["prospect", "drafting", "submitted"];

export function RfpTableView({ rfps, isLoading, cardFilter }: RfpTableViewProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingRfp, setEditingRfp] = useState<Rfp | null>(null);
  const [buildingRfp, setBuildingRfp] = useState<Rfp | null>(null);
  const [deletingRfp, setDeletingRfp] = useState<Rfp | null>(null);
  const deleteRfp = useDeleteRfp();
  const { toast } = useToast();

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = rfps.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q) && !(r.rfp_number || "").toLowerCase().includes(q) && !(r.agency || "").toLowerCase().includes(q)) return false;
      if (cardFilter === "active") return activeStatuses.includes(r.status);
      if (cardFilter === "won") return r.status === "won";
      if (cardFilter === "lost") return r.status === "lost";
      return true;
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "due_date") cmp = (a.due_date || "9999").localeCompare(b.due_date || "9999");
      else if (sortKey === "status") cmp = (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
      else if (sortKey === "agency") cmp = (a.agency || "").localeCompare(b.agency || "");
      else cmp = a.title.localeCompare(b.title);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [rfps, search, sortKey, sortDir, cardFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(field)}>
      {label}<ArrowUpDown className="h-3 w-3" />
    </button>
  );

  const filterLabel = cardFilter === "active" ? "active" : cardFilter === "won" ? "won" : cardFilter === "lost" ? "lost" : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search RFPs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {filterLabel && (
          <Badge variant="secondary" className="text-xs">
            Showing: {filterLabel}
          </Badge>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead><SortHeader label="Title" field="title" /></TableHead>
              <TableHead>RFP #</TableHead>
              <TableHead><SortHeader label="Agency" field="agency" /></TableHead>
              <TableHead><SortHeader label="Status" field="status" /></TableHead>
              <TableHead><SortHeader label="Due Date" field="due_date" /></TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((rfp) => {
              const isExpanded = expandedIds.has(rfp.id);
              return (
                <>
                  <TableRow
                    key={rfp.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(rfp.id)}
                  >
                    <TableCell className="w-8 px-2">
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </TableCell>
                    <TableCell className="font-medium max-w-[220px]">
                      <span className="truncate block">{rfp.title}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {rfp.rfp_number || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{rfp.agency || "—"}</TableCell>
                    <TableCell><RfpStatusBadge status={rfp.status} /></TableCell>
                    <TableCell><DueDateCell dueDate={rfp.due_date} /></TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {rfp.contract_value ? formatCurrency(rfp.contract_value) : "—"}
                    </TableCell>
                  </TableRow>
                  {isExpanded && <ExpandedRow key={`${rfp.id}-detail`} rfp={rfp} onEdit={setEditingRfp} onBuild={setBuildingRfp} onDelete={setDeletingRfp} />}
                </>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No RFPs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <RfpEditDialog rfp={editingRfp} open={!!editingRfp} onOpenChange={(open) => !open && setEditingRfp(null)} />
      <RfpBuilderDialog rfp={buildingRfp} open={!!buildingRfp} onOpenChange={(open) => !open && setBuildingRfp(null)} />

      <AlertDialog open={!!deletingRfp} onOpenChange={() => setDeletingRfp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete RFP?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingRfp?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingRfp) {
                  deleteRfp.mutate(deletingRfp.id, {
                    onSuccess: () => toast({ title: "RFP deleted" }),
                    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
                  });
                }
                setDeletingRfp(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
