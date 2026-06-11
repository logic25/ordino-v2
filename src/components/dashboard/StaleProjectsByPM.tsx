import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useStaleProjectsByPM, useCompanyDashboardSettings } from "@/hooks/useDashboardData";
import { InfoTooltip } from "./InfoTooltip";

export function StaleProjectsByPM() {
  const navigate = useNavigate();
  const { data: settings } = useCompanyDashboardSettings();
  const threshold = settings?.staleProjectDays ?? 14;
  const { data: rows = [], isLoading } = useStaleProjectsByPM(threshold);

  const go = (pmId: string, bucket: "fresh" | "warming" | "stale") =>
    navigate(`/projects?pm=${pmId}&stale=${bucket}`);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-1.5">
            Stale Projects by PM
            <InfoTooltip>
              Counts each PM's open projects by how recently they've been
              touched. A "touch" is any time log, note, status change,
              email, or comment. Threshold ({threshold}d) is set in
              Settings → Company.
            </InfoTooltip>
          </CardTitle>
          <CardDescription>
            Fresh (0–7d) · Warming (8–{threshold - 1}d) · Stale ({threshold}d+)
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-center py-8 text-sm">
            No open projects assigned.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2 rounded-md border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="font-medium text-sm truncate">{r.name}</div>
                <button
                  onClick={() => go(r.id, "fresh")}
                  className="text-xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 min-w-[64px]"
                >
                  {r.fresh} fresh
                </button>
                <button
                  onClick={() => go(r.id, "warming")}
                  className="text-xs px-2 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 min-w-[80px]"
                >
                  {r.warming} warming
                </button>
                <button
                  onClick={() => go(r.id, "stale")}
                  className={`text-xs px-2 py-1 rounded-md min-w-[64px] ${
                    r.stale > 0
                      ? "bg-destructive/10 text-destructive hover:bg-destructive/20 font-semibold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.stale} stale
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
