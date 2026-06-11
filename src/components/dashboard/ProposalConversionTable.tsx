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
import {
  useProposalConversionRates,
  useMonthlyBillingByUser,
  useUserBillingGoals,
  useRecentProposalActivity,
} from "@/hooks/useDashboardData";
import { formatCompactCurrency } from "@/lib/utils";
import { InfoTooltip } from "./InfoTooltip";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function ProposalConversionTable() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState<"proposals" | "billing" | "activity">("proposals");

  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-1.5">
            Proposals & Billing
            <InfoTooltip>
              <strong>Conversion</strong> — monthly Sent vs Converted proposals (Sent = sent_at in month; Converted = status reached signed/executed/won).<br />
              <strong>Billing</strong> — invoices per user per month, vs their monthly goal (Settings → Company).<br />
              <strong>Activity</strong> — the 25 most recent proposal events for the selected year.
            </InfoTooltip>
          </CardTitle>
          <CardDescription>
            Monthly proposal conversion, billing by user, and recent activity
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
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="proposals">
            <ProposalsTab year={year} />
          </TabsContent>
          <TabsContent value="billing">
            <BillingTab year={year} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTab year={year} />
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

function goalColor(pct: number) {
  if (pct >= 0.9) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 0.5) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function BillingTab({ year }: { year: number }) {
  const { data: rows = [], isLoading } = useMonthlyBillingByUser(year);
  const { data: goals = {} } = useUserBillingGoals();
  const isCurrentYear = year === new Date().getFullYear();
  const monthsElapsed = isCurrentYear ? new Date().getMonth() + 1 : 12;

  const monthTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    rows.forEach((r) => r.months.forEach((v, i) => (totals[i] += v)));
    return totals;
  }, [rows]);
  const grandTotal = monthTotals.reduce((s, v) => s + v, 0);

  const totalAnnualGoal = useMemo(
    () => rows.reduce((s, r) => s + (goals[r.userId] || 0) * 12, 0),
    [rows, goals]
  );
  const totalGoalToDate = useMemo(
    () => rows.reduce((s, r) => s + (goals[r.userId] || 0) * monthsElapsed, 0),
    [rows, goals, monthsElapsed]
  );

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
            <TableHead className="text-right">Goal/mo</TableHead>
            <TableHead className="text-right">vs Goal YTD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const monthlyGoal = goals[r.userId] || 0;
            const goalToDate = monthlyGoal * monthsElapsed;
            const pct = goalToDate > 0 ? r.total / goalToDate : 0;
            return (
              <TableRow key={r.userId}>
                <TableCell className="font-medium whitespace-nowrap">{r.name}</TableCell>
                {r.months.map((v, i) => (
                  <TableCell key={i} className={`text-right ${v === 0 ? "text-muted-foreground" : ""}`}>
                    {v === 0 ? "—" : formatCompactCurrency(v)}
                  </TableCell>
                ))}
                <TableCell className="text-right font-semibold">{formatCompactCurrency(r.total)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {monthlyGoal > 0 ? formatCompactCurrency(monthlyGoal) : "—"}
                </TableCell>
                <TableCell className={`text-right font-medium ${monthlyGoal > 0 ? goalColor(pct) : "text-muted-foreground"}`}>
                  {monthlyGoal > 0 ? `${Math.round(pct * 100)}%` : "—"}
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="font-semibold border-t-2">
            <TableCell>Total {year}</TableCell>
            {monthTotals.map((v, i) => (
              <TableCell key={i} className="text-right">
                {v === 0 ? "—" : formatCompactCurrency(v)}
              </TableCell>
            ))}
            <TableCell className="text-right">{formatCompactCurrency(grandTotal)}</TableCell>
            <TableCell className="text-right text-muted-foreground">
              {totalAnnualGoal > 0 ? formatCompactCurrency(totalAnnualGoal / 12) : "—"}
            </TableCell>
            <TableCell className={`text-right ${totalGoalToDate > 0 ? goalColor(grandTotal / totalGoalToDate) : "text-muted-foreground"}`}>
              {totalGoalToDate > 0 ? `${Math.round((grandTotal / totalGoalToDate) * 100)}%` : "—"}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

const EVENT_LABELS: Record<string, { label: string; className: string }> = {
  sent: { label: "Sent", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  signed: { label: "Signed", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  executed: { label: "Won", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
};

function ActivityTab({ year }: { year: number }) {
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useRecentProposalActivity(year);

  if (isLoading) return <Skeleton className="h-[280px] w-full" />;
  if (events.length === 0) {
    return <p className="text-muted-foreground text-center py-8 text-sm">No proposal activity in {year}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Event</TableHead>
          <TableHead>Proposal</TableHead>
          <TableHead>Client</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((e, i) => {
          const meta = EVENT_LABELS[e.eventType];
          return (
            <TableRow
              key={`${e.id}-${e.eventType}-${i}`}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => navigate(`/proposals?id=${e.id}`)}
            >
              <TableCell className="text-sm whitespace-nowrap">
                {format(new Date(e.eventDate), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
              </TableCell>
              <TableCell className="font-medium truncate max-w-[280px]">
                {e.title || "(untitled)"}
              </TableCell>
              <TableCell className="text-muted-foreground">{e.clientName || "—"}</TableCell>
              <TableCell className="text-right">{formatCompactCurrency(e.amount)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
