import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ArrowUpDown } from "lucide-react";
import { useServiceLevelReport } from "@/hooks/useServiceLevelReport";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { formatCompactCurrency } from "@/lib/utils";

type SortKey = "name" | "avgDays" | "avgTimelogHrs" | "totalDays" | "qty" | "amount";

export default function ServiceLevelReport() {
  const { data = [], isLoading } = useServiceLevelReport();
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("avgDays");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const s = search.toLowerCase();
    const filtered = data.filter((r) => !s || r.name.toLowerCase().includes(s));
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
  }, [data, search, sortKey, sortDir]);

  const visibleRows = rows.slice(0, pageSize);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
  };

  const SortHead = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <th className={`py-2 pr-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label} <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-1.5">
          Service Level Report
          <InfoTooltip>
            Cycle-time across <strong>completed services</strong> (billed or marked completed).
            <br /><strong>Avg Days</strong> = average days from service creation to completion.
            <br /><strong>Avg Timelog</strong> = average hours logged per service (from time activities).
            <br /><strong>Total Days / Qty / Amount</strong> = sums across all completed services with that name.
          </InfoTooltip>
        </CardTitle>
        <CardDescription>How long each service type takes — and how much time it consumes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search service…" className="pl-8" />
          </div>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            title="Rows shown (select All to remove the limit)"
          >
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} rows</option>)}
            <option value={100000}>Show all ({rows.length})</option>
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No completed services yet. Service Level metrics appear once services reach <em>billed</em> or have a completion date.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <SortHead k="name" label="Service" />
                  <SortHead k="avgDays" label="Avg Days" align="right" />
                  <SortHead k="avgTimelogHrs" label="Avg Timelog" align="right" />
                  <SortHead k="totalDays" label="Total Days" align="right" />
                  <SortHead k="qty" label="Qty" align="right" />
                  <SortHead k="amount" label="Amount" align="right" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.name} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="py-2 pr-3">{r.name}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.avgDays.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.avgTimelogHrs.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.totalDays}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.qty}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatCompactCurrency(r.amount)}</td>
                  </tr>
                ))}
                {rows.length > visibleRows.length && (
                  <tr><td colSpan={6} className="py-2 text-center text-xs text-muted-foreground">
                    Showing {visibleRows.length} of {rows.length}. Increase rows shown or select "Show all".
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
