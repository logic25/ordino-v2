import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  CheckCircle2, Clock, AlertTriangle, FileDown, Mail, FileText,
  BarChart3, Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { COApplication, COViolation, COSignOff } from "./coMockData";
import {
  WORK_TYPE_LABELS, WORK_TYPE_COLORS, STATUS_COLORS,
  MOCK_SIGN_OFFS, MOCK_WORK_TYPE_BREAKDOWN,
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

export function COSummaryView({
  applications, violations, propertyAddress, block, lot, onFilterWorkType, lastSynced,
}: COSummaryViewProps) {
  const { toast } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportNotes, setReportNotes] = useState("");

  const totalApps = applications.length;
  const closedApps = applications.filter(a => a.status === "Signed Off").length;
  const openApps = totalApps - closedApps;
  const appPct = totalApps > 0 ? Math.round((closedApps / totalApps) * 100) : 0;

  const totalViols = violations.length;
  const resolvedViols = violations.filter(v => v.status === "Resolved" || v.status === "Dismissed").length;
  const activeViols = totalViols - resolvedViols;
  const violPct = totalViols > 0 ? Math.round((resolvedViols / totalViols) * 100) : 0;

  const signOffs = MOCK_SIGN_OFFS;
  const pendingSignOffs = signOffs.filter(s => s.status !== "Signed Off");

  // Action summary counts
  const needsLOC = applications.filter(a => a.action.toLowerCase().includes("loc")).length;
  const needsFDNY = applications.filter(a => a.action.toLowerCase().includes("fdny")).length;
  const needsCostAffidavit = applications.filter(a => a.action.toLowerCase().includes("cost affidavit")).length;
  const withdrawalCandidates = applications.filter(a => a.action.toLowerCase().includes("withdraw")).length;

  return (
    <div className="space-y-6">
      {/* Property Summary Card */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" /> {propertyAddress}
            </h3>
            <p className="text-sm text-muted-foreground">
              {block && `Block ${block}`}{block && lot && " / "}{lot && `Lot ${lot}`}
              {lastSynced && ` · Last synced: ${lastSynced}`}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReportOpen(true)}>
            <FileText className="h-3.5 w-3.5" /> Generate CO Report
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Applications Closed</span>
              <span className="font-medium">{closedApps} / {totalApps} ({appPct}%)</span>
            </div>
            <Progress value={appPct} className="h-2" />
            <p className="text-xs text-muted-foreground">{openApps} open applications remaining</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Violations Resolved</span>
              <span className="font-medium">{resolvedViols} / {totalViols} ({violPct}%)</span>
            </div>
            <Progress value={violPct} className="h-2" />
            <p className="text-xs text-muted-foreground">{activeViols} active violations remaining</p>
          </div>
        </div>
      </div>

      {/* Required Sign-Offs Grid */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Required Sign-Offs</h4>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {signOffs.map((so) => {
            const isComplete = so.status === "Signed Off";
            const isPending = so.status === "Pending";
            return (
              <div key={so.name} className={`rounded-lg border p-3 flex items-center gap-3 ${isComplete ? "border-green-500/30 bg-green-500/5" : isPending ? "border-red-500/30 bg-red-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : isPending ? (
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                ) : (
                  <Clock className="h-4 w-4 text-yellow-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{so.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {isComplete ? `Signed Off${so.date ? ` (${so.date})` : ""}` : so.status}
                    {so.jobNum && <span className="ml-1 font-mono">#{so.jobNum}</span>}
                  </p>
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
                    <TableRow key={row.workType} className="cursor-pointer hover:bg-accent/5" onClick={() => onFilterWorkType(row.workType)}>
                      <TableCell>
                        <Badge variant="outline" className={WORK_TYPE_COLORS[row.workType]}>
                          {row.workType}
                        </Badge>
                        <span className="ml-2 text-sm">{WORK_TYPE_LABELS[row.workType]}</span>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">{row.open}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{row.closed}</TableCell>
                      <TableCell className="text-right text-sm">{row.total}</TableCell>
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

        {/* Action Summary */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Action Summary</h4>
          <div className="space-y-2">
            {[
              { label: "Applications needing LOC", count: needsLOC, color: "text-blue-600" },
              { label: "Applications needing FDNY LOA", count: needsFDNY, color: "text-orange-600" },
              { label: "Applications needing cost affidavit", count: needsCostAffidavit, color: "text-purple-600" },
              { label: "Withdrawal candidates", count: withdrawalCandidates, color: "text-muted-foreground" },
              { label: "Active violations", count: activeViols, color: "text-red-600" },
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>CO Status Report Preview</DialogTitle>
            <DialogDescription>{propertyAddress} — {new Date().toLocaleDateString()}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
              <h4 className="font-semibold">Executive Summary</h4>
              <p>
                This property has <strong>{openApps} open applications</strong> and <strong>{activeViols} active violations</strong>.{" "}
                {closedApps} applications have been closed ({appPct}% complete).
                The following sign-offs are still required for CO issuance:{" "}
                <strong>{pendingSignOffs.map(s => s.name).join(", ")}</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Required Sign-Offs</h4>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50"><TableHead>Sign-Off</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {signOffs.map((so) => (
                      <TableRow key={so.name}>
                        <TableCell className="font-medium">{so.name}</TableCell>
                        <TableCell><Badge variant="outline" className={STATUS_COLORS[so.status] || ""}>{so.status}</Badge></TableCell>
                        <TableCell>{so.date || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Applications by Work Type</h4>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50"><TableHead>Work Type</TableHead><TableHead className="text-right">Open</TableHead><TableHead className="text-right">Closed</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_WORK_TYPE_BREAKDOWN.map((row) => (
                      <TableRow key={row.workType}>
                        <TableCell>{row.workType} — {WORK_TYPE_LABELS[row.workType]}</TableCell>
                        <TableCell className="text-right font-medium">{row.open}</TableCell>
                        <TableCell className="text-right">{row.closed}</TableCell>
                        <TableCell className="text-right">{row.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Recommended Next Steps</h4>
              <Textarea value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} rows={4} placeholder="Add recommendations for the owner before generating the report..." />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast({ title: "Coming soon", description: "PDF generation will be available in Phase 7." })}>
              <FileDown className="h-3.5 w-3.5" /> Download PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast({ title: "Coming soon", description: "Word export will be available in Phase 7." })}>
              <FileDown className="h-3.5 w-3.5" /> Download Word
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 ml-auto" onClick={() => toast({ title: "Coming soon", description: "Email delivery will be available in Phase 7." })}>
              <Mail className="h-3.5 w-3.5" /> Send to Owner
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
