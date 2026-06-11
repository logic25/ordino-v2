import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { useProposalConversionRates } from "@/hooks/useDashboardData";
import { formatCompactCurrency } from "@/lib/utils";

export function ProposalConversionTable() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: rows = [], isLoading } = useProposalConversionRates(year);

  const totals = useMemo(() => {
    const sent = rows.reduce((s, r) => s + r.sent, 0);
    const converted = rows.reduce((s, r) => s + r.converted, 0);
    return {
      sent,
      converted,
      rate: sent > 0 ? converted / sent : 0,
      proposedValue: rows.reduce((s, r) => s + r.proposedValue, 0),
      convertedValue: rows.reduce((s, r) => s + r.convertedValue, 0),
    };
  }, [rows]);

  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Proposal Conversion Rates</CardTitle>
          <CardDescription>
            Monthly sent vs converted (signed/executed/won) · click a row to drill in
          </CardDescription>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="h-8 w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Converted</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Proposed $</TableHead>
                <TableHead className="text-right">Converted $</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const empty = r.sent === 0;
                return (
                  <TableRow
                    key={r.month}
                    className={empty ? "text-muted-foreground" : "cursor-pointer hover:bg-muted/50"}
                    onClick={() => !empty && navigate(`/proposals?month=${r.month}`)}
                  >
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell className="text-right">{r.sent}</TableCell>
                    <TableCell className="text-right">{r.converted}</TableCell>
                    <TableCell className="text-right">
                      {empty ? "—" : `${(r.rate * 100).toFixed(1)}%`}
                    </TableCell>
                    <TableCell className="text-right">{formatCompactCurrency(r.proposedValue)}</TableCell>
                    <TableCell className="text-right">{formatCompactCurrency(r.convertedValue)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-semibold border-t-2">
                <TableCell>Total {year}</TableCell>
                <TableCell className="text-right">{totals.sent}</TableCell>
                <TableCell className="text-right">{totals.converted}</TableCell>
                <TableCell className="text-right">
                  {totals.sent > 0 ? `${(totals.rate * 100).toFixed(1)}%` : "—"}
                </TableCell>
                <TableCell className="text-right">{formatCompactCurrency(totals.proposedValue)}</TableCell>
                <TableCell className="text-right">{formatCompactCurrency(totals.convertedValue)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
