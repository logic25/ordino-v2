import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStaleProjectsTotal, useStaleProjectsByPM, useCompanyDashboardSettings } from "@/hooks/useDashboardData";
import { InfoTooltip } from "./InfoTooltip";
import { AlertTriangle } from "lucide-react";
import { DrillInModal } from "./DrillInModal";
import { useDrilldownList, type StaleBucket } from "@/hooks/useDrilldownList";

type DrillState = { pmId: string | "all"; bucket: StaleBucket } | null;

export function StaleProjectsCard() {
  const { data: settings } = useCompanyDashboardSettings();
  const threshold = settings?.staleProjectDays ?? 14;
  const { data: total, isLoading: totalLoading } = useStaleProjectsTotal(threshold);
  const { data: byPm = [], isLoading: pmLoading } = useStaleProjectsByPM(threshold);

  const [drill, setDrill] = useState<DrillState>(null);

  const drillQuery = useDrilldownList("stale-projects", {
    enabled: drill !== null,
    thresholdDays: threshold,
    pmId: drill?.pmId && drill.pmId !== "all" ? drill.pmId : undefined,
    bucket: drill?.bucket,
  });

  const pmName = drill?.pmId && drill.pmId !== "all"
    ? byPm.find((p) => p.id === drill.pmId)?.name || "PM"
    : null;
  const bucketLabel: Record<StaleBucket, string> = {
    fresh: "Fresh (last 7 days)",
    warming: `Warming (8–${threshold - 1} days idle)`,
    stale: `Stale (${threshold}d+ idle)`,
    all: "All open projects",
  };
  const modalTitle = drill
    ? `${pmName ? pmName + " — " : ""}${bucketLabel[drill.bucket]}`
    : "Stale Projects";
  const modalDescription = drill?.bucket === "stale"
    ? `Open projects with no activity in the last ${threshold} days.`
    : drill?.bucket === "warming"
      ? `Open projects with no activity in the last 8 to ${threshold - 1} days.`
      : drill?.bucket === "fresh"
        ? "Open projects touched in the last 7 days."
        : "All open projects assigned to this PM.";

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Stale Projects
            <InfoTooltip>
              Open projects with no activity in the last {threshold} days.
              A "touch" is any time log, note, status change, email, or comment.
              Click any pill — Fresh, Warming, Stale, or a PM row — to see that list.
              Threshold is configured in Settings → Company.
            </InfoTooltip>
          </CardTitle>
          <CardDescription>
            Click a pill to see the underlying projects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalLoading || !total ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex items-end justify-between">
              <div>
                <button
                  onClick={() => setDrill({ pmId: "all", bucket: "stale" })}
                  className="text-3xl font-bold tabular-nums hover:text-primary transition-colors"
                >
                  {total.stale}
                </button>
                <p className="text-xs text-muted-foreground">
                  of {total.total} open
                  {total.total > 0 && (
                    <> · {Math.round((total.stale / total.total) * 100)}%</>
                  )}
                </p>
              </div>
              <button
                onClick={() => setDrill({ pmId: "all", bucket: "all" })}
                className="text-xs px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 font-medium"
              >
                View all open
              </button>
            </div>
          )}

          {/* PM breakdown */}
          <div className="pt-3 border-t">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
              By PM
            </p>
            {pmLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : byPm.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">No open projects assigned.</p>
            ) : (
              <div className="space-y-1.5">
                {byPm.slice(0, 8).map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors text-sm"
                  >
                    <button
                      onClick={() => setDrill({ pmId: r.id, bucket: "all" })}
                      className="font-medium truncate text-left hover:text-primary transition-colors"
                      title="See all of this PM's open projects"
                    >
                      {r.name}
                    </button>
                    <button
                      onClick={() => setDrill({ pmId: r.id, bucket: "fresh" })}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 min-w-[48px] text-center hover:bg-emerald-500/20"
                      title="Fresh: touched in the last 7 days"
                    >
                      {r.fresh}
                    </button>
                    <button
                      onClick={() => setDrill({ pmId: r.id, bucket: "warming" })}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 min-w-[48px] text-center hover:bg-amber-500/20"
                      title={`Warming: 8 to ${threshold - 1} days idle`}
                    >
                      {r.warming}
                    </button>
                    <button
                      onClick={() => setDrill({ pmId: r.id, bucket: "stale" })}
                      className={`text-[11px] px-2 py-0.5 rounded min-w-[56px] text-center font-semibold ${
                        r.stale > 0
                          ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                      title={`Stale: ${threshold}+ days idle`}
                    >
                      {r.stale} stale
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-2">
              Fresh (0–7d) · Warming (8–{threshold - 1}d) · Stale ({threshold}d+) · all pills clickable
            </p>
          </div>
        </CardContent>
      </Card>

      <DrillInModal
        open={drill !== null}
        onOpenChange={(o) => !o && setDrill(null)}
        title={modalTitle}
        description={modalDescription}
        loading={drillQuery.isLoading}
        rows={drillQuery.data || []}
      />
    </>
  );
}
