import { Card, CardContent } from "@/components/ui/card";
import { FileText, FolderOpen, DollarSign, Clock, Users } from "lucide-react";
import { format } from "date-fns";
import type { ClientStats } from "./useClientRelations";
import { formatCurrency } from "./useClientRelations";

interface Props {
  stats: ClientStats;
}

export function ClientStatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Proposals</span>
          </div>
          <p className="text-lg font-bold">{stats.totalProposals}</p>
          {stats.totalProposals > 0 && (
            <p className="text-xs text-muted-foreground">
              {stats.acceptedProposals} won · {stats.winRate}% win rate
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Revenue</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-xs text-muted-foreground">from accepted proposals</p>
        </CardContent>
      </Card>
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Active Projects</span>
          </div>
          <p className="text-lg font-bold">{stats.activeProjects}</p>
        </CardContent>
      </Card>
      {stats.referralCount > 0 ? (
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Referrals</span>
            </div>
            <p className="text-lg font-bold">{stats.referralCount}</p>
            <p className="text-xs text-muted-foreground">
              {stats.referralConverted} converted · {formatCurrency(stats.referralValue)}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Last Activity</span>
            </div>
            <p className="text-sm font-medium">
              {stats.lastActivity
                ? format(new Date(stats.lastActivity), "MMM d, yyyy")
                : "—"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
