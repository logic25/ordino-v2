import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeFormatDate } from "@/lib/dateUtils";
import { usePortalTrackerRows, STATUS_LABEL, STATUS_TONE, type TrackerStatus, type TrackerRow } from "@/hooks/usePortalTracker";
import { Skeleton } from "@/components/ui/skeleton";

export function PortfolioTracker({ clientOrgId }: { clientOrgId?: string }) {
  const { data: rows = [], isLoading } = usePortalTrackerRows(clientOrgId);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<TrackerStatus | "all">("all");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [r.address, r.project_name, r.tenant, r.app_number, r.contractor, r.sia, r.callout, r.service_name]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [rows, q, statusFilter]);

  const exportCsv = () => {
    const header = ["Signed", "Address", "Project", "Tenant", "App #", "Type", "Work Type", "Contractor", "SIA", "DOB Status", "Last Update", "Callout"];
    const body = filtered.map((r) => [
      r.signed ? "Y" : "",
      r.address ?? "",
      r.project_name ?? "",
      r.tenant ?? "",
      r.app_number ?? "",
      r.filing_type === "paa" ? "PAA" : "New Job",
      (r.disciplines ?? []).join("/"),
      r.contractor ?? "",
      r.sia ?? "",
      STATUS_LABEL[r.status],
      r.status_updated_at ? safeFormatDate(r.status_updated_at, "yyyy-MM-dd") : "",
      (r.callout ?? "").replace(/[\r\n]+/g, " "),
    ]);
    const csv = [header, ...body]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search address, project, app #, contractor…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-52 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_LABEL) as TrackerStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm border rounded-lg bg-white">
          No filings match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
              <tr>
                <Th>Signed</Th>
                <Th>Address</Th>
                <Th>Project</Th>
                <Th>Tenant</Th>
                <Th>App #</Th>
                <Th>Type</Th>
                <Th>Contractor</Th>
                <Th>SIA</Th>
                <Th>DOB Status</Th>
                <Th>Callout</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => <Row key={r.service_id} r={r} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2 whitespace-nowrap">{children}</th>;
}

function Row({ r }: { r: TrackerRow }) {
  const isPaa = r.filing_type === "paa";
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-3 py-2">
        {r.signed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-2 min-w-[180px]">{r.address ?? <span className="text-muted-foreground italic">—</span>}</td>
      <td className="px-3 py-2 min-w-[160px]">
        <div className="truncate max-w-[220px]">{r.project_name ?? "—"}</div>
        {r.project_number && <div className="text-[10px] font-mono text-muted-foreground">{r.project_number}</div>}
      </td>
      <td className="px-3 py-2">{r.tenant ?? <span className="text-slate-300">—</span>}</td>
      <td className="px-3 py-2 font-mono text-xs">
        <div className={cn("flex items-center gap-1", isPaa && "pl-4 text-muted-foreground")}>
          {isPaa && <span className="text-[10px]">↳</span>}
          {r.app_number ?? <span className="italic text-slate-400">not filed</span>}
        </div>
        <div className="text-[10px] text-muted-foreground">{(r.disciplines ?? []).join(" • ")}</div>
      </td>
      <td className="px-3 py-2">
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded ring-1 ring-inset",
          isPaa ? "bg-violet-50 text-violet-700 ring-violet-200" : "bg-slate-50 text-slate-700 ring-slate-200",
        )}>
          {isPaa ? "PAA" : "New Job"}
        </span>
      </td>
      <td className="px-3 py-2">{r.contractor ?? <span className="text-slate-300">—</span>}</td>
      <td className="px-3 py-2">{r.sia ?? <span className="text-slate-300">—</span>}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className={cn("text-[11px] px-2 py-0.5 rounded-full ring-1 ring-inset font-medium", STATUS_TONE[r.status])}>
          {STATUS_LABEL[r.status]}
        </span>
        {r.status_updated_at && (
          <div className="text-[10px] text-muted-foreground mt-0.5">{safeFormatDate(r.status_updated_at, "MMM d")}</div>
        )}
      </td>
      <td className="px-3 py-2 max-w-[240px]">
        {r.callout ? (
          <div className="text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-900 line-clamp-2" title={r.callout}>
            {r.callout}
          </div>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <Link
          to={`/portal/projects/${r.project_id}`}
          className="text-muted-foreground hover:text-foreground"
          title="Open project"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}
