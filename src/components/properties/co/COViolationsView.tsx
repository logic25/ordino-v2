import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";
import type { COViolation } from "./coMockData";
import { STATUS_COLORS, PRIORITY_COLORS } from "./coMockData";

interface COViolationsViewProps {
  violations: COViolation[];
  onUpdateViolation: (violationNum: string, updates: Partial<COViolation>) => void;
}

const VIO_STATUS_FILTERS = ["All", "Active", "In Resolution", "Resolved", "Dismissed"];

export function COViolationsView({ violations, onUpdateViolation }: COViolationsViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editPlanValue, setEditPlanValue] = useState("");

  const filtered = useMemo(() => {
    return violations.filter((v) => {
      if (statusFilter !== "All" && v.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return v.violationNum.toLowerCase().includes(q) || v.type.toLowerCase().includes(q) || v.resolutionPlan.toLowerCase().includes(q);
      }
      return true;
    });
  }, [violations, statusFilter, search]);

  const activeCount = violations.filter(v => v.status === "Active").length;
  const inResCount = violations.filter(v => v.status === "In Resolution").length;
  const totalPenalty = violations.reduce((s, v) => s + (v.penalty || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{violations.length}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-red-600">{activeCount}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">In Resolution</p>
          <p className="text-2xl font-bold text-yellow-600">{inResCount}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total Penalties</p>
          <p className="text-2xl font-bold">{totalPenalty > 0 ? `$${totalPenalty.toLocaleString()}` : "—"}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search violation # or type..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1.5">
          {VIO_STATUS_FILTERS.map((f) => (
            <Button key={f} variant={statusFilter === f ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setStatusFilter(f)}>
              {f}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} violations</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Violation #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Filed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Penalty</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="min-w-[250px]">Resolution Plan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((v) => (
              <TableRow key={v.violationNum}>
                <TableCell className="font-mono text-sm font-medium">{v.violationNum}</TableCell>
                <TableCell className="text-sm">{v.type}</TableCell>
                <TableCell className="text-sm">{format(new Date(v.fileDate), "MM/dd/yyyy")}</TableCell>
                <TableCell><Badge variant="outline" className={STATUS_COLORS[v.status] || ""}>{v.status}</Badge></TableCell>
                <TableCell className="text-sm">{v.penalty ? `$${v.penalty.toLocaleString()}` : "—"}</TableCell>
                <TableCell><Badge variant="outline" className={PRIORITY_COLORS[v.priority]}>{v.priority}</Badge></TableCell>
                <TableCell>
                  {editingPlan === v.violationNum ? (
                    <div className="flex items-start gap-1">
                      <Textarea value={editPlanValue} onChange={(e) => setEditPlanValue(e.target.value)} rows={2} className="text-xs min-w-[200px]" autoFocus />
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-emerald-600" onClick={() => {
                        onUpdateViolation(v.violationNum, { resolutionPlan: editPlanValue });
                        setEditingPlan(null);
                      }}><Check className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditingPlan(null)}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group cursor-pointer" onClick={() => { setEditingPlan(v.violationNum); setEditPlanValue(v.resolutionPlan); }}>
                      <span className="text-xs text-muted-foreground">{v.resolutionPlan || <span className="italic">Click to add plan...</span>}</span>
                      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground shrink-0" />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
