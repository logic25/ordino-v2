import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { safeFormatDate } from "@/lib/dateUtils";
import { STATUS_LABEL, STATUS_TONE, type TrackerRow } from "@/hooks/usePortalTracker";

export function FilingsTable({ rows }: { rows: TrackerRow[] }) {
  // Group PAAs under their parent by app number matching (or parent_service_id)
  const grouped = useMemo(() => {
    const parents = rows.filter((r) => r.filing_type === "new_job");
    const paasByParent = new Map<string, TrackerRow[]>();
    const orphanPaas: TrackerRow[] = [];
    rows.filter((r) => r.filing_type === "paa").forEach((r) => {
      if (r.parent_service_id) {
        const arr = paasByParent.get(r.parent_service_id) ?? [];
        arr.push(r);
        paasByParent.set(r.parent_service_id, arr);
      } else {
        orphanPaas.push(r);
      }
    });
    return { parents, paasByParent, orphanPaas };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground border rounded-lg bg-white p-6 text-center">
        No filings on this project yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
          <tr>
            <Th>App #</Th>
            <Th>Type</Th>
            <Th>Work Type</Th>
            <Th>Status</Th>
            <Th>Last Update</Th>
            <Th>Callout</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {grouped.parents.map((p) => (
            <>
              <RowLine key={p.service_id} r={p} />
              {(grouped.paasByParent.get(p.service_id) ?? []).map((paa) => (
                <RowLine key={paa.service_id} r={paa} nested />
              ))}
            </>
          ))}
          {grouped.orphanPaas.map((r) => <RowLine key={r.service_id} r={r} />)}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2 whitespace-nowrap">{children}</th>;
}

function RowLine({ r, nested }: { r: TrackerRow; nested?: boolean }) {
  const isPaa = r.filing_type === "paa";
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-3 py-2 font-mono text-xs">
        <div className={cn("flex items-center gap-1.5", nested && "pl-5 text-muted-foreground")}>
          {nested && <span className="text-[10px]">↳</span>}
          {r.app_number ?? <span className="italic text-slate-400">not filed</span>}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[240px]" title={r.service_name}>{r.service_name}</div>
      </td>
      <td className="px-3 py-2">
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded ring-1 ring-inset",
          isPaa ? "bg-violet-50 text-violet-700 ring-violet-200" : "bg-slate-50 text-slate-700 ring-slate-200",
        )}>
          {isPaa ? "PAA" : "New Job"}
        </span>
      </td>
      <td className="px-3 py-2 text-xs">{(r.disciplines ?? []).join(" • ") || <span className="text-slate-300">—</span>}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className={cn("text-[11px] px-2 py-0.5 rounded-full ring-1 ring-inset font-medium", STATUS_TONE[r.status])}>
          {STATUS_LABEL[r.status]}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {r.status_updated_at ? safeFormatDate(r.status_updated_at, "MMM d, yyyy") : "—"}
      </td>
      <td className="px-3 py-2 max-w-[260px]">
        {r.callout ? (
          <div className="text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-900 line-clamp-2" title={r.callout}>
            {r.callout}
          </div>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}
