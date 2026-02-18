import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboard";
import { useBillingReports } from "@/hooks/useReports";
import { AgingSummaryChart } from "./AgingSummaryChart";

export function AccountingView() {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: billing, isLoading: billingLoading } = useBillingReports();

  const kpis = [
    { label: "Total Collected", value: `$${((billing?.totalCollected ?? 0) / 1000).toFixed(0)}k`, icon: DollarSign },
    { label: "Collection Rate", value: `${billing?.collectionRate ?? 0}%`, icon: TrendingUp },
    { label: "Outstanding", value: `$${((stats?.totalOutstanding ?? 0) / 1000).toFixed(0)}k`, icon: AlertTriangle },
    { label: "Avg Days to Pay", value: billing?.avgDaysToPay ?? 0, icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              {statsLoading || billingLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aging Summary */}
        <AgingSummaryChart aging={billing?.aging} loading={billingLoading} />

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Common billing tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">Unbilled Hours</p>
                <p className="text-xs text-muted-foreground">{stats?.unbilledHours ?? 0}h ready to invoice</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/invoices")}>
                Create Invoice
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">Overdue Invoices</p>
                <p className="text-xs text-muted-foreground">{stats?.overdueInvoices ?? 0} need follow-up</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/invoices")}>
                View Overdue
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">Pending Proposals</p>
                <p className="text-xs text-muted-foreground">{stats?.pendingProposals ?? 0} awaiting approval</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/proposals")}>
                View Proposals
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
