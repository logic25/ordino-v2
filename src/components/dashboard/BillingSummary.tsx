import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, FileText, Clock } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboard";
import { Skeleton } from "@/components/ui/skeleton";

export function BillingSummary() {
  const { data: stats, isLoading } = useDashboardStats();

  const billingItems = [
    {
      label: "Unbilled Hours",
      value: `${stats?.unbilledHours ?? 0}h`,
      icon: <Clock className="h-4 w-4 text-muted-foreground" />,
      action: "Create Invoice",
    },
    {
      label: "Pending Proposals",
      value: stats?.pendingProposals ?? 0,
      icon: <FileText className="h-4 w-4 text-muted-foreground" />,
      action: "View Proposals",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Billing Summary
        </CardTitle>
        <CardDescription>Revenue opportunities</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : (
          billingItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center gap-3">
                {item.icon}
                <div>
                  <p className="font-medium">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                {item.action}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
