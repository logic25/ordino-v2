import { useState, useMemo } from "react";
import { useRfps, useUpdateRfpStatus, useUpdateRfpNotes, type Rfp, type RfpStatus } from "@/hooks/useRfps";
import { RfpStatusBadge } from "./RfpStatusBadge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, ArrowUpDown, Search, StickyNote, Shield, DollarSign, Calendar, AlertTriangle } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";

type SortKey = "due_date" | "status" | "agency" | "title";
type SortDir = "asc" | "desc";

const statusOrder: Record<string, number> = { prospect: 0, drafting: 1, submitted: 2, won: 3, lost: 4 };

function InsuranceBadges({ insurance }: { insurance: Record<string, string> | null }) {
  if (!insurance || Object.keys(insurance).length === 0) return null;
  const labels: Record<string, string> = {
    general_liability: "GL",
    workers_comp: "WC",
    umbrella: "Umb",
    professional_liability: "Prof",
    pollution: "Poll",
    auto: "Auto",
    cyber_liability: "Cyber",
    railroad_protective: "RR",
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
          <AlertTriangle className="h-3 w-3" />
          {Math.abs(daysUntil)}d overdue
        </span>
      ) : daysUntil <= 14 ? (
        <span className="text-yellow-600 dark:text-yellow-400 font-medium text-xs">{daysUntil}d left</span>
      ) : null}
    </div>
  );
}

function NotesCell({ rfp }: { rfp: Rfp }) {
  const updateNotes = useUpdateRfpNotes();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rfp.notes || "");

  const save = () => {
    updateNotes.mutate({ id: rfp.id, notes: draft });
    setEditing(false);
  };

  if (!rfp.notes && !editing) {
    return (
      <Popover open={editing} onOpenChange={setEditing}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">
            <StickyNote className="h-3 w-3 mr-1" /> Add note
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a note..." rows={3} className="text-sm" />
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={save}>Save</Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={editing} onOpenChange={(open) => { setEditing(open); if (open) setDraft(rfp.notes || ""); }}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button className="text-left text-sm max-w-[200px] truncate hover:text-foreground text-muted-foreground cursor-pointer">
                {rfp.notes}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-sm">{rfp.notes}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-72">
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="text-sm" />
        <div className="flex justify-end gap-2 mt-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          <Button size="sm" onClick={save}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RfpTableView() {
  const { data: rfps = [], isLoading } = useRfps();
  const updateStatus = useUpdateRfpStatus();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = rfps.filter((r) =>
      !q || r.title.toLowerCase().includes(q) || (r.rfp_number || "").toLowerCase().includes(q) || (r.agency || "").toLowerCase().includes(q)
    );
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "due_date") {
        cmp = (a.due_date || "9999").localeCompare(b.due_date || "9999");
      } else if (sortKey === "status") {
        cmp = (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
      } else if (sortKey === "agency") {
        cmp = (a.agency || "").localeCompare(b.agency || "");
      } else {
        cmp = a.title.localeCompare(b.title);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [rfps, search, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(field)}>
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search RFPs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortHeader label="Title" field="title" /></TableHead>
              <TableHead>RFP #</TableHead>
              <TableHead><SortHeader label="Agency" field="agency" /></TableHead>
              <TableHead><SortHeader label="Status" field="status" /></TableHead>
              <TableHead><SortHeader label="Due Date" field="due_date" /></TableHead>
              <TableHead>M/WBE</TableHead>
              <TableHead>Insurance</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((rfp) => {
              const insurance = rfp.insurance_requirements as Record<string, string> | null;
              return (
                <TableRow key={rfp.id}>
                  <TableCell className="font-medium max-w-[220px]">
                    <span className="truncate block">{rfp.title}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {rfp.rfp_number || "—"}
                  </TableCell>
                  <TableCell className="text-sm">{rfp.agency || "—"}</TableCell>
                  <TableCell><RfpStatusBadge status={rfp.status} /></TableCell>
                  <TableCell><DueDateCell dueDate={rfp.due_date} /></TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {rfp.mwbe_goal_min || rfp.mwbe_goal_max
                      ? `${rfp.mwbe_goal_min}–${rfp.mwbe_goal_max}%`
                      : "—"}
                  </TableCell>
                  <TableCell><InsuranceBadges insurance={insurance} /></TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {rfp.contract_value ? `$${rfp.contract_value.toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell><NotesCell rfp={rfp} /></TableCell>
                  <TableCell>
                    <Select
                      value={rfp.status}
                      onValueChange={(val) => updateStatus.mutate({ id: rfp.id, status: val as RfpStatus })}
                    >
                      <SelectTrigger className="h-8 w-[120px] text-xs">
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
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No RFPs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
