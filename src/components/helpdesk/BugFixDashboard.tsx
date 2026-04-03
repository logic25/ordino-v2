import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Bug, CheckCircle2, Clock, FileCode, TrendingUp } from "lucide-react";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export function BugFixDashboard() {
  const { profile } = useAuth();

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ["bug-dashboard", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from("feature_requests")
        .select("*")
        .eq("company_id", profile.company_id)
        .in("category", ["bug_report", "polish"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const allBugs = allItems.filter((b: any) => b.category === "bug_report");
  const allPolish = allItems.filter((b: any) => b.category === "polish");

  const { data: fixLogs = [] } = useQuery({
    queryKey: ["bug-fix-logs", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data } = await supabase
        .from("bug_fix_log")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const bugsThisWeek = allBugs.filter((b: any) => new Date(b.created_at) >= weekStart);
  const bugsThisMonth = allBugs.filter((b: any) => new Date(b.created_at) >= monthStart);
  const resolvedThisWeek = allBugs.filter((b: any) => b.status === "resolved" && b.resolved_at && new Date(b.resolved_at) >= weekStart);
  const resolvedThisMonth = allBugs.filter((b: any) => b.status === "resolved" && b.resolved_at && new Date(b.resolved_at) >= monthStart);

  // Avg fix time
  const resolvedWithTime = allBugs.filter((b: any) => b.resolution_time_hours != null);
  const avgFixTime = resolvedWithTime.length > 0
    ? Math.round(resolvedWithTime.reduce((sum: number, b: any) => sum + Number(b.resolution_time_hours), 0) / resolvedWithTime.length)
    : null;

  // Fix success rate
  const firstAttemptFixes = fixLogs.filter((l: any) => l.was_first_attempt === true).length;
  const totalFixes = fixLogs.length;
  const successRate = totalFixes > 0 ? Math.round((firstAttemptFixes / totalFixes) * 100) : null;

  // Most common pages
  const pageCounts: Record<string, number> = {};
  allBugs.forEach((b: any) => {
    const match = b.title?.match(/^\[([^\]]+)\]/);
    if (match) pageCounts[match[1]] = (pageCounts[match[1]] || 0) + 1;
  });
  const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Most frequently referenced files
  const fileCounts: Record<string, number> = {};
  allBugs.forEach((b: any) => {
    const files = b.ai_suggested_files || b.files_changed || [];
    files.forEach((f: string) => { fileCounts[f] = (fileCounts[f] || 0) + 1; });
  });
  const topFiles = Object.entries(fileCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Chart: last 8 weeks
  const chartData = Array.from({ length: 8 }, (_, i) => {
    const weekEnd = subDays(now, i * 7);
    const weekBegin = subDays(weekEnd, 7);
    const label = format(weekBegin, "MMM d");
    const submitted = allBugs.filter((b: any) => {
      const d = new Date(b.created_at);
      return d >= weekBegin && d < weekEnd;
    }).length;
    const resolved = allBugs.filter((b: any) => {
      if (!b.resolved_at) return false;
      const d = new Date(b.resolved_at);
      return d >= weekBegin && d < weekEnd;
    }).length;
    return { week: label, submitted, resolved };
  }).reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Bug Fix Metrics</h3>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Bug className="h-5 w-5 mx-auto text-destructive mb-1" />
            <p className="text-2xl font-bold">{bugsThisWeek.length} / {bugsThisMonth.length}</p>
            <p className="text-xs text-muted-foreground">Submitted (week / month)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold">{resolvedThisWeek.length} / {resolvedThisMonth.length}</p>
            <p className="text-xs text-muted-foreground">Fixed (week / month)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold">{avgFixTime !== null ? `${avgFixTime}h` : "—"}</p>
            <p className="text-xs text-muted-foreground">Avg Fix Time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <FileCode className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{successRate !== null ? `${successRate}%` : "—"}</p>
            <p className="text-xs text-muted-foreground">First-Try Success</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Bugs Submitted vs Resolved (8 weeks)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="week" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
              <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="submitted" name="Submitted" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" name="Resolved" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Most Common Pages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Most Reported Pages</CardTitle>
          </CardHeader>
          <CardContent>
            {topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="space-y-2">
                {topPages.map(([page, count]) => (
                  <div key={page} className="flex items-center justify-between">
                    <span className="text-sm">{page}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Most Frequently Broken Files */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Frequently Referenced Files</CardTitle>
          </CardHeader>
          <CardContent>
            {topFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="space-y-2">
                {topFiles.map(([file, count]) => (
                  <div key={file} className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono truncate">{file}</span>
                    <Badge variant="secondary" className="shrink-0">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Fix Log */}
      {fixLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Fix Log</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bug</TableHead>
                  <TableHead>Fixed By</TableHead>
                  <TableHead>First Try?</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixLogs.slice(0, 10).map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm max-w-[200px] truncate">{log.fix_description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.fixed_by || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      {log.was_first_attempt ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <span className="text-xs text-muted-foreground">retry</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.fixed_at ? format(new Date(log.fixed_at), "MMM d") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
