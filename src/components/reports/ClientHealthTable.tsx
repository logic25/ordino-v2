import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ClientHealthRow } from "@/hooks/useClientHealth";

type SortKey =
  | "client_name"
  | "ytd_proposed_value"
  | "ytd_conversion_rate"
  | "active_project_count"
  | "days_since_last_activity"
  | "first_proposal_date"
  | "lifetime_billed_value"
  | "payment_reliability_score";

const fmtMoney = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

export default function ClientHealthTable({ rows }: { rows: ClientHealthRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("ytd_proposed_value");
  const [asc, setAsc] = useState(false);

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] as unknown;
    const bv = b[sortKey] as unknown;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === "string" && typeof bv === "string") return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    return asc ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const th = (key: SortKey, label: string, right = false) => (
    <TableHead
      className={`cursor-pointer select-none ${right ? "text-right" : ""}`}
      onClick={() => {
        if (sortKey === key) setAsc(!asc);
        else {
          setSortKey(key);
          setAsc(false);
        }
      }}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === key && (asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </span>
    </TableHead>
  );

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        No clients match these filters yet.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {th("client_name", "Client")}
              {th("ytd_proposed_value", "Proposed YTD", true)}
              {th("ytd_conversion_rate", "Conversion YTD", true)}
              {th("active_project_count", "Active projects", true)}
              {th("days_since_last_activity", "Days since activity", true)}
              {th("first_proposal_date", "First proposal")}
              {th("lifetime_billed_value", "Lifetime billed", true)}
              {th("payment_reliability_score", "Reliability", true)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.client_id}>
                <TableCell>
                  <div className="font-medium">{r.client_name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.is_dormant && (
                      <Badge variant="outline" className="text-xs">
                        Dormant
                      </Badge>
                    )}
                    {r.is_concentrated && r.concentration_badge_enabled && (
                      <Badge variant="outline" className="text-xs">
                        Concentrated
                      </Badge>
                    )}
                    {r.has_incomplete_data && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-xs">
                            Data incomplete
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {r.proposals_missing_sent_at} proposal(s) have no sent date and are excluded from the date
                          and value figures on this row.
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {r.any_owner_inferred && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-xs">
                            Inferred owner
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          At least one proposal has no salesperson set; ownership was inferred from who created it.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {fmtMoney(r.ytd_proposed_value)}
                  <div className="text-[10px] text-muted-foreground">proposed, not billed</div>
                </TableCell>
                <TableCell className="text-right">
                  {r.ytd_conversion_rate === null ? "—" : `${r.ytd_conversion_rate}%`}
                </TableCell>
                <TableCell className="text-right">{r.active_project_count}</TableCell>
                <TableCell className="text-right">{r.days_since_last_activity ?? "—"}</TableCell>
                <TableCell>{fmtDate(r.first_proposal_date)}</TableCell>
                <TableCell className="text-right">{fmtMoney(r.lifetime_billed_value)}</TableCell>
                <TableCell className="text-right">{r.payment_reliability_score ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
