import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, Search } from "lucide-react";
import { useOpenServicesSummary } from "@/hooks/useOpenServicesSummary";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { formatCompactCurrency } from "@/lib/utils";

type SortKey = "name" | "amount" | "qty" | "avgDays";

export default function OpenServicesReport() {
  const { data = [], isLoading } = useOpenServicesSummary();
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const rows = data.filter((r) => !s || r.name.toLowerCase().includes(s));
    return [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
  }, [data, search, sortKey, sortDir]);

  const total = useMemo(
    () => filtered.reduce(
      (acc, r) => ({
        amount: acc.amount + r.amount,
        qty: acc.qty + r.qty,
        days: acc.days + r.avgDays * r.qty,
      }),
      { amount: 0, qty: 0, days: 0 }
    ),
    [filtered]
  );
  const totalAvgDays = total.qty ? total.days / total.qty : 0;

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-1.5">
          Total Open Services
          <InfoTooltip>
            Open services on open projects, grouped by service name.
            <br /><strong>Amount</strong> = remaining balance (total − billed).
            <br /><strong>Qty</strong> = number of open service rows.
            <br /><strong>Avg Days</strong> = average age since the service was created.
          </InfoTooltip>
        </CardTitle>
        <CardDescription>Aggregated by service across every open project</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search service…" className="pl-8" />
          </div>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          >
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3">
                    <button onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 hover:text-foreground">Open Service <ArrowUpDown className="h-3 w-3" /></button>
                  </th>
                  <th className="py-2 pr-3 text-right">
                    <button onClick={() => toggleSort("amount")} className="inline-flex items-center gap-1 hover:text-foreground">Amount <ArrowUpDown className="h-3 w-3" /></button>
                  </th>
                  <th className="py-2 pr-3 text-right">
                    <button onClick={() => toggleSort("qty")} className="inline-flex items-center gap-1 hover:text-foreground">Qty <ArrowUpDown className="h-3 w-3" /></button>
                  </th>
                  <th className="py-2 pr-3 text-right">
                    <button onClick={() => toggleSort("avgDays")} className="inline-flex items-center gap-1 hover:text-foreground">Avg Days <ArrowUpDown className="h-3 w-3" /></button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No open services match the filter.</td></tr>
                ) : paged.map((r) => (
                  <tr key={r.name} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="py-2 pr-3">{r.name}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatCompactCurrency(r.amount)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.qty}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.avgDays.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="py-2 pr-3">Total</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatCompactCurrency(total.amount)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{total.qty}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{totalAvgDays.toFixed(1)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Page {page} of {pageCount}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page === pageCount} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
