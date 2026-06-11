import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBillingPipeline, type PipelineScope } from "@/hooks/useBillingPipeline";
import { useNavigate } from "react-router-dom";
import { formatCompactCurrency } from "@/lib/utils";
import { ArrowUpDown, Search } from "lucide-react";

interface Props {
  scope?: PipelineScope;
  title?: string;
  description?: string;
}

type SortKey = "estimated_bill_date" | "amount" | "pm_name";
type DateBucket = "all" | "this_week" | "next_week" | "this_month" | "overdue";

function dateBucketOf(iso: string | null, now: Date): DateBucket {
  if (!iso) return "all";
  const d = new Date(iso);
  const diff = Math.floor((d.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff <= 7) return "this_week";
  if (diff <= 14) return "next_week";
  if (diff <= 30) return "this_month";
  return "all";
}

export function BillingPipelineTable({ scope = "company", title = "Billing Pipeline", description }: Props) {
  const { data = [], isLoading } = useBillingPipeline(scope);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [pmFilter, setPmFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateBucket>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("estimated_bill_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const now = new Date();
  const pms = useMemo(() => {
    const set = new Map<string, string>();
    data.forEach((r) => r.pm_id && set.set(r.pm_id, r.pm_name || "Unknown"));
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const statuses = useMemo(() => Array.from(new Set(data.map((r) => r.service_status))).sort(), [data]);

  const filtered = useMemo(() => {
    let rows = data;
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.project_number || "").toLowerCase().includes(s) ||
          (r.project_name || "").toLowerCase().includes(s) ||
          (r.client_name || "").toLowerCase().includes(s) ||
          r.service_name.toLowerCase().includes(s)
      );
    }
    if (pmFilter !== "all") rows = rows.filter((r) => r.pm_id === pmFilter);
    if (statusFilter !== "all") rows = rows.filter((r) => r.service_status === statusFilter);
    if (sourceFilter !== "all") rows = rows.filter((r) => (r.bill_date_source || "manual") === sourceFilter);
    if (dateFilter !== "all") rows = rows.filter((r) => dateBucketOf(r.estimated_bill_date, now) === dateFilter);

    rows = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "amount") return (a.amount - b.amount) * dir;
      if (sortKey === "pm_name") return ((a.pm_name || "").localeCompare(b.pm_name || "")) * dir;
      const ad = a.estimated_bill_date ? new Date(a.estimated_bill_date).getTime() : Infinity;
      const bd = b.estimated_bill_date ? new Date(b.estimated_bill_date).getTime() : Infinity;
      return (ad - bd) * dir;
    });
    return rows;
  }, [data, search, pmFilter, statusFilter, dateFilter, sourceFilter, sortKey, sortDir, now]);

  const total = filtered.reduce((s, r) => s + r.amount, 0);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Filters */}
        <div className="grid gap-2 md:grid-cols-6">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search project / client / service"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          {scope === "company" && (
            <Select value={pmFilter} onValueChange={setPmFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="PM" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All PMs</SelectItem>
                {pms.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateBucket)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any bill date</SelectItem>
              <SelectItem value="overdue">Overdue to bill</SelectItem>
              <SelectItem value="this_week">This week</SelectItem>
              <SelectItem value="next_week">Next week</SelectItem>
              <SelectItem value="this_month">This month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any source</SelectItem>
              <SelectItem value="ai">AI predicted</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="project_target">Project target</SelectItem>
              <SelectItem value="project_completion">Project completion</SelectItem>
              <SelectItem value="none">Undated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                {scope === "company" && (
                  <th className="text-left px-3 py-2 cursor-pointer" onClick={() => toggleSort("pm_name")}>
                    <span className="inline-flex items-center gap-1">PM <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                )}
                <th className="text-left px-3 py-2">Project</th>
                <th className="text-left px-3 py-2">Service</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2 cursor-pointer" onClick={() => toggleSort("estimated_bill_date")}>
                  <span className="inline-flex items-center gap-1">Est. Bill <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right px-3 py-2 cursor-pointer" onClick={() => toggleSort("amount")}>
                  <span className="inline-flex items-center gap-1 justify-end">Amount <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-6"><Skeleton className="h-32 w-full" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No upcoming services. Items appear here as soon as a service on an open project has a remaining balance.</td></tr>
              ) : (
                filtered.slice(0, 200).map((r) => {
                  const undated = !r.estimated_bill_date || r.bill_date_source === "none";
                  const overdue = !undated && r.estimated_bill_date && new Date(r.estimated_bill_date) < now;
                  const sourceLabel: Record<string, string> = {
                    ai: "AI",
                    manual: "",
                    project_target: "Project target",
                    project_completion: "Project completion",
                    service: "",
                    none: "",
                  };
                  const srcLabel = sourceLabel[r.bill_date_source] ?? "";
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      {scope === "company" && <td className="px-3 py-2">{r.pm_name}</td>}
                      <td className="px-3 py-2">
                        <button
                          className="text-left hover:underline"
                          onClick={() => navigate(`/projects/${r.project_id}`)}
                        >
                          <div className="font-medium">{r.project_number || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.client_name || r.project_name}</div>
                        </button>
                      </td>
                      <td className="px-3 py-2">{r.service_name}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs">{r.service_status.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        {undated ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Undated</Badge>
                        ) : (
                          <span className={overdue ? "text-red-600 font-medium" : ""}>
                            {new Date(r.estimated_bill_date!).toLocaleDateString()}
                            {r.bill_date_source === "ai" ? (
                              <Badge
                                variant="outline"
                                className="ml-1.5 text-[10px] bg-primary/10 border-primary/30 text-primary"
                                title="Estimated by AI based on historical service cycle times for similar services on this project."
                              >
                                AI
                              </Badge>
                            ) : srcLabel ? (
                              <span className="ml-1 text-[10px] text-muted-foreground" title={`Date inferred from ${srcLabel}`}>
                                {srcLabel}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">${r.amount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => navigate(`/projects/${r.project_id}?tab=services`)}>
                          Open
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-muted/30 border-t font-medium">
                  <td className="px-3 py-2" colSpan={scope === "company" ? 5 : 4}>
                    {filtered.length} services
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCompactCurrency(total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
