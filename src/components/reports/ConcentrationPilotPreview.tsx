import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";
import type { ClientHealthRow } from "@/hooks/useClientHealth";

const fmtMoney = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/**
 * Admin-only pilot preview: shows exactly which clients the concentration rule
 * would flag today, before the badge is enabled company-wide.
 */
export default function ConcentrationPilotPreview({ rows }: { rows: ClientHealthRow[] }) {
  const flagged = rows.filter((r) => r.is_concentrated);
  const enabled = rows.some((r) => r.concentration_badge_enabled);
  const missingEav = rows.filter((r) => !r.expected_annual_value).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          Concentration flag — pilot preview
          <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Badge live" : "Badge off"}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Rule: {"\u2264"}2 active projects AND proposed-this-year below 50% of expected annual value. Review this
          list before turning the badge on.
        </p>
      </CardHeader>
      <CardContent>
        {missingEav > 0 && (
          <div className="mb-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            {missingEav} of {rows.length} clients have no expected annual value set, so the rule cannot evaluate them.
            Until that field is populated the flag will stay quiet.
          </div>
        )}
        {flagged.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No clients match the concentration rule right now.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Expected annual</TableHead>
                <TableHead className="text-right">Proposed YTD</TableHead>
                <TableHead className="text-right">Active projects</TableHead>
                <TableHead className="text-right">Days since activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flagged.map((r) => (
                <TableRow key={r.client_id}>
                  <TableCell className="font-medium">{r.client_name}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.expected_annual_value)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.ytd_proposed_value)}</TableCell>
                  <TableCell className="text-right">{r.active_project_count}</TableCell>
                  <TableCell className="text-right">{r.days_since_last_activity ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
