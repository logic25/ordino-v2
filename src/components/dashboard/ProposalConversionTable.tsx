import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useProposalConversionRates, useMonthlyBillingByUser } from "@/hooks/useDashboardData";
import { formatCompactCurrency } from "@/lib/utils";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function ProposalConversionTable() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState<"proposals" | "billing">("proposals");

  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Proposals & Billing</CardTitle>
          <CardDescription>
            Monthly proposal conversion and who billed what
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
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="proposals">Proposal Conversion</TabsTrigger>
            <TabsTrigger value="billing">Billing by User</TabsTrigger>
          </TabsList>
          <TabsContent value="proposals">
            <ProposalsTab year={year} />
          </TabsContent>
          <TabsContent value="billing">
            <BillingTab year={year} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ProposalsTab({ year }: { year: number }) {
  const navigate = useNavigate();
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

  if (isLoading) return <Skeleton className="h-[280px] w-full" />;

  return (
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
  );
}

function BillingTab({ year }: { year: number }) {
  const { data: rows = [], isLoading } = useMonthlyBillingByUser(year);

  const monthTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    rows.forEach((r) => r.months.forEach((v, i) => (totals[i] += v)));
    return totals;
  }, [rows]);
  const grandTotal = monthTotals.reduce((s, v) => s + v, 0);

  if (isLoading) return <Skeleton className="h-[280px] w-full" />;
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-center py-8 text-sm">No invoices in {year}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            {MONTH_LABELS.map((m) => (
              <TableHead key={m} className="text-right">{m}</TableHead>
            ))}
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Invoices</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.userId}>
              <TableCell className="font-medium whitespace-nowrap">{r.name}</TableCell>
              {r.months.map((v, i) => (
                <TableCell key={i} className={`text-right ${v === 0 ? "text-muted-foreground" : ""}`}>
                  {v === 0 ? "—" : formatCompactCurrency(v)}
                </TableCell>
              ))}
              <TableCell className="text-right font-semibold">{formatCompactCurrency(r.total)}</TableCell>
              <TableCell className="text-right">{r.invoiceCount}</TableCell>
            </TableRow>
          ))}
          <TableRow className="font-semibold border-t-2">
            <TableCell>Total {year}</TableCell>
            {monthTotals.map((v, i) => (
              <TableCell key={i} className="text-right">
                {v === 0 ? "—" : formatCompactCurrency(v)}
              </TableCell>
            ))}
            <TableCell className="text-right">{formatCompactCurrency(grandTotal)}</TableCell>
            <TableCell className="text-right">
              {rows.reduce((s, r) => s + r.invoiceCount, 0)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
