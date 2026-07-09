import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { StagePill, STAGE_LABEL } from "@/components/portal/StagePill";
import { InviteClientDialog } from "@/components/portal/InviteClientDialog";
import { useAuth } from "@/hooks/useAuth";
import {
  usePortalOrgs, useBuildings, usePortalProjects, usePortalCounters,
  type FilingStage,
} from "@/hooks/usePortal";
import { Building2, MapPin, ChevronRight, AlertTriangle, CheckCircle2, Clock, Search, LayoutGrid, Table as TableIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PortfolioTracker } from "@/components/portal/PortfolioTracker";

export default function Portfolio() {
  const { profile } = useAuth();
  // Anything that's not explicitly a portal client is staff (covers NULL legacy profiles)
  const isStaff = profile?.portal_role !== "client";
  const { data: orgs = [], isLoading: orgsLoading } = usePortalOrgs();
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>();
  const activeOrgId = selectedOrgId ?? orgs[0]?.id;

  const { data: buildings = [] } = useBuildings(activeOrgId);
  const { data: projects = [], isLoading: projLoading } = usePortalProjects({ clientOrgId: activeOrgId });
  const { data: counters } = usePortalCounters();

  const [stageFilter, setStageFilter] = useState<FilingStage | "all">("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"cards" | "tracker">("cards");

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (stageFilter !== "all" && p.portal_overall_stage !== stageFilter) return false;
      if (q) {
        const hay = `${p.name ?? ""} ${p.properties?.address ?? ""} ${p.project_number ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [projects, stageFilter, q]);

  const useRollup = buildings.length > 0;

  return (
    <PortalLayout>
      {isStaff && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2">
          <div className="text-xs text-amber-900">
            <strong>Staff view.</strong> You're seeing all client orgs. Invite a client to give them scoped access.
          </div>
          <InviteClientDialog />
        </div>
      )}
      {/* Org switcher (shown only if user has multiple orgs, or for GLE staff who see all) */}
      {orgs.length > 1 && (
        <div className="mb-6">
          <label className="text-xs font-medium text-muted-foreground">Client organization</label>
          <Select value={activeOrgId} onValueChange={setSelectedOrgId}>
            <SelectTrigger className="mt-1 w-full sm:w-96 bg-white">
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Counters strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <CounterTile icon={Clock}         label="Active projects"    value={counters?.active ?? "—"}         tone="slate" />
        <CounterTile icon={CheckCircle2}  label="Permits issued"     value={counters?.permitsIssued ?? "—"}  tone="emerald" />
        <CounterTile icon={AlertTriangle} label="Blocked filings"    value={counters?.blocked ?? "—"}        tone="red" />
        <CounterTile icon={AlertTriangle} label="Actions you owe"    value={counters?.actionsNeeded ?? "—"}  tone="amber" />
      </div>

      {/* View toggle */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-md border bg-white p-0.5">
          <Button
            size="sm"
            variant={view === "cards" ? "default" : "ghost"}
            className="h-7 px-3 text-xs"
            onClick={() => setView("cards")}
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Cards
          </Button>
          <Button
            size="sm"
            variant={view === "tracker" ? "default" : "ghost"}
            className="h-7 px-3 text-xs"
            onClick={() => setView("tracker")}
          >
            <TableIcon className="h-3.5 w-3.5 mr-1.5" /> Tracker
          </Button>
        </div>
      </div>

      {view === "cards" ? (
        <>
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by address, project name, or number"
                value={q} onChange={(e) => setQ(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-56 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {(Object.keys(STAGE_LABEL) as FilingStage[]).map((s) => (
                  <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {orgsLoading || projLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : useRollup ? (
            <RollupView buildings={buildings} projects={filteredProjects} />
          ) : (
            <FlatGrid projects={filteredProjects} />
          )}
        </>
      ) : (
        <PortfolioTracker clientOrgId={activeOrgId} />
      )}

      {!orgsLoading && orgs.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No client organizations assigned to your account yet.</p>
          <p className="text-xs mt-1">Contact your GLE point of contact to get set up.</p>
        </div>
      )}
    </PortalLayout>
  );
}

function CounterTile({
  icon: Icon, label, value, tone,
}: { icon: any; label: string; value: number | string; tone: "slate" | "emerald" | "red" | "amber" }) {
  const toneCls = {
    slate:   "bg-slate-50 text-slate-700 ring-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red:     "bg-red-50 text-red-700 ring-red-200",
    amber:   "bg-amber-50 text-amber-700 ring-amber-200",
  }[tone];
  return (
    <div className="rounded-lg border bg-white p-4 flex items-start gap-3">
      <div className={cn("h-9 w-9 rounded-md flex items-center justify-center ring-1 ring-inset", toneCls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold tabular-nums leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function RollupView({ buildings, projects }: { buildings: any[]; projects: any[] }) {
  const byBuilding = new Map<string, any[]>();
  const unassigned: any[] = [];
  projects.forEach((p) => {
    if (p.building_id) {
      if (!byBuilding.has(p.building_id)) byBuilding.set(p.building_id, []);
      byBuilding.get(p.building_id)!.push(p);
    } else {
      unassigned.push(p);
    }
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Buildings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {buildings.map((b) => {
            const projs = byBuilding.get(b.id) ?? [];
            const stages = projs.map((p) => p.portal_overall_stage).filter(Boolean);
            return (
              <Link
                key={b.id}
                to={`/portal/buildings/${b.id}`}
                className="rounded-lg border bg-white p-5 hover:border-slate-400 hover:shadow-sm transition group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">{b.address}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                      {b.bin && <span>BIN {b.bin}</span>}
                      {b.pm_name && <span>PM: {b.pm_name}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-slate-900 shrink-0" />
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-semibold tabular-nums">{projs.length}</div>
                    <div className="text-xs text-muted-foreground">projects</div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                    {[...new Set(stages)].slice(0, 4).map((s: any) => (
                      <StagePill key={s} stage={s} />
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {unassigned.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Other projects</h2>
          <FlatGrid projects={unassigned} />
        </div>
      )}
    </div>
  );
}

export function FlatGrid({ projects }: { projects: any[] }) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm border rounded-lg bg-white">
        No projects match your filters.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((p) => (
        <Link
          key={p.id}
          to={`/portal/projects/${p.id}`}
          className="rounded-lg border bg-white p-5 hover:border-slate-400 hover:shadow-sm transition group flex flex-col"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate">{p.name}</div>
              {p.project_number && (
                <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{p.project_number}</div>
              )}
            </div>
            <StagePill stage={p.portal_overall_stage} />
          </div>
          {p.properties?.address && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{p.properties.address}</span>
            </div>
          )}
          {typeof p.portal_pct_complete === "number" && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="tabular-nums font-medium">{p.portal_pct_complete}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${p.portal_pct_complete}%` }}
                />
              </div>
            </div>
          )}
          {p.portal_next_action && (
            <div className="mt-3 text-xs text-slate-700 border-t pt-3">
              <span className="text-muted-foreground">Next: </span>{p.portal_next_action}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
