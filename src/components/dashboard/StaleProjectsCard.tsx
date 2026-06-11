import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStaleProjectsTotal, useStaleProjectsByPM, useCompanyDashboardSettings } from "@/hooks/useDashboardData";
import { InfoTooltip } from "./InfoTooltip";
import { AlertTriangle } from "lucide-react";
import { DrillInModal } from "./DrillInModal";
import { useDrilldownList } from "@/hooks/useDrilldownList";

export function StaleProjectsCard() {
  const { data: settings } = useCompanyDashboardSettings();
  const threshold = settings?.staleProjectDays ?? 14;
  const { data: total, isLoading: totalLoading } = useStaleProjectsTotal(threshold);
  const { data: byPm = [], isLoading: pmLoading } = useStaleProjectsByPM(threshold);

  const [openPm, setOpenPm] = useState<string | "all" | null>(null);
  const drill = useDrilldownList("stale-projects", {
    enabled: openPm !== null,
    thresholdDays: threshold,
    pmId: openPm && openPm !== "all" ? openPm : undefined,
  });

  const modalTitle =
    openPm === "all" || openPm === null
      ? "Stale Projects"
      : `Stale Projects — ${byPm.find((p) => p.id === openPm)?.name || "PM"}`;

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
              Threshold is configured in Settings → Company.
            </InfoTooltip>
          </CardTitle>
          <CardDescription>
            Click a count to see the underlying projects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalLoading || !total ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex items-end justify-between">
              <div>
                <button
                  onClick={() => total.stale > 0 && setOpenPm("all")}
                  className="text-3xl font-bold tabular-nums hover:text-primary disabled:hover:text-foreground transition-colors"
                  disabled={total.stale === 0}
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
              {total.stale > 0 && (
                <button
                  onClick={() => setOpenPm("all")}
                  className="text-xs px-3 py-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium"
                >
                  View all
                </button>
              )}
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
                    <div className="font-medium truncate">{r.name}</div>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 min-w-[48px] text-center">
                      {r.fresh}
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 min-w-[48px] text-center">
                      {r.warming}
                    </span>
                    <button
                      onClick={() => r.stale > 0 && setOpenPm(r.id)}
                      disabled={r.stale === 0}
                      className={`text-[11px] px-2 py-0.5 rounded min-w-[56px] text-center font-semibold ${
                        r.stale > 0
                          ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.stale} stale
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-2">
              Fresh (0–7d) · Warming (8–{threshold - 1}d) · Stale ({threshold}d+)
            </p>
          </div>
        </CardContent>
      </Card>

      <DrillInModal
        open={openPm !== null}
        onOpenChange={(o) => !o && setOpenPm(null)}
        title={modalTitle}
        description={`Open projects with no activity in the last ${threshold} days.`}
        loading={drill.isLoading}
        rows={drill.data || []}
      />
    </>
  );
}
