import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, TrendingUp, Users, DollarSign, GripVertical } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboard";
import { useNavigate } from "react-router-dom";
import { useTeamUtilization, useProjectsByPM } from "@/hooks/useDashboardData";
import { PMDailyView } from "./PMDailyView";
import { TeamOverview } from "./TeamOverview";
import { ProposalFollowUps } from "./ProposalFollowUps";
import { ProposalsPipelineCard } from "./ProposalsPipelineCard";
import { ProposalConversionTable } from "./ProposalConversionTable";
import { StaleProjectsByPM } from "./StaleProjectsByPM";
import { ExpenseApprovalsCard } from "./ExpenseApprovalsCard";
import { BillingPulse } from "./BillingPulse";
import { RevenueTrendChart } from "./RevenueTrendChart";
import { BillingPipelineTable } from "@/components/billing/BillingPipelineTable";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { InfoTooltip } from "./InfoTooltip";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";

interface AdminCompanyViewProps {
  isVisible?: (id: string) => boolean;
  editMode?: boolean;
  order?: string[];
  onReorder?: (next: string[]) => void;
}

export function AdminCompanyView({ isVisible, editMode = false, order, onReorder }: AdminCompanyViewProps) {
  const show = isVisible || (() => true);
  const [view, setView] = useState<"company" | "my">("company");
  const navigate = useNavigate();
  const { data: stats, isLoading } = useDashboardStats();
  // Fallback for callers that don't pass layout context
  const fallbackLayout = useDashboardLayout("admin");
  const effectiveOrder = order ?? fallbackLayout.order;
  const handleReorder = onReorder ?? fallbackLayout.setOrder;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (view === "my") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setView("company")}>
            ← Company View
          </Button>
        </div>
        <PMDailyView />
      </div>
    );
  }

  const kpis = [
    { label: "Active Projects", value: stats?.activeProjects ?? 0, icon: Building2, href: "/projects" },
    { label: "Team Members", value: stats?.teamMembers ?? 0, icon: Users, href: "/settings?section=team" },
    { label: "Outstanding", value: `$${((stats?.totalOutstanding ?? 0) / 1000).toFixed(0)}k`, icon: DollarSign, href: "/billing" },
    { label: "Overdue Invoices", value: stats?.overdueInvoices ?? 0, icon: TrendingUp, href: "/billing" },
  ];

  const widgets: Record<string, React.ReactNode> = {
    "billing-pulse": <BillingPulse scope="company" />,
    "proposals-pipeline": <ProposalsPipelineCard />,
    "proposal-conversion-rates": <ProposalConversionTable />,
    "revenue-trend": <RevenueTrendChart defaultMode="6" />,
    "billing-pipeline": (
      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-1.5">
                  Upcoming Billing Pipeline
                  <InfoTooltip>Services with deliverables completed but not yet invoiced, across the team. Sorted by estimated bill date.</InfoTooltip>
                </CardTitle>
                <CardDescription>Services not yet invoiced across the team</CardDescription>
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
    "kpis": (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(kpi.href)}>
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    ),
    "team-utilization": <TeamUtilizationStrip />,
    "stale-projects-by-pm": <StaleProjectsByPM />,
    "proposal-followups": <ProposalFollowUps />,
    "expense-approvals": <ExpenseApprovalsCard />,
    "team-overview": <TeamOverview />,
  };

  const visibleOrdered = effectiveOrder.filter((id) => widgets[id] && show(id));




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
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setView("my")}>
          My View →
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleOrdered} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {visibleOrdered.map((id) => (
              <SortableWidget key={id} id={id} editMode={editMode}>
                {widgets[id]}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableWidget({ id, editMode, children }: { id: string; editMode: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !editMode });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {editMode && (
        <button
          {...attributes}
          {...listeners}
          className="absolute -left-3 top-3 z-10 h-7 w-7 rounded-md bg-background border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <div className={editMode ? "ring-2 ring-primary/20 rounded-lg" : ""}>
        {children}
      </div>
    </div>
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
