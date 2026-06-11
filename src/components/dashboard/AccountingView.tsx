import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Clock, AlertTriangle, TrendingUp, FileText, ShieldAlert, Handshake } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboard";
import { useAccountingDashboard } from "@/hooks/useDashboardData";
import { AgingSummaryChart } from "./AgingSummaryChart";
import { useBillingReports } from "@/hooks/useReports";
import { BillingPulse } from "./BillingPulse";
import { InfoTooltip } from "./InfoTooltip";
import { ResizableDashboardGrid } from "./ResizableDashboardGrid";

interface AccountingViewProps {
  isVisible?: (id: string) => boolean;
  editMode?: boolean;
  order?: string[];
  onReorder?: (next: string[]) => void;
}

export function AccountingView({ isVisible, editMode = false, order, onReorder }: AccountingViewProps) {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: billing, isLoading: billingLoading } = useBillingReports();
  const { data: acctData, isLoading: acctLoading } = useAccountingDashboard();

  const loading = statsLoading || billingLoading || acctLoading;

  const kpis = [
    {
      label: "Submissions to Invoice",
      value: acctData?.pendingBilling?.length ?? 0,
      subtitle: acctData?.totalPendingBilling ? `$${(acctData.totalPendingBilling / 1000).toFixed(1)}k` : "$0",
      icon: FileText,
      tooltip: "Billing requests submitted by Project Managers awaiting invoice creation. Click to open the invoice queue.",
      onClick: () => navigate("/invoices"),
    },
    {
      label: "Outstanding",
      value: `$${((acctData?.totalOutstanding ?? 0) / 1000).toFixed(0)}k`,
      subtitle: `${(acctData?.overdueInvoices?.length ?? 0) + (acctData?.sentInvoices?.length ?? 0)} invoices`,
      icon: DollarSign,
      tooltip: "Total open invoice balances (sent + overdue). Subtitle counts invoices contributing to the balance.",
      onClick: () => navigate("/invoices"),
    },
    {
      label: "Collection Rate",
      value: `${billing?.collectionRate ?? 0}%`,
      subtitle: `$${((billing?.totalCollected ?? 0) / 1000).toFixed(0)}k collected`,
      icon: TrendingUp,
      tooltip: "Collected ÷ total invoiced over the trailing 90 days.",
      onClick: () => navigate("/invoices?tab=analytics"),
    },
    {
      label: "Avg Days to Pay",
      value: billing?.avgDaysToPay ?? 0,
      subtitle: "days",
      icon: Clock,
      tooltip: "Average days from invoice issued to paid (last 90 days, paid invoices only).",
      onClick: () => navigate("/invoices?tab=analytics"),
    },
  ];

  const widgets: Record<string, React.ReactNode> = {
    "kpis": (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className="cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all"
            onClick={kpi.onClick}
          >
            <CardContent className="pt-6">
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold" data-clarity-mask="true">{kpi.value}</p>
                    <kpi.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    {kpi.label}
                    <InfoTooltip>{kpi.tooltip}</InfoTooltip>
                  </p>
                  {kpi.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{kpi.subtitle}</p>}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    ),
    "billing-pulse-self": <BillingPulse scope="self-biller" title="My Billing Pulse" />,
    "billing-pulse-company": <BillingPulse scope="company" title="Company Billing Pulse" compact />,
    "followups-by-type": (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1.5">
            Follow-ups by Type
            <InfoTooltip>
              Counts collection actions waiting on accounting:
              <br /><strong>Overdue</strong> = invoices past due date.
              <br /><strong>Pending Promises</strong> = payment promises with a future date.
              <br /><strong>Broken Promises</strong> = promises whose date has passed without payment.
              <br /><strong>Sent / Awaiting Payment</strong> = invoices sent but not yet paid/overdue.
            </InfoTooltip>
          </CardTitle>
          <CardDescription>What needs your attention</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {acctLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <FollowUpRow icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="Overdue Invoices"
                count={acctData?.followUpsByType?.overdue ?? 0} onClick={() => navigate("/invoices?filter=overdue")} />
              <FollowUpRow icon={<Handshake className="h-4 w-4 text-amber-600" />} label="Pending Promises"
                count={acctData?.followUpsByType?.promises_pending ?? 0} onClick={() => navigate("/invoices?tab=promises")} />
              <FollowUpRow icon={<ShieldAlert className="h-4 w-4 text-destructive" />} label="Broken Promises"
                count={acctData?.followUpsByType?.promises_broken ?? 0} onClick={() => navigate("/invoices?tab=promises")} />
              <FollowUpRow icon={<DollarSign className="h-4 w-4 text-primary" />} label="Sent / Awaiting Payment"
                count={acctData?.followUpsByType?.sent_outstanding ?? 0} onClick={() => navigate("/invoices?filter=sent")} />
            </>
          )}
        </CardContent>
      </Card>
    ),
    "aging-summary": <AgingSummaryChart aging={billing?.aging} loading={billingLoading} />,
    "pending-billing": (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1.5">
            PM Billing Submissions
            <InfoTooltip>
              Billing requests submitted by Project Managers that haven't been turned into an invoice yet. Click any row to open the invoice creation flow.
            </InfoTooltip>
          </CardTitle>
          <CardDescription>Awaiting invoice creation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {acctLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (acctData?.pendingBilling?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No pending billing submissions</p>
          ) : (
            <>
              {(acctData?.pendingBilling || []).slice(0, 5).map((br: any) => {
                const isExpense = Array.isArray(br.expenses) && br.expenses.length > 0;
                const expense = isExpense ? br.expenses[0] : null;
                return (
                  <div
                    key={br.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer"
                    onClick={() => navigate("/invoices")}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm" data-clarity-mask="true">
                          {br.projects?.project_number ? `${br.projects.project_number} — ` : ""}{br.projects?.name || "Unknown project"}
                        </p>
                        {isExpense && (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">Expense</Badge>
                        )}
                      </div>
                      {br.projects?.properties?.address && (
                        <p className="text-xs text-muted-foreground" data-clarity-mask="true">
                          {br.projects.properties.address}
                        </p>
                      )}
                      {isExpense && expense && (
                        <p className="text-xs text-muted-foreground" data-clarity-mask="true">
                          {expense.description}{expense.vendor ? ` · ${expense.vendor}` : ""}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground" data-clarity-mask="true">
                        Submitted by {br.created_by_profile?.first_name} {br.created_by_profile?.last_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm" data-clarity-mask="true">${(br.total_amount || 0).toLocaleString()}</p>
                      <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                    </div>
                  </div>
                );
              })}
              {(acctData?.pendingBilling?.length ?? 0) > 5 && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/invoices")}>
                  View all {acctData?.pendingBilling?.length} submissions
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    ),
  };

  return (
    <ResizableDashboardGrid
      role="accounting"
      editMode={editMode}
      widgets={widgets}
      order={order}
      onReorder={onReorder}
      isVisible={isVisible}
    />
  );
}

function FollowUpRow({
  icon,
  label,
  count,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg border hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Badge variant={count > 0 ? "destructive" : "secondary"} className="text-xs">
        {count}
      </Badge>
    </div>
  );
}
