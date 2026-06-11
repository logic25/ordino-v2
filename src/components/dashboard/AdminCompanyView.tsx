import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, TrendingUp, Users, DollarSign } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboard";
import { useNavigate } from "react-router-dom";
import { useTeamUtilization, useProjectsByPM } from "@/hooks/useDashboardData";
import { PMDailyView } from "./PMDailyView";
import { TeamOverview } from "./TeamOverview";
import { ProposalFollowUps } from "./ProposalFollowUps";
import { ProposalActivityCard } from "./ProposalActivityCard";
import { ProposalsPipelineCard } from "./ProposalsPipelineCard";
import { ProposalConversionTable } from "./ProposalConversionTable";
import { ExpenseApprovalsCard } from "./ExpenseApprovalsCard";
import { BillingPulse } from "./BillingPulse";
import { RevenueTrendChart } from "./RevenueTrendChart";
import { BillingPipelineTable } from "@/components/billing/BillingPipelineTable";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export function AdminCompanyView({ isVisible }: { isVisible?: (id: string) => boolean }) {
  const show = isVisible || (() => true);
  const [view, setView] = useState<"company" | "my">("company");
  const navigate = useNavigate();
  const { data: stats, isLoading } = useDashboardStats();

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setView("my")}>
          My View →
        </Button>
      </div>

      {/* Billing Pulse hero */}
      {show("billing-pulse") && <BillingPulse scope="company" />}

      {/* Proposals Pipeline by Stage */}
      {show("proposals-pipeline") && <ProposalsPipelineCard />}

      {/* Monthly conversion rates */}
      {show("proposal-conversion-rates") && <ProposalConversionTable />}


      {/* Revenue Trend (unified) */}
      {show("revenue-trend") && <RevenueTrendChart defaultMode="6" />}

      {/* Upcoming Billing Pipeline (collapsed) */}
      {show("billing-pipeline") && (
        <Collapsible>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Upcoming Billing Pipeline</CardTitle>
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
      )}

      {/* KPIs (compact) */}
      {show("kpis") && (
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
      )}

      {/* Proposal Activity */}
      {show("yoy-proposals-followups") && <ProposalActivityCard />}

      {/* Team utilization + projects by PM */}
      {show("team-utilization") && <TeamUtilizationStrip />}

      {/* Follow-Ups full width */}
      {show("yoy-proposals-followups") && <ProposalFollowUps />}

      {/* Expense Approvals */}
      <ExpenseApprovalsCard />

      {/* Team Overview */}
      {show("team-overview") && <TeamOverview />}
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
          <CardTitle className="text-base">Team Utilization (This Week)</CardTitle>
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
          <CardTitle className="text-base">Projects by PM</CardTitle>
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
