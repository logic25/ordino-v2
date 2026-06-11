import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStaleProjectsTotal, useCompanyDashboardSettings } from "@/hooks/useDashboardData";
import { InfoTooltip } from "./InfoTooltip";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function StaleProjectsCard() {
  const navigate = useNavigate();
  const { data: settings } = useCompanyDashboardSettings();
  const threshold = settings?.staleProjectDays ?? 14;
  const { data, isLoading } = useStaleProjectsTotal(threshold);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4" />
          Stale Projects
          <InfoTooltip>
            Open projects with no activity in the last {threshold} days.
          </InfoTooltip>
        </CardTitle>
        <CardDescription>No activity in {threshold}+ days</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold tabular-nums">{data.stale}</p>
              <p className="text-xs text-muted-foreground">
                of {data.total} open
                {data.total > 0 && (
                  <> · {Math.round((data.stale / data.total) * 100)}%</>
                )}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/projects?stale=stale")}
              disabled={data.stale === 0}
            >
              Review
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
