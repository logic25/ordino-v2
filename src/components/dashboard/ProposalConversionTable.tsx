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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  useProposalConversionRates,
  useMonthlyBillingByUser,
  useUserMonthlyGoals,
  useUserBacklog,
} from "@/hooks/useDashboardData";
import { formatCompactCurrency } from "@/lib/utils";
import { InfoTooltip } from "./InfoTooltip";

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
          <CardTitle className="text-base flex items-center gap-1.5">
            Proposals & Billing
            <InfoTooltip>
              <strong>Conversion</strong> — monthly Sent vs Converted proposals (Sent = sent_at in month; Converted = status reached signed/executed/won).<br />
              <strong>Billing</strong> — amounts sent to billing (billing requests) grouped by who sent them, fee work only. Reimbursables (filing fees, pass-throughs) are shown separately and never count toward goals. Goal-holders are always shown; anyone who sent something to billing also appears. Click a goal cell to set a per-month override (admin only).
            </InfoTooltip>
          </CardTitle>
          <CardDescription>
            Monthly proposal conversion and send-to-billing by user
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

function goalColor(pct: number) {
  if (pct >= 0.9) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 0.5) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function BillingTab({ year }: { year: number }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { data: rows = [], isLoading } = useMonthlyBillingByUser(year);
  const { data: overrides = {} } = useUserMonthlyGoals(year);
  const { data: backlog = {} } = useUserBacklog();
  const [showAll, setShowAll] = useState(false);

  const currentYear = new Date().getFullYear();
  const isCurrentYear = year === currentYear;
  const currentMonthIdx = new Date().getMonth();
  const monthsElapsed = isCurrentYear ? currentMonthIdx + 1 : 12;

  const goalFor = (userId: string, defaultGoal: number, monthIdx: number) => {
    const override = overrides[`${userId}:${monthIdx + 1}`];
    return override !== undefined ? override : defaultGoal;
  };

  const visibleRows = useMemo(() => {
    if (showAll) return rows;
    return rows.filter((r) => r.hasGoal || r.total > 0 || r.reimbursableTotal > 0);
  }, [rows, showAll]);

  const monthTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    visibleRows.forEach((r) => r.fee.forEach((v, i) => (totals[i] += v)));
    return totals;
  }, [visibleRows]);
  const grandTotal = monthTotals.reduce((s, v) => s + v, 0);
  const totalBacklog = useMemo(
    () => visibleRows.reduce((s, r) => s + (backlog[r.userId] || 0), 0),
    [visibleRows, backlog]
  );

  const totalGoalToDate = useMemo(() => {
    let sum = 0;
    visibleRows.forEach((r) => {
      if (!r.hasGoal) return;
      for (let m = 0; m < monthsElapsed; m++) {
        sum += goalFor(r.userId, r.monthlyGoal, m);
      }
    });
    return sum;
  }, [visibleRows, overrides, monthsElapsed]);

  if (isLoading) return <Skeleton className="h-[280px] w-full" />;
  if (visibleRows.length === 0) {
    return (
      <div className="space-y-3">
        <ShowAllToggle showAll={showAll} setShowAll={setShowAll} />
        <p className="text-muted-foreground text-center py-8 text-sm">
          No goal-holders or billing activity in {year}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ShowAllToggle showAll={showAll} setShowAll={setShowAll} />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              {MONTH_LABELS.map((m) => (
                <TableHead key={m} className="text-right">{m}</TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-1">
                  Backlog
                  <InfoTooltip>
                    Signed work assigned to this PM that hasn't been sent to billing yet. Goals are flat — backlog is context, not a target.
                  </InfoTooltip>
                </span>
              </TableHead>
              <TableHead className="text-right">vs Goal YTD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((r) => {
              let userGoalToDate = 0;
              if (r.hasGoal) {
                for (let m = 0; m < monthsElapsed; m++) {
                  userGoalToDate += goalFor(r.userId, r.monthlyGoal, m);
                }
              }
              const pct = userGoalToDate > 0 ? r.total / userGoalToDate : 0;
              return (
                <TableRow key={r.userId}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {r.name}
                    {!r.hasGoal && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        no goal
                      </span>
                    )}
                  </TableCell>
                  {r.fee.map((feeAmt, i) => {
                    const reimbAmt = r.reimbursable[i];
                    const goal = goalFor(r.userId, r.monthlyGoal, i);
                    const isFuture = isCurrentYear && i > currentMonthIdx;
                    const cellPct = goal > 0 ? feeAmt / goal : 0;
                    return (
                      <TableCell key={i} className="text-right align-top py-2">
                        <div className={feeAmt === 0 ? "text-muted-foreground" : ""}>
                          {feeAmt === 0 ? "—" : formatCompactCurrency(feeAmt)}
                        </div>
                        {r.hasGoal && (
                          <>
                            <GoalSubCell
                              userId={r.userId}
                              year={year}
                              month={i + 1}
                              defaultGoal={r.monthlyGoal}
                              currentValue={goal}
                              isOverridden={overrides[`${r.userId}:${i + 1}`] !== undefined}
                              colorClass={isFuture || feeAmt === 0 ? "text-muted-foreground" : goalColor(cellPct)}
                              isAdmin={isAdmin}
                            />
                            {goal > 0 && !isFuture && feeAmt > 0 && (
                              <div className={`text-[10px] font-medium ${goalColor(cellPct)}`}>
                                {Math.round(cellPct * 100)}%
                              </div>
                            )}
                          </>
                        )}
                        {reimbAmt > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            +{formatCompactCurrency(reimbAmt)} reimb
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-semibold align-top py-2">
                    {formatCompactCurrency(r.total)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground align-top py-2">
                    {backlog[r.userId] ? formatCompactCurrency(backlog[r.userId]) : "—"}
                  </TableCell>
                  <TableCell className={`text-right font-medium align-top py-2 ${r.hasGoal ? goalColor(pct) : "text-muted-foreground"}`}>
                    {r.hasGoal ? `${Math.round(pct * 100)}%` : "—"}
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
                {totalBacklog > 0 ? formatCompactCurrency(totalBacklog) : "—"}
              </TableCell>
              <TableCell className={`text-right ${totalGoalToDate > 0 ? goalColor(grandTotal / totalGoalToDate) : "text-muted-foreground"}`}>
                {totalGoalToDate > 0 ? `${Math.round((grandTotal / totalGoalToDate) * 100)}%` : "—"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ShowAllToggle({ showAll, setShowAll }: { showAll: boolean; setShowAll: (b: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch id="show-all-billers" checked={showAll} onCheckedChange={setShowAll} />
      <Label htmlFor="show-all-billers" className="text-xs text-muted-foreground cursor-pointer">
        Show all users (default: goal-holders + anyone who sent to billing)
      </Label>
    </div>
  );
}

function GoalSubCell({
  userId, year, month, defaultGoal, currentValue, isOverridden, colorClass, isAdmin,
}: {
  userId: string;
  year: number;
  month: number;
  defaultGoal: number;
  currentValue: number;
  isOverridden: boolean;
  colorClass: string;
  isAdmin: boolean;
}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<string>(String(currentValue || ""));

  const mutation = useMutation({
    mutationFn: async (newGoal: number | null) => {
      const companyId = profile?.company_id;
      if (!companyId) throw new Error("No company");
      if (newGoal === null) {
        const { error } = await (supabase as any)
          .from("user_monthly_goals")
          .delete()
          .eq("company_id", companyId)
          .eq("user_id", userId)
          .eq("year", year)
          .eq("month", month);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("user_monthly_goals")
          .upsert(
            { company_id: companyId, user_id: userId, year, month, goal_amount: newGoal },
            { onConflict: "user_id,year,month" }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-monthly-goals", profile?.company_id, year] });
      toast({ title: "Goal updated" });
      setOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const sub = (
    <div className={`text-[11px] ${colorClass}`}>
      / {formatCompactCurrency(currentValue)}
      {isOverridden && <span className="ml-0.5">*</span>}
    </div>
  );

  if (!isAdmin) return sub;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setInput(String(currentValue || "")); }}>
      <PopoverTrigger asChild>
        <button type="button" className="hover:underline focus:outline-none">
          {sub}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2" align="end">
        <div className="text-xs text-muted-foreground">
          Override for {MONTH_LABELS[month - 1]} {year}. Default: {formatCompactCurrency(defaultGoal)}
        </div>
        <Input
          type="number"
          min={0}
          step="100"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={String(defaultGoal)}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(Number(input) || 0)}
          >
            Save
          </Button>
          {isOverridden && (
            <Button
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(null)}
            >
              Reset
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
