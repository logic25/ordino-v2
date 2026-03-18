import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radio, DollarSign, Users, AlertTriangle } from "lucide-react";

interface SignalKPICardsProps {
  activeCount: number;
  paidCount: number;
  compCount: number;
  unsetCount: number;
  totalMonthlyRevenue: number;
  totalCount: number;
  expiringSoonCount: number;
}

export function SignalKPICards({
  activeCount,
  paidCount,
  compCount,
  unsetCount,
  totalMonthlyRevenue,
  totalCount,
  expiringSoonCount,
}: SignalKPICardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Radio className="h-4 w-4" /> Active Subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeCount}</div>
          <p className="text-xs text-muted-foreground">
            {paidCount} paid · {compCount} comp{unsetCount > 0 ? ` · ${unsetCount} not set` : ""}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" /> Monthly Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalMonthlyRevenue.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">From {paidCount} paid subscriptions</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="h-4 w-4" /> Total Subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCount}</div>
          <p className="text-xs text-muted-foreground">All statuses</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Expiring Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{expiringSoonCount}</div>
          <p className="text-xs text-muted-foreground">Within 30 days</p>
        </CardContent>
      </Card>
    </div>
  );
}
