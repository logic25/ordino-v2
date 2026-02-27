import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isWithinInterval } from "date-fns";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useBillingRequests, type BillingRequestWithRelations } from "@/hooks/useBillingRequests";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

export function BillingSentTable() {
  const { data: requests = [], isLoading } = useBillingRequests();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [currentPage, setCurrentPage] = useState(1);

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Filter requests
  const filteredRequests = useMemo(() => {
    let result = requests;

    if (dateFrom || dateTo) {
      result = result.filter((r) => {
        const d = new Date(r.created_at);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > new Date(dateTo.getTime() + 86400000)) return false;
        return true;
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.projects?.name?.toLowerCase().includes(q) ||
          r.projects?.project_number?.toLowerCase().includes(q) ||
          r.created_by_profile?.first_name?.toLowerCase().includes(q) ||
          r.created_by_profile?.last_name?.toLowerCase().includes(q) ||
          getServiceNames(r).toLowerCase().includes(q)
      );
    }

    return result;
  }, [requests, search, statusFilter, dateFrom, dateTo]);

  // Stats
  const weekRequests = requests.filter((r) => isWithinInterval(new Date(r.created_at), { start: weekStart, end: weekEnd }));
  const monthRequests = requests.filter((r) => isWithinInterval(new Date(r.created_at), { start: monthStart, end: monthEnd }));
  const weekTotal = weekRequests.reduce((s, r) => s + r.total_amount, 0);
  const monthTotal = monthRequests.reduce((s, r) => s + r.total_amount, 0);

  // By user breakdown
  const byUser = useMemo(() => {
    const map: Record<string, { name: string; count: number; total: number }> = {};
    for (const r of monthRequests) {
      const name = r.created_by_profile ? `${r.created_by_profile.first_name || ""} ${r.created_by_profile.last_name || ""}`.trim() : "Unknown";
      const key = r.created_by || "unknown";
      if (!map[key]) map[key] = { name, count: 0, total: 0 };
      map[key].count++;
      map[key].total += r.total_amount;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [monthRequests]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginated = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-4 py-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">${weekTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">{weekRequests.length} billing requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">${monthTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">{monthRequests.length} billing requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">By Team Member (This Month)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {byUser.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
            {byUser.slice(0, 4).map((u) => (
              <div key={u.name} className="flex justify-between text-xs">
                <span>{u.name}</span>
                <span className="tabular-nums font-medium">{u.count} — ${u.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-9 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="invoiced">Invoiced</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "MM/dd") : "Start"} – {dateTo ? format(dateTo, "MM/dd") : "End"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="range" selected={{ from: dateFrom, to: dateTo }} onSelect={(range) => { setDateFrom(range?.from); setDateTo(range?.to); setCurrentPage(1); }} numberOfMonths={2} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Services</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Billed By</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
          ) : paginated.length === 0 ? (
            <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No billing requests found</TableCell></TableRow>
          ) : (
            paginated.map((req) => (
              <TableRow key={req.id}>
                <TableCell className="text-sm tabular-nums">{format(new Date(req.created_at), "MM/dd/yyyy")}</TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{req.projects?.project_number || "—"}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">{req.projects?.name || "—"}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm truncate max-w-[200px]">{getServiceNames(req)}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium text-sm">
                  ${req.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-xs">{getBillingMethod(req)}</TableCell>
                <TableCell className="text-sm">
                  {req.created_by_profile ? `${req.created_by_profile.first_name || ""} ${req.created_by_profile.last_name || ""}`.trim() : "—"}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {req.invoices?.sent_at ? format(new Date(req.invoices.sent_at), "MM/dd/yyyy") : "—"}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {req.invoices?.paid_at ? format(new Date(req.invoices.paid_at), "MM/dd/yyyy") : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={req.status === "invoiced" ? "default" : req.status === "pending" ? "secondary" : "outline"} className="text-[10px]">
                    {req.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredRequests.length)} of {filteredRequests.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-muted-foreground">…</span>}
                  <Button variant={p === currentPage ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p)}>
                    {p}
                  </Button>
                </span>
              ))}
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function getServiceNames(req: BillingRequestWithRelations): string {
  const items = (req.services as any[]) || [];
  return items.map((s) => s.name || s.description || "Service").join(", ");
}

function getBillingMethod(req: BillingRequestWithRelations): string {
  const items = (req.services as any[]) || [];
  if (items.length === 0) return "—";
  const methods = items.map((s) => {
    if (s.billing_method === "percentage") return `${s.billing_value}%`;
    if (s.billing_method === "amount") return `$${s.billing_value}`;
    return "Full";
  });
  return methods.join(", ");
}
