import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useAccountingDashboard } from "@/hooks/useDashboardData";
import { useBillingReports } from "@/hooks/useReports";
import { AgingSummaryChart } from "./AgingSummaryChart";
import { FileText, AlertTriangle, Handshake } from "lucide-react";
import { formatCompactCurrency } from "@/lib/utils";

export function AccountingSummaryStrip() {
  const navigate = useNavigate();
  const { data: acct, isLoading } = useAccountingDashboard();
  const { data: billing, isLoading: billingLoading } = useBillingReports();

  const tiles = [
    {
      label: "Submissions to Bill",
      value: acct?.pendingBilling?.length ?? 0,
      subtitle: formatCompactCurrency(acct?.totalPendingBilling ?? 0),
      icon: FileText,
      onClick: () => navigate("/invoices"),
    },
    {
      label: "Overdue Invoices",
      value: acct?.overdueInvoices?.length ?? 0,
      subtitle: formatCompactCurrency(acct?.totalOutstanding ?? 0) + " outstanding",
      icon: AlertTriangle,
      onClick: () => navigate("/invoices?filter=overdue"),
    },
    {
      label: "Active Promises",
      value: acct?.activePromises?.length ?? 0,
      subtitle: `${acct?.followUpsByType?.promises_broken ?? 0} broken`,
      icon: Handshake,
      onClick: () => navigate("/invoices?tab=promises"),
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-1">
        {tiles.map((t) => (
          <Card
            key={t.label}
            className="cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all"
            onClick={t.onClick}
          >
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-bold">{t.value}</p>
                    <t.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.subtitle}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="lg:col-span-1">
        <AgingSummaryChart aging={billing?.agingBuckets as any} loading={billingLoading} />
      </div>
    </div>
  );
}
