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

export function AccountingView({ isVisible }: { isVisible?: (id: string) => boolean }) {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: billing, isLoading: billingLoading } = useBillingReports();
  const { data: acctData, isLoading: acctLoading } = useAccountingDashboard();

  const loading = statsLoading || billingLoading || acctLoading;

  const kpis = [
    {
      label: "Submissions to Bill",
      value: acctData?.pendingBilling?.length ?? 0,
      subtitle: acctData?.totalPendingBilling ? `$${(acctData.totalPendingBilling / 1000).toFixed(1)}k` : "$0",
      icon: FileText,
      onClick: () => navigate("/invoices"),
    },
    {
      label: "Outstanding",
      value: `$${((acctData?.totalOutstanding ?? 0) / 1000).toFixed(0)}k`,
      subtitle: `${(acctData?.overdueInvoices?.length ?? 0) + (acctData?.sentInvoices?.length ?? 0)} invoices`,
      icon: DollarSign,
      onClick: () => navigate("/invoices"),
    },
    {
      label: "Collection Rate",
      value: `${billing?.collectionRate ?? 0}%`,
      subtitle: `$${((billing?.totalCollected ?? 0) / 1000).toFixed(0)}k collected`,
      icon: TrendingUp,
      onClick: () => navigate("/invoices?tab=analytics"),
    },
    {
      label: "Avg Days to Pay",
      value: billing?.avgDaysToPay ?? 0,
      subtitle: "days",
      icon: Clock,
      onClick: () => navigate("/invoices?tab=analytics"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Row - clickable */}
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
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  {kpi.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{kpi.subtitle}</p>}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Follow-ups by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Follow-ups by Type</CardTitle>
            <CardDescription>What needs your attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {acctLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <FollowUpRow
                  icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
                  label="Overdue Invoices"
                  count={acctData?.followUpsByType?.overdue ?? 0}
                  color="destructive"
                  onClick={() => navigate("/invoices?filter=overdue")}
                />
                <FollowUpRow
                  icon={<Handshake className="h-4 w-4 text-amber-600" />}
                  label="Pending Promises"
                  count={acctData?.followUpsByType?.promises_pending ?? 0}
                  color="warning"
                  onClick={() => navigate("/invoices?tab=promises")}
                />
                <FollowUpRow
                  icon={<ShieldAlert className="h-4 w-4 text-destructive" />}
                  label="Broken Promises"
                  count={acctData?.followUpsByType?.promises_broken ?? 0}
                  color="destructive"
                  onClick={() => navigate("/invoices?tab=promises")}
                />
                <FollowUpRow
                  icon={<DollarSign className="h-4 w-4 text-primary" />}
                  label="Sent / Awaiting Payment"
                  count={acctData?.followUpsByType?.sent_outstanding ?? 0}
                  color="primary"
                  onClick={() => navigate("/invoices?filter=sent")}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Aging Summary */}
        <AgingSummaryChart aging={billing?.aging} loading={billingLoading} />
      </div>

      {/* Pending Billing Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">PM Billing Submissions</CardTitle>
          <CardDescription>Billing requests submitted by Project Managers awaiting invoice creation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {acctLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (acctData?.pendingBilling?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No pending billing submissions</p>
          ) : (
            <>
              {(acctData?.pendingBilling || []).slice(0, 5).map((br: any) => (
                <div
                  key={br.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer"
                  onClick={() => navigate("/invoices")}
                >
                  <div className="space-y-0.5">
                  <p className="font-medium text-sm" data-clarity-mask="true">
                      {br.projects?.name || br.projects?.project_number || "Unknown project"}
                    </p>
                    <p className="text-xs text-muted-foreground" data-clarity-mask="true">
                      Submitted by {br.created_by_profile?.first_name} {br.created_by_profile?.last_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm" data-clarity-mask="true">${(br.total_amount || 0).toLocaleString()}</p>
                    <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                  </div>
                </div>
              ))}
              {(acctData?.pendingBilling?.length ?? 0) > 5 && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/invoices")}>
                  View all {acctData?.pendingBilling?.length} submissions
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FollowUpRow({
  icon,
  label,
  count,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
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
