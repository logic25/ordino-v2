import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOperationsReports } from "@/hooks/useReports";
import { useServiceDurationReports } from "@/hooks/useServiceDurationReports";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import { subMonths, startOfMonth, format, differenceInDays } from "date-fns";
import { AlertTriangle, Clock, DollarSign, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

function useOperationsTrends() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["operations-trends", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data: projects } = await supabase.from("projects").select("id, status, created_at, updated_at");
      const now = new Date();
      const items = projects || [];

      const completionTrend: { month: string; completed: number; total: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = startOfMonth(subMonths(now, i));
        const label = format(d, "MMM yy");
        const created = items.filter((p: any) => format(startOfMonth(new Date(p.created_at)), "MMM yy") === label);
        const closed = items.filter((p: any) => p.status === "closed" && p.updated_at && format(startOfMonth(new Date(p.updated_at)), "MMM yy") === label);
        completionTrend.push({ month: label, completed: closed.length, total: created.length });
      }

      const stalled = items
        .filter((p: any) => p.status === "open" && p.updated_at && differenceInDays(now, new Date(p.updated_at)) > 30)
        .map((p: any) => ({ id: p.id, daysSinceUpdate: differenceInDays(now, new Date(p.updated_at)) }))
        .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
        .slice(0, 10);

      return { completionTrend, stalled };
    },
  });
}

export default function OperationsReports() {
  const { data, isLoading } = useOperationsReports();
  const { data: trends, isLoading: trendsLoading } = useOperationsTrends();
  const { data: svcData, isLoading: svcLoading } = useServiceDurationReports();
  const [trendService, setTrendService] = useState<string>("all");
  const [pmService, setPmService] = useState<string>("all");

  if (isLoading || trendsLoading || svcLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (!data) return null;

  const filteredPmStats = svcData?.pmStats.filter(
    (s) => pmService === "all" || s.serviceType === pmService
  ) || [];

  return (
    <div className="space-y-6">
      {/* ── Service Duration Analytics ── */}
      {svcData && svcData.summaryStats.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Service Duration Analytics</h2>
          </div>

          {/* Summary Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Duration by Service Type</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Type</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Median Days</TableHead>
                    <TableHead className="text-right">Avg Days</TableHead>
                    <TableHead className="text-right">P75</TableHead>
                    <TableHead className="text-right">P90</TableHead>
                    <TableHead className="text-right">Fastest</TableHead>
                    <TableHead className="text-right">Slowest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {svcData.summaryStats.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">
                        {s.name}
                        {s.lowSample && (
                          <Badge variant="outline" className="ml-2 text-xs">Low sample</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                      <TableCell className="text-right font-semibold">{s.median}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{s.avg}</TableCell>
                      <TableCell className="text-right">{s.p75}</TableCell>
                      <TableCell className="text-right">{s.p90}</TableCell>
                      <TableCell className="text-right text-primary">{s.min}</TableCell>
                      <TableCell className="text-right text-destructive">{s.max}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Duration Trend Chart */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Duration Trend (Monthly Median)
                  </CardTitle>
                  <Select value={trendService} onValueChange={setTrendService}>
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      {svcData.serviceTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const types = trendService === "all"
                    ? svcData.serviceTypes.slice(0, 5)
                    : [trendService];
                  const colors = ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#10b981", "#8b5cf6"];
                  // Build unified data
                  const months = svcData.trendData[types[0]]?.map((p) => p.month) || [];
                  const chartData = months.map((month, i) => {
                    const point: any = { month };
                    types.forEach((t) => {
                      const val = svcData.trendData[t]?.[i]?.median;
                      point[t] = val && val > 0 ? val : null;
                    });
                    return point;
                  });
                  return (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} label={{ value: "Days", angle: -90, position: "insideLeft", fontSize: 11 }} />
                        <Tooltip />
                        {types.length > 1 && <Legend />}
                        {types.map((t, idx) => (
                          <Line
                            key={t}
                            type="monotone"
                            dataKey={t}
                            stroke={colors[idx % colors.length]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  );
                })()}
              </CardContent>
            </Card>

            {/* PM Comparison */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    PM Comparison (Median Days)
                  </CardTitle>
                  <Select value={pmService} onValueChange={setPmService}>
                    <SelectTrigger className="w-[160px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      {svcData.serviceTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredPmStats.length > 0 ? (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {filteredPmStats
                      .sort((a, b) => a.median - b.median)
                      .map((pm, i) => (
                        <div key={`${pm.pmId}-${pm.serviceType}-${i}`} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{pm.pmName}</span>
                            {pmService === "all" && (
                              <span className="text-xs text-muted-foreground">{pm.serviceType}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{pm.count} completed</span>
                            <span className={`text-sm font-semibold ${pm.aboveCompanyMedian ? "text-destructive" : "text-foreground"}`}>
                              {pm.median}d
                            </span>
                            {pm.aboveCompanyMedian && (
                              <Badge variant="destructive" className="text-[10px] px-1">Slow</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">No PM data available</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* At-Risk Active Services */}
          {svcData.atRisk.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Active Services at Risk of Delay
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {svcData.atRisk.map((s) => (
                    <div key={s.serviceId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{s.serviceName}</span>
                        <span className="text-xs text-muted-foreground font-mono">{s.projectId.slice(0, 8)}…</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">P75: {s.p75Threshold}d</span>
                        <span className="text-sm text-destructive font-semibold">{s.daysOpen} days open</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />
        </>
      )}

      {/* ── Active Jobs by PM ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Active Jobs by PM
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.teamWorkload.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, data.teamWorkload.length * 40)}>
              <BarChart data={data.teamWorkload} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="active" name="Active" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="upcoming" name="Due Soon" stackId="a" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Users className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Jobs will appear here as projects are assigned to PMs</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Existing Operations Reports ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Clients by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {data.clientActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.clientActivity} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <DollarSign className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Revenue will appear here as invoices are paid</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Team Workload</CardTitle>
          </CardHeader>
          <CardContent>
            {data.teamWorkload.length > 0 ? (
              <div className="space-y-3">
                {data.teamWorkload.map((member, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="font-medium text-foreground">{member.name}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{member.active} active</span>
                      {member.upcoming > 0 && (
                        <span className="text-accent font-medium">{member.upcoming} due soon</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Users className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Workload will appear as projects are assigned</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Project Completion Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trends && trends.completionTrend.some((m) => m.total > 0 || m.completed > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trends.completionTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" name="Created" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
                  <Bar dataKey="completed" name="Completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <TrendingUp className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Trend data will appear as projects are created and closed</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Stalled Projects (30+ days inactive)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trends && trends.stalled.length > 0 ? (
              <div className="space-y-2">
                {trends.stalled.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-foreground font-mono truncate">{p.id.slice(0, 8)}…</span>
                    <span className="text-sm text-destructive font-medium">{p.daysSinceUpdate} days</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">No stalled projects 🎉</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
