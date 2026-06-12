import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  FileText,
  DollarSign,
  Target,
  GripVertical,
  Maximize2,
  Minimize2,
  ChevronDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useTeamUtilization,
  useProjectsByPM,
  useActiveProjectsKpi,
  useActiveProposalsKpi,
  useArOutstandingKpi,
  useMonthGoalKpi,
} from "@/hooks/useDashboardData";
import { PMDailyView } from "./PMDailyView";
import { TeamOverview } from "./TeamOverview";
import { ProposalFollowUps } from "./ProposalFollowUps";
import { ProposalConversionTable } from "./ProposalConversionTable";
import { ExpenseApprovalsCard } from "./ExpenseApprovalsCard";
import { BillingPulse } from "./BillingPulse";
import { RevenueTrendChart } from "./RevenueTrendChart";
import { SalesHealthCard } from "./SalesHealthCard";
import { StaleProjectsCard } from "./StaleProjectsCard";
import { BillingPipelineTable } from "@/components/billing/BillingPipelineTable";
import OpenServicesReport from "@/components/reports/OpenServicesReport";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { InfoTooltip } from "./InfoTooltip";
import { DrillInModal } from "./DrillInModal";
import { useMyEventTasks } from "@/hooks/useEventTasks";
import { format } from "date-fns";
import { CheckSquare } from "lucide-react";
import { Link } from "react-router-dom";

