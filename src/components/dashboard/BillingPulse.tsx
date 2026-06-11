import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBillingPulse, type BillingPulseScope } from "@/hooks/useBillingPulse";
import { formatCompactCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Inbox, Calendar } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, Tooltip } from "recharts";
import { useNavigate } from "react-router-dom";
import { InfoTooltip } from "./InfoTooltip";

interface Props {
  scope?: BillingPulseScope;
  title?: string;
  compact?: boolean;
}

function paceMeta(pct: number) {
  if (pct >= 100) return { label: "On pace", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", Icon: TrendingUp };
  if (pct >= 80) return { label: "Slightly behind", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", Icon: Minus };
  return { label: "Behind", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30", Icon: TrendingDown };
}

export function BillingPulse({ scope = "company", title, compact = false }: Props) {
  const { data, isLoading } = useBillingPulse(scope);
  const navigate = useNavigate();

  const heading =
    title ??
    (scope === "company"
      ? "Company Billing Pulse"
      : scope === "self-pm"
      ? "My Billing Pulse"
      : "My Billing Pulse");

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const week = paceMeta(data.weekPacePct);
  const month = paceMeta(data.monthPacePct);

  const hasGoals = data.weekGoal > 0 || data.monthGoal > 0;

  const scopeSubtitle =
    scope === "company"
      ? "Scope: every billing request company-wide"
      : scope === "self-biller"
      ? "Scope: invoices/requests you created"
      : "Scope: services on projects you manage";

  const scopeTooltip =
    scope === "company"
      ? <>Pace is measured against the <strong>company monthly goal</strong> (override in Settings → Company, otherwise sum of every active PM/Admin/Manager's individual monthly goal).</>
      : scope === "self-biller"
      ? <>Counts billing requests <strong>you created</strong>. Goal = your personal <em>monthly_goal</em> (Settings → Team → edit user).</>
      : <>Counts services on <strong>projects you manage</strong>. Goal = your personal <em>monthly_goal</em> (Settings → Team → edit user).</>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2 gap-2">
        <div className="min-w-0">
          <CardTitle className="text-base flex items-center gap-1.5">
            {heading}
            <InfoTooltip>
              Tracks billing pace against this week's and this month's goal.
              <br /><strong>This Week / This Month</strong> = billing requests created in that
              window (excluding cancelled). <strong>Pace %</strong> compares actual
              vs expected at this point in the period. <strong>Projected</strong> extrapolates
              current pace to month-end. <strong>Ready to invoice</strong> counts services
              flagged ready that have no open billing request.
              <br /><br />{scopeTooltip}
            </InfoTooltip>
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-0.5">{scopeSubtitle}</p>
        </div>
        {!hasGoals && (
          <span className="text-xs text-muted-foreground shrink-0">
            No goal set ·{" "}
            <button onClick={() => navigate("/settings?section=team")} className="underline">
              configure
            </button>
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`grid gap-4 ${compact ? "grid-cols-1" : "md:grid-cols-2"}`}>
          {/* Week */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This Week</p>
              {data.weekGoal > 0 && (
                <Badge variant="outline" className={week.className}>
                  <week.Icon className="h-3 w-3 mr-1" />
                  {data.weekPacePct}%
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {formatCompactCurrency(data.weekBilled)}
              {data.weekGoal > 0 && (
                <span className="text-sm font-normal text-muted-foreground"> / {formatCompactCurrency(data.weekGoal)}</span>
              )}
            </p>
            {data.weekGoal > 0 && <p className="text-xs text-muted-foreground mt-1">{week.label}</p>}
          </div>

          {/* Month */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This Month</p>
              {data.monthGoal > 0 && (
                <Badge variant="outline" className={month.className}>
                  <month.Icon className="h-3 w-3 mr-1" />
                  {data.monthPacePct}%
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {formatCompactCurrency(data.monthBilled)}
              {data.monthGoal > 0 && (
                <span className="text-sm font-normal text-muted-foreground"> / {formatCompactCurrency(data.monthGoal)}</span>
              )}
            </p>
            {data.monthGoal > 0 ? (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                {data.daysLeftInMonth}d left · projected {formatCompactCurrency(data.projectedMonthEnd)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">No monthly goal set</p>
            )}
          </div>
        </div>

        {/* Inbox (biller / company) */}
        {data.inboxCount !== undefined && (
          <button
            onClick={() => navigate("/invoices?tab=to_invoice")}
            className="w-full rounded-lg border bg-muted/30 p-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {data.inboxCount} ready to invoice · {formatCompactCurrency(data.inboxAmount || 0)}
                </p>
                {(data.inboxOldestDays || 0) > 0 && (
                  <p className="text-xs text-muted-foreground">Oldest waiting {data.inboxOldestDays}d</p>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">Open →</span>
          </button>
        )}

        {/* Sparkline */}
        {!compact && data.sparkline.length > 0 && (
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sparkline}>
                <Tooltip
                  formatter={(v: number) => [`$${v.toLocaleString()}`, "Billed"]}
                  labelFormatter={(l) => `Week of ${l}`}
                  contentStyle={{ fontSize: 11 }}
                />
                <Line type="monotone" dataKey="billed" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
