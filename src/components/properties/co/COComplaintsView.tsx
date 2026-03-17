import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";
import { format } from "date-fns";
import type { DOBComplaintRecord } from "@/hooks/useDOBViolations";

interface COComplaintsViewProps {
  complaints: DOBComplaintRecord[];
}

const STATUS_COLORS: Record<string, string> = {
  "CLOSE": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "CLOSED": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "ACTIVE": "bg-red-500/10 text-red-600 border-red-500/20",
  "OPEN": "bg-red-500/10 text-red-600 border-red-500/20",
};

const STATUS_FILTERS = ["All", "Active", "Closed"];

export function COComplaintsView({ complaints }: COComplaintsViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      if (statusFilter === "Active" && (c.status.toUpperCase() === "CLOSE" || c.status.toUpperCase() === "CLOSED")) return false;
      if (statusFilter === "Closed" && c.status.toUpperCase() !== "CLOSE" && c.status.toUpperCase() !== "CLOSED") return false;
      if (search) {
        const q = search.toLowerCase();
        return c.complaintNumber.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [complaints, statusFilter, search]);

  const activeCount = complaints.filter(c => c.status.toUpperCase() !== "CLOSE" && c.status.toUpperCase() !== "CLOSED").length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{complaints.length}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-red-600">{activeCount}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Closed</p>
          <p className="text-2xl font-bold text-emerald-600">{complaints.length - activeCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search complaint # or category..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <Button key={f} variant={statusFilter === f ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setStatusFilter(f)}>
              {f}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} complaints</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Complaint #</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date Entered</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Inspection Date</TableHead>
              <TableHead>Disposition</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No complaints found
                </TableCell>
              </TableRow>
            ) : filtered.map((c, i) => (
              <TableRow key={`${c.complaintNumber}-${i}`}>
                <TableCell className="font-mono text-sm font-medium">{c.complaintNumber}</TableCell>
                <TableCell className="text-sm">{c.category}</TableCell>
                <TableCell className="text-sm">{c.dateEntered ? format(new Date(c.dateEntered), "MM/dd/yyyy") : "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_COLORS[c.status.toUpperCase()] || "bg-muted text-muted-foreground"}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{c.inspectionDate ? format(new Date(c.inspectionDate), "MM/dd/yyyy") : "—"}</TableCell>
                <TableCell className="text-sm">{c.dispositionCode || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