function MyEventTasksWidget() {
  const { data, isLoading } = useMyEventTasks();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-1.5">
          <CheckSquare className="h-4 w-4" />Event Prep Tasks
        </CardTitle>
        <CardDescription>Your open prep tasks across upcoming events</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No open event prep tasks assigned to you.</p>
        ) : (
          <div className="space-y-1.5">
            {(data ?? []).slice(0, 8).map((t: any) => (
              <Link
                key={t.id}
                to={`/bd/events/${t.event_id}`}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/40 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t.event?.name ?? "Event"}
                    {t.due_date && ` · Due ${format(new Date(t.due_date + "T12:00:00"), "MMM d")}`}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import { useDrilldownList, type DrilldownKind } from "@/hooks/useDrilldownList";
import { formatCurrency } from "@/lib/utils";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDashboardLayout, type WidgetWidth, ROLE_WIDGETS } from "@/hooks/useDashboardLayout";

interface AdminCompanyViewProps {
  isVisible?: (id: string) => boolean;
  editMode?: boolean;
  order?: string[];
  onReorder?: (next: string[]) => void;
}

export function AdminCompanyView({ isVisible, editMode = false, order, onReorder }: AdminCompanyViewProps) {
  const show = isVisible || (() => true);
  const [view, setView] = useState<"company" | "my">("company");
  const fallbackLayout = useDashboardLayout("admin");
  const effectiveOrder = order ?? fallbackLayout.order;
  const handleReorder = onReorder ?? fallbackLayout.setOrder;
  const { widthOf, setWidth } = fallbackLayout;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ViewToggle = (
    <div className="inline-flex rounded-md border bg-card p-0.5">
      <Button
        size="sm"
        variant={view === "company" ? "default" : "ghost"}
        className="h-7 px-3 text-xs"
        onClick={() => setView("company")}
      >
        Company
      </Button>
      <Button
        size="sm"
        variant={view === "my" ? "default" : "ghost"}
        className="h-7 px-3 text-xs"
        onClick={() => setView("my")}
      >
        My View
      </Button>
    </div>
  );

  if (view === "my") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">{ViewToggle}</div>
        <PMDailyView />
      </div>
    );
  }

  const widgets: Record<string, React.ReactNode> = {
    "kpis": <KpiStrip />,
    "billing-pulse": <BillingPulse scope="company" />,
    "sales-health": <SalesHealthCard />,
    "stale-projects-total": <StaleProjectsCard />,
    "proposal-conversion-rates": <ProposalConversionTable />,
    "revenue-trend": <RevenueTrendChart defaultMode="6" />,
    "billing-pipeline": (
      <Collapsible defaultOpen>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-1.5">
                  Upcoming Billing Pipeline
                  <InfoTooltip>
                    Services on <strong>open projects</strong> in <em>not started</em>
                    or <em>in progress</em> with a remaining balance, excluding any
                    already attached to a pending or approved billing request.
                    When a service has no estimated bill date we fall back to the
                    project's target completion or completion date.
                  </InfoTooltip>
                </CardTitle>
                <CardDescription>Deliverables expected to bill next</CardDescription>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <BillingPipelineTable scope="company" title="" />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    ),
    "open-services": <OpenServicesReport />,
    "team-utilization": <TeamUtilizationStrip />,
    "proposal-followups": <ProposalFollowUps />,
    "expense-approvals": <ExpenseApprovalsCard />,
    "team-overview": <TeamOverview />,
    "event-prep-tasks": <MyEventTasksWidget />,
  };

  const visibleOrdered = effectiveOrder.filter((id) => widgets[id] && show(id));
  const widgetDefs = ROLE_WIDGETS.admin;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = effectiveOrder.indexOf(active.id as string);
    const newIndex = effectiveOrder.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    handleReorder(arrayMove(effectiveOrder, oldIndex, newIndex));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">{ViewToggle}</div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleOrdered} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {visibleOrdered.map((id) => {
              const def = widgetDefs.find((w) => w.id === id);
              const width = widthOf(id);
              const locked = !!def?.lockedFull;
              return (
                <SortableWidget
                  key={id}
                  id={id}
                  editMode={editMode}
                  width={width}
                  locked={locked}
                  onToggleWidth={() => setWidth(id, width === "full" ? "half" : "full")}
                >
                  {widgets[id]}
                </SortableWidget>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableWidget({
  id, editMode, width, locked, onToggleWidth, children,
}: {
  id: string;
  editMode: boolean;
  width: WidgetWidth;
  locked: boolean;
  onToggleWidth: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !editMode });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const spanClass = width === "full" ? "md:col-span-2" : "md:col-span-1";

  return (
    <div ref={setNodeRef} style={style} className={`relative ${spanClass}`}>
      {editMode && (
        <>
          <button
            {...attributes}
            {...listeners}
            className="absolute -left-3 top-3 z-10 h-7 w-7 rounded-md bg-background border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          {!locked && (
            <button
              onClick={onToggleWidth}
              className="absolute -right-3 top-3 z-10 h-7 w-7 rounded-md bg-background border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={width === "full" ? "Make half width" : "Make full width"}
              title={width === "full" ? "Make half width" : "Make full width"}
            >
              {width === "full" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </>
      )}
      <div className={editMode ? "ring-2 ring-primary/20 rounded-lg" : ""}>
        {children}
      </div>
    </div>
  );
}

function KpiStrip() {
  const { data: active, isLoading: l1 } = useActiveProjectsKpi();
  const { data: prop, isLoading: l2 } = useActiveProposalsKpi();
  const { data: ar, isLoading: l3 } = useArOutstandingKpi();
  const { data: goal, isLoading: l4 } = useMonthGoalKpi();

  const [drillKind, setDrillKind] = useState<DrilldownKind | null>(null);
  const drill = useDrilldownList((drillKind ?? "active-projects") as DrilldownKind, { enabled: drillKind !== null });

  const modalMeta: Record<DrilldownKind, { title: string; description?: string }> = {
    "active-projects": { title: "Active Projects", description: "Open projects sorted by most recent activity." },
    "active-proposals": { title: "Proposals In Flight", description: "Sent and signed proposals awaiting execution." },
    "ar-outstanding": { title: "Accounts Receivable", description: "Sent and overdue invoices with a balance." },
    "proposal-followups": { title: "Proposal Follow-Ups", description: "Sent proposals past their next follow-up date." },
    "stale-projects": { title: "Stale Projects", description: "Open projects with no recent activity." },
  };

  const cards = [
    {
      label: "Active Projects",
      icon: Building2,
      loading: l1,
      tooltip: "Currently open projects. Δ compares to projects open at the start of this month.",
      kind: "active-projects" as DrilldownKind,
      body: active ? (
        <>
          <p className="text-2xl font-bold tabular-nums">{active.value}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {active.delta > 0 ? (
              <><ArrowUp className="h-3 w-3 text-emerald-500" /> +{active.delta} vs last month</>
            ) : active.delta < 0 ? (
              <><ArrowDown className="h-3 w-3 text-red-500" /> {active.delta} vs last month</>
            ) : (
              <>No change vs last month</>
            )}
          </p>
        </>
      ) : null,
    },
    {
      label: "Proposals Written",
      icon: FileText,
      loading: l2,
      tooltip: "Count of proposals created this calendar month vs last month. Subtitle shows dollars currently in flight (sent + signed).",
      kind: "active-proposals" as DrilldownKind,
      body: prop ? (
        <>
          <p className="text-2xl font-bold tabular-nums">{prop.value}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {prop.delta > 0 ? (
              <><ArrowUp className="h-3 w-3 text-emerald-500" /> +{prop.delta} vs last month · {formatCurrency(prop.inFlight)} in flight</>
            ) : prop.delta < 0 ? (
              <><ArrowDown className="h-3 w-3 text-red-500" /> {prop.delta} vs last month · {formatCurrency(prop.inFlight)} in flight</>
            ) : (
              <>Same as last month · {formatCurrency(prop.inFlight)} in flight</>
            )}
          </p>
        </>
      ) : null,
    },
    {
      label: "AR Outstanding",
      icon: DollarSign,
      loading: l3,
      tooltip: "Open invoice balances (sent + overdue). Δ compares to outstanding AR at the start of this month — down is good.",
      kind: "ar-outstanding" as DrilldownKind,
      body: ar ? (
        <>
          <p className="text-2xl font-bold tabular-nums">{formatCurrency(ar.total)}</p>
          <p className="text-xs text-muted-foreground tabular-nums flex items-center gap-1 flex-wrap">
            {ar.delta < 0 ? (
              <><ArrowDown className="h-3 w-3 text-emerald-500" /> <span className="text-emerald-600">{formatCurrency(ar.delta)}</span> vs month start</>
            ) : ar.delta > 0 ? (
              <><ArrowUp className="h-3 w-3 text-red-500" /> <span className="text-red-600">+{formatCurrency(ar.delta)}</span> vs month start</>
            ) : (
              <>No change vs month start</>
            )}
            <span className="opacity-50">·</span>
            <span className={ar.overdue > 0 ? "text-red-500 font-medium" : ""}>
              {formatCurrency(ar.overdue)} overdue
            </span>
          </p>
        </>
      ) : null,
    },
    {
      label: "Month-to-Goal",
      icon: Target,
      loading: l4,
      tooltip: "Billed month-to-date ÷ the company monthly billing goal. Δ compares pace to the same day last month.",
      kind: null as DrilldownKind | null,
      body: goal ? (
        <>
          <p className={`text-2xl font-bold tabular-nums ${
            goal.pct >= 0.9 ? "text-emerald-600" :
            goal.pct >= 0.6 ? "text-foreground" :
            "text-amber-600"
          }`}>
            {Math.round(goal.pct * 100)}%
          </p>
          <p className="text-xs text-muted-foreground tabular-nums flex items-center gap-1 flex-wrap">
            {goal.deltaPct > 0.005 ? (
              <><ArrowUp className="h-3 w-3 text-emerald-500" /> <span className="text-emerald-600">+{Math.round(goal.deltaPct * 100)}pp</span> vs last month</>
            ) : goal.deltaPct < -0.005 ? (
              <><ArrowDown className="h-3 w-3 text-red-500" /> <span className="text-red-600">{Math.round(goal.deltaPct * 100)}pp</span> vs last month</>
            ) : (
              <>On pace vs last month</>
            )}
            <span className="opacity-50">·</span>
            <span>{formatCurrency(goal.billed)} / {formatCurrency(goal.monthGoal)}</span>
          </p>
        </>
      ) : null,
    },
  ];

  return (
    <>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map((k) => (
          <Card
            key={k.label}
            className={k.kind ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
            onClick={() => k.kind && setDrillKind(k.kind)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  {k.label}
                  <InfoTooltip>{k.tooltip}</InfoTooltip>
                </p>
                <k.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              {k.loading ? <Skeleton className="h-10 w-24" /> : k.body}
            </CardContent>
          </Card>
        ))}
      </div>

      <DrillInModal
        open={drillKind !== null}
        onOpenChange={(o) => !o && setDrillKind(null)}
        title={drillKind ? modalMeta[drillKind].title : ""}
        description={drillKind ? modalMeta[drillKind].description : undefined}
        loading={drill.isLoading}
        rows={drill.data || []}
      />
    </>
  );
}

function TeamUtilizationStrip() {
  const { data: utilization = [], isLoading: utilLoading } = useTeamUtilization();
  const { data: projectsByPM = [], isLoading: pmLoading } = useProjectsByPM();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1.5">
            Team Utilization (This Week)
            <InfoTooltip>
              Billable hours logged vs total hours logged in the last 7 days
              (Mon–Sun rolling). <strong>Billable</strong> = activities flagged
              billable. <strong>Total</strong> = billable + non-billable.
              <strong> % Billable</strong> = billable ÷ total.
            </InfoTooltip>
          </CardTitle>
          <CardDescription>Billable vs total hours by team member</CardDescription>
        </CardHeader>
        <CardContent>
          {utilLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : utilization.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={utilization.slice(0, 10)} layout="vertical" barGap={2}>
                <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
                <Tooltip
                  formatter={(v: number, name: string) => [`${v}h`, name]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="billableHours" fill="hsl(var(--primary))" name="Billable" radius={[0, 4, 4, 0]} />
                <Bar dataKey="totalHours" fill="hsl(var(--muted-foreground))" name="Total" radius={[0, 4, 4, 0]} opacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-8 text-sm">No team data</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-1.5">
            Projects by PM
            <InfoTooltip>
              Number of open projects assigned to each active PM. Only shows
              users with the PM, Senior PM, or Admin role who are currently
              assigned to at least one open project.
            </InfoTooltip>
          </CardTitle>
          <CardDescription>Active project distribution across team</CardDescription>
        </CardHeader>
        <CardContent>
          {pmLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : projectsByPM.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={projectsByPM.slice(0, 10)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="projects" name="Projects" radius={[0, 4, 4, 0]}>
                  {projectsByPM.slice(0, 10).map((_: any, i: number) => {
                    const colors = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))", "hsl(var(--secondary))"];
                    return <Cell key={i} fill={colors[i % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-8 text-sm">No project assignments found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
