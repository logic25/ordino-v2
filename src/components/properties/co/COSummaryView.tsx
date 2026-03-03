import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  CheckCircle2, Clock, AlertTriangle, FileDown, Mail, FileText,
  BarChart3, Radio, ArrowRight, Plus, Trash2,
  TrendingUp, TrendingDown, ShieldAlert, ArrowUpRight, ArrowDownRight,
  CalendarClock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { COApplication, COViolation, COSignOff, ReportSnapshot } from "./coMockData";
import {
  WORK_TYPE_LABELS, WORK_TYPE_COLORS, STATUS_COLORS,
  MOCK_SIGN_OFFS, MOCK_WORK_TYPE_BREAKDOWN, TCO_REQUIREMENTS,
  MOCK_PREVIOUS_REPORT,
} from "./coMockData";

interface COSummaryViewProps {
  applications: COApplication[];
  violations: COViolation[];
  propertyAddress: string;
  block?: string | null;
  lot?: string | null;
  onFilterWorkType: (wt: string) => void;
  lastSynced: string | null;
}

interface NextStep {
  id: string;
  text: string;
  priority: "High" | "Medium" | "Low";
}

export function COSummaryView({
  applications, violations, propertyAddress, block, lot, onFilterWorkType, lastSynced,
}: COSummaryViewProps) {
  const { toast } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<"CO" | "TCO">("CO");
  const [lastReportDate, setLastReportDate] = useState<string | null>(MOCK_PREVIOUS_REPORT.ranAt);
  const [previousSnapshot, setPreviousSnapshot] = useState<ReportSnapshot | null>(MOCK_PREVIOUS_REPORT);
  const [nextSteps, setNextSteps] = useState<NextStep[]>([]);
  const [newStepText, setNewStepText] = useState("");
  // Report metadata
  const [reportReceivedFrom, setReportReceivedFrom] = useState(MOCK_PREVIOUS_REPORT.receivedFrom);
  const [reportReceivedDate, setReportReceivedDate] = useState(MOCK_PREVIOUS_REPORT.receivedDate);
  const [reportNotes, setReportNotes] = useState(MOCK_PREVIOUS_REPORT.notes);

  const totalApps = applications.length;
  const closedApps = applications.filter(a => a.status === "Signed Off").length;
  const openApps = totalApps - closedApps;
  const appPct = totalApps > 0 ? Math.round((closedApps / totalApps) * 100) : 0;

  const totalViols = violations.length;
  const resolvedViols = violations.filter(v => v.status === "Resolved" || v.status === "Dismissed").length;
  const activeViols = totalViols - resolvedViols;
  const violPct = totalViols > 0 ? Math.round((resolvedViols / totalViols) * 100) : 0;

  const signOffs = MOCK_SIGN_OFFS;
  const completedSignOffs = signOffs.filter(s => s.status === "Signed Off").length;
  const pendingSignOffs = signOffs.filter(s => s.status !== "Signed Off");
  const signOffPct = signOffs.length > 0 ? Math.round((completedSignOffs / signOffs.length) * 100) : 0;

  // Expiring sign-offs (within 6 months)
  const expiringSignOffs = signOffs.filter(s => {
    if (!s.expirationDate) return false;
    const exp = new Date(s.expirationDate);
    const sixMonths = new Date();
    sixMonths.setMonth(sixMonths.getMonth() + 6);
    return exp <= sixMonths && s.status === "Signed Off";
  });

  // TCO-specific
  const tcoSignOffs = signOffs.filter(s => s.tcoRequired);
  const tcoComplete = tcoSignOffs.filter(s => s.status === "Signed Off").length;
  const tcoPending = tcoSignOffs.filter(s => s.status !== "Signed Off");

  // Action summary
  const needsLOC = applications.filter(a => a.action.toLowerCase().includes("loc")).length;
  const needsFDNY = applications.filter(a => a.action.toLowerCase().includes("fdny")).length;
  const needsCostAffidavit = applications.filter(a => a.action.toLowerCase().includes("cost affidavit")).length;
  const withdrawalCandidates = applications.filter(a => a.action.toLowerCase().includes("withdraw")).length;

  // Status changes since last report
  const changedApps = useMemo(() =>
    applications.filter(a => a.previousStatus && a.previousStatus !== a.status),
    [applications]
  );
  const changedViols = useMemo(() =>
    violations.filter(v => v.previousStatus && v.previousStatus !== v.status),
    [violations]
  );

  // Work type totals
  const totalWorkItems = MOCK_WORK_TYPE_BREAKDOWN.reduce((s, r) => s + r.total, 0);
  const totalClosed = MOCK_WORK_TYPE_BREAKDOWN.reduce((s, r) => s + r.closed, 0);
  const totalOpen = totalWorkItems - totalClosed;
  const overallPct = totalWorkItems > 0 ? Math.round((totalClosed / totalWorkItems) * 100) : 0;
  const estMonths = Math.ceil(totalOpen / 40);

  const highPenaltyViols = violations.filter(v => (v.penalty || 0) >= 2500);

  // Delta calculations from previous report
  const appDelta = previousSnapshot ? (totalWorkItems - previousSnapshot.totalApps) : null;
  const openAppDelta = previousSnapshot ? (totalOpen - previousSnapshot.openApps) : null;
  const closedAppDelta = previousSnapshot ? (totalClosed - previousSnapshot.closedApps) : null;
  const violDelta = previousSnapshot ? (activeViols - previousSnapshot.activeViols) : null;

  // Auto-populate next steps
  const handleOpenReport = () => {
    const auto: NextStep[] = [];
    if (needsLOC > 0) auto.push({ id: "loc", text: `Submit LOC for ${needsLOC} applications`, priority: "High" });
    if (needsFDNY > 0) auto.push({ id: "fdny", text: `Obtain FDNY LOA for ${needsFDNY} applications`, priority: "High" });
    if (needsCostAffidavit > 0) auto.push({ id: "cost", text: `Submit cost affidavit for ${needsCostAffidavit} applications`, priority: "Medium" });
    if (withdrawalCandidates > 0) auto.push({ id: "withdraw", text: `Process ${withdrawalCandidates} withdrawal candidates`, priority: "Low" });
    if (activeViols > 0) auto.push({ id: "viols", text: `Resolve ${activeViols} active violations`, priority: "High" });
    if (tcoPending.length > 0) auto.push({ id: "tco", text: `Obtain ${tcoPending.length} pending sign-offs for TCO eligibility`, priority: "High" });
    if (expiringSignOffs.length > 0) auto.push({ id: "expiring", text: `Renew ${expiringSignOffs.length} sign-offs expiring within 6 months`, priority: "High" });
    setNextSteps(auto);
    setReportOpen(true);
  };

  const addStep = () => {
    if (!newStepText.trim()) return;
    setNextSteps(prev => [...prev, { id: Date.now().toString(), text: newStepText.trim(), priority: "Medium" }]);
    setNewStepText("");
  };

  const removeStep = (id: string) => {
    setNextSteps(prev => prev.filter(s => s.id !== id));
  };

  const handleGenerateReport = () => {
    const now = new Date().toISOString();
    const snapshot: ReportSnapshot = {
      ranAt: now,
      openApps: totalOpen,
      closedApps: totalClosed,
      totalApps: totalWorkItems,
      activeViols,
      resolvedViols,
      totalViols,
      receivedFrom: reportReceivedFrom,
      receivedDate: reportReceivedDate,
      notes: reportNotes,
    };
    setPreviousSnapshot(snapshot);
    setLastReportDate(now);
    setReportOpen(false);
    toast({ title: "Report generated", description: `Snapshot saved at ${format(new Date(now), "MMM d, yyyy h:mm a")}. Changes will be tracked from this point.` });
  };

  // Delta indicator component
  const DeltaIndicator = ({ value, inverse = false }: { value: number | null; inverse?: boolean }) => {
    if (value === null || value === 0) return null;
    const isPositive = value > 0;
    const isGood = inverse ? !isPositive : isPositive;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isGood ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(value)}
      </span>
    );
  };

  // Circular progress ring SVG
  const ProgressRing = ({ percent, size = 80, stroke = 6, label }: { percent: number; size?: number; stroke?: number; label: string }) => {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (percent / 100) * circ;
    return (
      <div className="flex flex-col items-center gap-1">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-500" />
        </svg>
        <span className="text-lg font-bold -mt-[calc(50%+12px)] mb-[calc(50%-12px)]">{percent}%</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    );
  };

  const displaySignOffs = reportType === "TCO" ? tcoSignOffs : signOffs;

  return (
    <div className="space-y-6">
      {/* Delta Cards — change since last report */}
      {previousSnapshot && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Open Applications</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{totalOpen.toLocaleString()}</span>
              <DeltaIndicator value={openAppDelta} inverse />
            </div>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Closed Applications</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{totalClosed.toLocaleString()}</span>
              <DeltaIndicator value={closedAppDelta} />
            </div>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Active Violations</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{activeViols}</span>
              <DeltaIndicator value={violDelta} inverse />
            </div>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Last Report</p>
            <p className="text-sm font-medium">{format(new Date(previousSnapshot.ranAt), "MMM d, yyyy")}</p>
            <p className="text-xs text-muted-foreground">{format(new Date(previousSnapshot.ranAt), "h:mm a")}</p>
          </div>
        </div>
      )}

      {/* Progress Overview Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 flex items-center gap-4">
          <ProgressRing percent={overallPct} label="Applications" />
          <div className="flex-1">
            <p className="text-sm font-medium">{totalClosed.toLocaleString()} / {totalWorkItems.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{totalOpen.toLocaleString()} open remaining</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> ~{estMonths} months at current rate
            </p>
          </div>
        </div>
        <div className="rounded-lg border p-4 flex items-center gap-4">
          <ProgressRing percent={violPct} label="Violations" />
          <div className="flex-1">
            <p className="text-sm font-medium">{resolvedViols} / {totalViols}</p>
            <p className="text-xs text-muted-foreground">{activeViols} active remaining</p>
            {highPenaltyViols.length > 0 && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> {highPenaltyViols.length} with penalties ≥$2,500
              </p>
            )}
          </div>
        </div>
        <div className="rounded-lg border p-4 flex items-center gap-4">
          <ProgressRing percent={signOffPct} label="Sign-Offs" />
          <div className="flex-1">
            <p className="text-sm font-medium">{completedSignOffs} / {signOffs.length}</p>
            <p className="text-xs text-muted-foreground">{pendingSignOffs.length} pending</p>
            {expiringSignOffs.length > 0 && (
              <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                <CalendarClock className="h-3 w-3" /> {expiringSignOffs.length} expiring soon
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Status Changes Banner */}
      {lastReportDate && (changedApps.length > 0 || changedViols.length > 0) && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-green-600" />
            Changes Since Last Report ({format(new Date(lastReportDate), "MMM d, yyyy h:mm a")})
          </h4>
          <div className="flex flex-wrap gap-2">
            {changedApps.map(a => (
              <div key={a.jobNum} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                <span className="font-mono">#{a.jobNum}</span>
                <Badge variant="outline" className={`text-[10px] px-1 py-0 ${STATUS_COLORS[a.previousStatus!] || ""}`}>{a.previousStatus}</Badge>
                <ArrowRight className="h-3 w-3" />
                <Badge variant="outline" className={`text-[10px] px-1 py-0 ${STATUS_COLORS[a.status] || ""}`}>{a.status}</Badge>
              </div>
            ))}
            {changedViols.map(v => (
              <div key={v.violationNum} className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                <span className="font-mono">{v.violationNum.slice(0, 12)}…</span>
                <Badge variant="outline" className={`text-[10px] px-1 py-0 ${STATUS_COLORS[v.previousStatus!] || ""}`}>{v.previousStatus}</Badge>
                <ArrowRight className="h-3 w-3" />
                <Badge variant="outline" className={`text-[10px] px-1 py-0 ${STATUS_COLORS[v.status] || ""}`}>{v.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Required Sign-Offs Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Required Sign-Offs</h4>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleOpenReport}>
            <FileText className="h-3.5 w-3.5" /> Generate CO Report
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {signOffs.map((so) => {
            const isComplete = so.status === "Signed Off";
            const isPending = so.status === "Pending";
            const isExpiring = isComplete && so.expirationDate && new Date(so.expirationDate) <= new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);
            return (
              <div key={so.name} className={`rounded-lg border p-3 flex items-center gap-3 ${isExpiring ? "border-orange-500/30 bg-orange-500/5" : isComplete ? "border-green-500/30 bg-green-500/5" : isPending ? "border-red-500/30 bg-red-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
                {isExpiring ? (
                  <CalendarClock className="h-4 w-4 text-orange-600 shrink-0" />
                ) : isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : isPending ? (
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-yellow-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium">{so.name}</p>
                    {so.tcoRequired && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-500/10 text-blue-700 border-blue-500/20">TCO</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isComplete ? `Signed Off${so.date ? ` (${so.date})` : ""}` : so.status}
                    {so.jobNum && <span className="ml-1 font-mono">#{so.jobNum}</span>}
                  </p>
                  {so.expirationDate && isComplete && (
                    <p className={`text-[10px] mt-0.5 ${isExpiring ? "text-orange-600 font-medium" : "text-muted-foreground"}`}>
                      {isExpiring ? "⚠ " : ""}Expires: {so.expirationDate}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Work Type Breakdown */}
        <div className="lg:col-span-2 space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" /> Work Type Breakdown
          </h4>
          <div className="grid sm:grid-cols-2 gap-2">
            {MOCK_WORK_TYPE_BREAKDOWN.map((row) => {
              const pct = Math.round((row.closed / row.total) * 100);
              return (
                <div
                  key={row.workType}
                  className="rounded-lg border p-3 cursor-pointer hover:bg-accent/5 transition-colors"
                  onClick={() => onFilterWorkType(row.workType)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={WORK_TYPE_COLORS[row.workType]}>
                        {row.workType}
                      </Badge>
                      <span className="text-sm font-medium">{WORK_TYPE_LABELS[row.workType]}</span>
                    </div>
                    <span className="text-sm font-bold">{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5 mb-1.5" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{row.open} open</span>
                    <span>{row.closed} closed / {row.total} total</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Summary */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Action Summary</h4>
          <div className="space-y-2">
            {[
              { label: "Applications needing LOC", count: needsLOC, color: "text-blue-600" },
              { label: "Applications needing FDNY LOA", count: needsFDNY, color: "text-orange-600" },
              { label: "Needing cost affidavit", count: needsCostAffidavit, color: "text-purple-600" },
              { label: "Withdrawal candidates", count: withdrawalCandidates, color: "text-muted-foreground" },
              { label: "Active violations", count: activeViols, color: "text-red-600" },
              { label: "Sign-offs expiring soon", count: expiringSignOffs.length, color: "text-orange-600" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                <span className="text-sm">{item.label}</span>
                <span className={`text-lg font-bold ${item.color}`}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CO Report Modal */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" /> CO Status Report
            </DialogTitle>
            <DialogDescription>{propertyAddress} — {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</DialogDescription>
          </DialogHeader>

          {/* Report Metadata — who it's from, when received */}
          <div className="grid sm:grid-cols-2 gap-3 rounded-lg border p-4 bg-muted/20">
            <div className="space-y-1.5">
              <Label className="text-xs">Report Requested By</Label>
              <Input
                value={reportReceivedFrom}
                onChange={(e) => setReportReceivedFrom(e.target.value)}
                placeholder="Owner / management company name"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date Received</Label>
              <Input
                type="date"
                value={reportReceivedDate}
                onChange={(e) => setReportReceivedDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Report Notes</Label>
              <Textarea
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="Context for this report (e.g., 'Owner requested ahead of Q1 board meeting')"
                rows={2}
                className="text-sm"
              />
            </div>
          </div>

          {/* CO / TCO Toggle */}
          <Tabs value={reportType} onValueChange={(v) => setReportType(v as "CO" | "TCO")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="CO">Certificate of Occupancy (CO)</TabsTrigger>
              <TabsTrigger value="TCO">Temporary CO (TCO)</TabsTrigger>
            </TabsList>

            <TabsContent value="CO" className="mt-3">
              <div className="rounded-lg border p-3 bg-muted/30 text-sm">
                <p className="font-medium mb-1">Full CO Requirements</p>
                <p className="text-muted-foreground">All applications must be closed, all violations resolved, and all sign-offs obtained before a full Certificate of Occupancy can be issued.</p>
              </div>
            </TabsContent>
            <TabsContent value="TCO" className="mt-3 space-y-3">
              <div className="rounded-lg border p-3 bg-blue-500/5 border-blue-500/20 text-sm">
                <p className="font-medium mb-1">TCO Requirements — Life Safety Priority</p>
                <p className="text-muted-foreground mb-2">A Temporary CO requires completion of critical life-safety sign-offs. The following items can be deferred with a Letter of No Objection:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {TCO_REQUIREMENTS.map(req => (
                    <div key={req.name} className="flex items-center gap-2 text-xs">
                      {req.required ? (
                        <ShieldAlert className="h-3 w-3 text-red-500 shrink-0" />
                      ) : (
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <span className={req.required ? "font-medium" : "text-muted-foreground"}>
                        {req.name}
                        {!req.required && " (deferrable)"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium mb-1">TCO Sign-Off Progress</p>
                <p className="text-muted-foreground">{tcoComplete} of {tcoSignOffs.length} required sign-offs complete. {tcoPending.length} pending.</p>
                <Progress value={tcoSignOffs.length > 0 ? Math.round((tcoComplete / tcoSignOffs.length) * 100) : 0} className="h-1.5 mt-2" />
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-4 text-sm">
            {/* Delta Summary Cards in Report */}
            {previousSnapshot && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Open Apps</p>
                  <p className="text-lg font-bold">{totalOpen.toLocaleString()}</p>
                  <DeltaIndicator value={openAppDelta} inverse />
                </div>
                <div className="rounded-lg border p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Closed</p>
                  <p className="text-lg font-bold">{totalClosed.toLocaleString()}</p>
                  <DeltaIndicator value={closedAppDelta} />
                </div>
                <div className="rounded-lg border p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Active Viols</p>
                  <p className="text-lg font-bold">{activeViols}</p>
                  <DeltaIndicator value={violDelta} inverse />
                </div>
                <div className="rounded-lg border p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Overall</p>
                  <p className="text-lg font-bold">{overallPct}%</p>
                  <span className="text-xs text-muted-foreground">complete</span>
                </div>
              </div>
            )}

            {/* Executive Summary */}
            <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
              <h4 className="font-semibold">Executive Summary</h4>
              <p>
                This property has <strong>{totalOpen.toLocaleString()} open applications</strong> and <strong>{activeViols} active violations</strong>.{" "}
                {totalClosed.toLocaleString()} applications have been closed ({overallPct}% complete).
              </p>
              <p>
                Based on current close-out rate, estimated completion is <strong>~{estMonths} months</strong>.
              </p>
              {reportType === "CO" && pendingSignOffs.length > 0 && (
                <p>
                  The following sign-offs are still required for CO issuance:{" "}
                  <strong>{pendingSignOffs.map(s => s.name).join(", ")}</strong>.
                </p>
              )}
              {reportType === "TCO" && tcoPending.length > 0 && (
                <p>
                  The following life-safety sign-offs are still required for TCO issuance:{" "}
                  <strong>{tcoPending.map(s => s.name).join(", ")}</strong>.
                </p>
              )}
              {expiringSignOffs.length > 0 && (
                <p className="flex items-center gap-1.5 text-orange-700">
                  <CalendarClock className="h-3.5 w-3.5" />
                  <strong>{expiringSignOffs.length} sign-offs</strong> are expiring within 6 months and must be renewed.
                </p>
              )}
              {needsFDNY > 0 && (
                <p className="flex items-center gap-1.5 text-orange-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <strong>{needsFDNY} applications</strong> are blocked waiting for FDNY LOA.
                </p>
              )}
              {highPenaltyViols.length > 0 && (
                <p className="flex items-center gap-1.5 text-red-700">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <strong>{highPenaltyViols.length} violations</strong> have penalties exceeding $2,500.
                </p>
              )}
              {/* BIS open items summary */}
              {(() => {
                const totalBisItems = applications.reduce((sum, a) => sum + (a.bisOpenItems?.filter(i => !i.resolved).length || 0), 0);
                const appsWithBis = applications.filter(a => a.bisOpenItems && a.bisOpenItems.some(i => !i.resolved)).length;
                return totalBisItems > 0 ? (
                  <p className="flex items-center gap-1.5 text-purple-700">
                    <FileText className="h-3.5 w-3.5" />
                    <strong>{totalBisItems} open BIS items</strong> across {appsWithBis} applications require attention.
                  </p>
                ) : null;
              })()}
            </div>

            {/* Status Changes Since Last Report */}
            {lastReportDate && (changedApps.length > 0 || changedViols.length > 0) && (
              <div className="rounded-lg border p-4 border-green-500/30 bg-green-500/5 space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                  Changes Since Last Report ({format(new Date(lastReportDate), "MMM d, yyyy h:mm a")})
                </h4>
                {changedApps.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Applications ({changedApps.length})</p>
                    {changedApps.map(a => (
                      <div key={a.jobNum} className="flex items-center gap-2 py-1">
                        <span className="font-mono text-xs">#{a.jobNum}</span>
                        <span className="text-xs truncate flex-1">{a.desc.slice(0, 50)}…</span>
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${STATUS_COLORS[a.previousStatus!]}`}>{a.previousStatus}</Badge>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${STATUS_COLORS[a.status]}`}>{a.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                {changedViols.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Violations ({changedViols.length})</p>
                    {changedViols.map(v => (
                      <div key={v.violationNum} className="flex items-center gap-2 py-1">
                        <span className="font-mono text-xs">{v.violationNum}</span>
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${STATUS_COLORS[v.previousStatus!]}`}>{v.previousStatus}</Badge>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${STATUS_COLORS[v.status]}`}>{v.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sign-Offs Table with Expiration */}
            <div className="space-y-2">
              <h4 className="font-semibold">{reportType === "TCO" ? "TCO " : ""}Required Sign-Offs</h4>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Sign-Off</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displaySignOffs.map((so) => {
                      const isExpiring = so.expirationDate && so.status === "Signed Off" && new Date(so.expirationDate) <= new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);
                      return (
                        <TableRow key={so.name}>
                          <TableCell className="font-medium">{so.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {so.category || "general"}
                            </Badge>
                          </TableCell>
                          <TableCell><Badge variant="outline" className={STATUS_COLORS[so.status] || ""}>{so.status}</Badge></TableCell>
                          <TableCell>{so.date || "—"}</TableCell>
                          <TableCell>
                            {so.expirationDate ? (
                              <span className={isExpiring ? "text-orange-600 font-medium" : ""}>
                                {isExpiring && "⚠ "}{so.expirationDate}
                              </span>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Work Type Summary */}
            <div className="space-y-2">
              <h4 className="font-semibold">Applications by Work Type</h4>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Work Type</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                      <TableHead className="text-right">Closed</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_WORK_TYPE_BREAKDOWN.map((row) => {
                      const pct = Math.round((row.closed / row.total) * 100);
                      return (
                        <TableRow key={row.workType}>
                          <TableCell>
                            <Badge variant="outline" className={WORK_TYPE_COLORS[row.workType]}>{row.workType}</Badge>
                            <span className="ml-2">{WORK_TYPE_LABELS[row.workType]}</span>
                          </TableCell>
                          <TableCell className="text-right font-medium">{row.open}</TableCell>
                          <TableCell className="text-right">{row.closed}</TableCell>
                          <TableCell className="text-right">{row.total}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={pct} className="h-1.5 flex-1" />
                              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Recommended Next Steps */}
            <div className="space-y-2">
              <h4 className="font-semibold">Recommended Next Steps</h4>
              <div className="space-y-1.5">
                {nextSteps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[step.priority]}`}>{step.priority}</Badge>
                    <span className="text-sm flex-1">{step.text}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeStep(step.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a next step..."
                  value={newStepText}
                  onChange={(e) => setNewStepText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStep()}
                  className="text-sm"
                />
                <Button variant="outline" size="sm" onClick={addStep} disabled={!newStepText.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Report Footer */}
            <div className="rounded-lg border p-3 bg-muted/20 text-xs text-muted-foreground space-y-1">
              <p>Prepared via <strong>CitiSignal</strong> · {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</p>
              {reportReceivedFrom && <p>Requested by: <strong>{reportReceivedFrom}</strong>{reportReceivedDate ? ` (received ${format(new Date(reportReceivedDate), "MMM d, yyyy")})` : ""}</p>}
              {reportNotes && <p>Notes: {reportNotes}</p>}
              <p>Data sourced from NYC Open Data — DOB Job Filings, DOB NOW Build, DOB Violations</p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast({ title: "Coming soon", description: "PDF generation will be available in Phase 7." })}>
              <FileDown className="h-3.5 w-3.5" /> Download PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast({ title: "Coming soon", description: "Word export will be available in Phase 7." })}>
              <FileDown className="h-3.5 w-3.5" /> Download Word
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast({ title: "Coming soon", description: "Email delivery will be available in Phase 7." })}>
              <Mail className="h-3.5 w-3.5" /> Send to Owner
            </Button>
            <Button size="sm" className="gap-1.5 ml-auto" onClick={handleGenerateReport}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Save Report Snapshot
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-red-500/10 text-red-700 border-red-500/20",
  Medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  Low: "bg-muted text-muted-foreground",
};
