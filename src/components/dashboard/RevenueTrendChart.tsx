import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRevenueTrend } from "@/hooks/useDashboardData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine, ComposedChart, Line,
} from "recharts";
import { formatCompactCurrency } from "@/lib/utils";
import { InfoTooltip } from "./InfoTooltip";

type Mode = "3" | "6" | "12" | "yoy";

function useCompanyMonthlyGoal() {
  const { profile } = useAuth() as any;
  return useQuery({
    queryKey: ["company-monthly-goal", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data: c } = await supabase
        .from("companies")
        .select("monthly_billing_goal_override")
        .eq("id", profile.company_id)
        .maybeSingle();
      if ((c as any)?.monthly_billing_goal_override) return Number((c as any).monthly_billing_goal_override);
      const { data: pms } = await supabase.rpc("get_company_goals" as any);
      return ((pms as any[]) || [])
        .filter((p: any) => p.is_active && ["pm", "admin", "manager"].includes(p.role))
        .reduce((s: number, p: any) => s + (Number(p.monthly_goal) || 0), 0);

    },
  });
}

function useYoYData() {
  const { profile } = useAuth() as any;
  return useQuery({
    queryKey: ["revenue-yoy", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("total_due, created_at")
        .eq("company_id", profile.company_id);
      const thisYear = new Date().getFullYear();
      const buckets: Record<string, { month: string; current: number; previous: number }> = {};
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      for (let m = 0; m < 12; m++) buckets[m] = { month: monthNames[m], current: 0, previous: 0 };
      (invoices || []).forEach((inv: any) => {
        const d = new Date(inv.created_at);
        const amt = Number(inv.total_due) || 0;
        if (d.getFullYear() === thisYear) buckets[d.getMonth()].current += amt;
        else if (d.getFullYear() === thisYear - 1) buckets[d.getMonth()].previous += amt;
      });
      return Object.values(buckets);
    },
  });
}

interface Props {
  defaultMode?: Mode;
}

export function RevenueTrendChart({ defaultMode = "6" }: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const months = mode === "yoy" ? 12 : parseInt(mode);
  const { data: trend, isLoading } = useRevenueTrend(months);
  const { data: yoy, isLoading: yoyLoading } = useYoYData();
  const { data: monthlyGoal } = useCompanyMonthlyGoal();

  const loading = mode === "yoy" ? yoyLoading : isLoading;

  const hasData = useMemo(() => {
    if (mode === "yoy") return (yoy || []).some((m: any) => m.current > 0 || m.previous > 0);
    return (trend || []).some((m: any) => m.billed > 0);
  }, [mode, trend, yoy]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-1.5">
          Revenue Trend
          <InfoTooltip>
            Monthly <strong>Billed</strong>, <strong>Collected</strong>, and{" "}
            <strong>Outstanding</strong> invoice totals. The dashed <em>Goal</em> line is
            the company's monthly billing goal:{" "}
            <strong>company override</strong> (Settings → Company →
            "Monthly billing goal") if set, otherwise the <strong>sum of monthly
            goals</strong> on all active PM, Admin, and Manager profiles
            (Settings → Team → edit user). Inactive profiles do not contribute.
          </InfoTooltip>
        </CardTitle>
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 Months</SelectItem>
            <SelectItem value="6">6 Months</SelectItem>
            <SelectItem value="12">12 Months</SelectItem>
            <SelectItem value="yoy">Year over Year</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[360px] w-full" />
        ) : !hasData ? (
          <div className="h-[360px] flex items-center justify-center text-muted-foreground text-sm">
            No invoice data yet.
          </div>
        ) : mode === "yoy" ? (
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={yoy} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCompactCurrency} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="previous" fill="hsl(var(--muted-foreground))" opacity={0.5} radius={[4,4,0,0]} name="Last Year" />
              <Bar dataKey="current" fill="hsl(var(--primary))" radius={[4,4,0,0]} name="This Year" />
              {monthlyGoal ? (
                <ReferenceLine y={monthlyGoal} stroke="hsl(var(--accent))" strokeDasharray="4 4"
                  label={{ value: `Goal ${formatCompactCurrency(monthlyGoal)}`, fontSize: 10, fill: "hsl(var(--accent))", position: "insideTopRight" }} />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={trend} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCompactCurrency} />
              <Tooltip formatter={(v: number, n: string) => [`$${v.toLocaleString()}`, n]} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="billed" fill="hsl(var(--primary))" radius={[4,4,0,0]} name="Billed" />
              <Bar dataKey="collected" fill="hsl(var(--accent))" radius={[4,4,0,0]} name="Collected" />
              <Bar dataKey="outstanding" fill="hsl(var(--muted-foreground))" opacity={0.5} radius={[4,4,0,0]} name="Outstanding" />
              {monthlyGoal ? (
                <ReferenceLine y={monthlyGoal} stroke="hsl(var(--accent))" strokeDasharray="4 4"
                  label={{ value: `Goal ${formatCompactCurrency(monthlyGoal)}`, fontSize: 10, fill: "hsl(var(--accent))", position: "insideTopRight" }} />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
