import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Search, LayoutGrid, LayoutList, ChevronLeft, ChevronRight,
  Flag, X as XIcon, FileText, CheckCircle2, Clock,
} from "lucide-react";
import { format } from "date-fns";
import type { COApplication } from "./coMockData";
import {
  WORK_TYPE_LABELS, WORK_TYPE_COLORS, STATUS_COLORS, PRIORITY_COLORS,
} from "./coMockData";

interface COApplicationsViewProps {
  applications: COApplication[];
  onUpdateApp: (jobNum: string, updates: Partial<COApplication>) => void;
  initialWorkTypeFilter?: string | null;
}

const WORK_TYPES = ["All", "OT", "PL", "MH", "SP", "FA", "FP", "SG", "EQ"];
const SOURCE_FILTERS = ["All", "Legacy DOB", "DOB NOW Build"];
const STATUS_FILTERS = ["All", "Permit Issued", "Approved", "In Process", "Signed Off", "Plan Exam - Approved"];
const ACTION_FILTERS = ["All", "Needs LOC", "Needs FDNY LOA", "Needs Cost Affidavit", "Needs Plans", "Withdrawal Candidate"];

export function COApplicationsView({ applications, onUpdateApp, initialWorkTypeFilter }: COApplicationsViewProps) {
  const [search, setSearch] = useState("");
  const [workTypeFilter, setWorkTypeFilter] = useState(initialWorkTypeFilter || "All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [selectedApp, setSelectedApp] = useState<COApplication | null>(null);
  const [drawerNotes, setDrawerNotes] = useState("");
  const [drawerAction, setDrawerAction] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      if (workTypeFilter !== "All" && app.workType !== workTypeFilter) return false;
      if (sourceFilter === "Legacy DOB" && app.source !== "DOB_JOB_FILINGS") return false;
      if (sourceFilter === "DOB NOW Build" && app.source !== "DOB_NOW_BUILD") return false;
      if (statusFilter !== "All" && app.status !== statusFilter) return false;
      if (actionFilter !== "All") {
        const a = app.action.toLowerCase();
        if (actionFilter === "Needs LOC" && !a.includes("loc")) return false;
        if (actionFilter === "Needs FDNY LOA" && !a.includes("fdny")) return false;
        if (actionFilter === "Needs Cost Affidavit" && !a.includes("cost affidavit")) return false;
        if (actionFilter === "Needs Plans" && !a.includes("plans")) return false;
        if (actionFilter === "Withdrawal Candidate" && !a.includes("withdraw")) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return app.jobNum.includes(q) || app.desc.toLowerCase().includes(q) || (app.tenant?.toLowerCase().includes(q) ?? false);
      }
      return true;
    });
  }, [applications, workTypeFilter, sourceFilter, statusFilter, actionFilter, search]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const openDrawer = (app: COApplication) => {
    setSelectedApp(app);
    setDrawerNotes(app.notes || "");
    setDrawerAction(app.action);
  };

  const grouped = useMemo(() => {
    const groups: Record<string, COApplication[]> = {};
    filtered.forEach((app) => {
      const key = app.workType;
      if (!groups[key]) groups[key] = [];
      groups[key].push(app);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search job #, description, tenant..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("table")}><LayoutList className="h-4 w-4" /></Button>
            <Button variant={viewMode === "card" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("card")}><LayoutGrid className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Work type chips */}
        <div className="flex flex-wrap gap-1.5">
          {WORK_TYPES.map((wt) => (
            <Button key={wt} variant={workTypeFilter === wt ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => { setWorkTypeFilter(wt); setPage(0); }}>
              {wt === "All" ? "All Types" : `${wt} — ${WORK_TYPE_LABELS[wt] || wt}`}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <select className="text-xs border rounded-md px-2 py-1.5 bg-background" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }}>
            {SOURCE_FILTERS.map((f) => <option key={f}>{f}</option>)}
          </select>
          <select className="text-xs border rounded-md px-2 py-1.5 bg-background" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
            {STATUS_FILTERS.map((f) => <option key={f}>{f}</option>)}
          </select>
          <select className="text-xs border rounded-md px-2 py-1.5 bg-background" value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}>
            {ACTION_FILTERS.map((f) => <option key={f}>{f}</option>)}
          </select>
          <span className="text-xs text-muted-foreground self-center ml-auto">{filtered.length} of {applications.length} applications</span>
        </div>
      </div>

      {/* Table View */}
      {viewMode === "table" && (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">#</TableHead>
                <TableHead>Job #</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="max-w-[280px]">Description</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Work</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="max-w-[200px]">Action Required</TableHead>
                <TableHead>Priority</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((app) => (
                <TableRow key={app.jobNum} className="cursor-pointer hover:bg-accent/5" onClick={() => openDrawer(app)}>
                  <TableCell className="text-xs text-muted-foreground">{app.num}</TableCell>
                  <TableCell className="font-mono text-sm font-medium">{app.jobNum}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={app.source === "DOB_NOW_BUILD" ? "bg-blue-500/10 text-blue-700 border-blue-500/20" : "bg-muted text-muted-foreground"}>
                      {app.source === "DOB_NOW_BUILD" ? "DOB NOW" : "Legacy"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-[280px] truncate">{app.desc}</TableCell>
                  <TableCell className="text-sm">{app.tenant || "—"}</TableCell>
                  <TableCell className="text-sm">{app.floor}</TableCell>
                  <TableCell className="text-xs">{app.jobType}</TableCell>
                  <TableCell><Badge variant="outline" className={WORK_TYPE_COLORS[app.workType] || ""}>{app.workType}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_COLORS[app.status] || ""}>{app.status}</Badge></TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">{app.action}</TableCell>
                  <TableCell><Badge variant="outline" className={PRIORITY_COLORS[app.priority]}>{app.priority}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Card View */}
      {viewMode === "card" && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([wt, apps]) => (
            <div key={wt} className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline" className={WORK_TYPE_COLORS[wt]}>{wt}</Badge>
                {WORK_TYPE_LABELS[wt]} ({apps.length})
              </h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {apps.map((app) => (
                  <div key={app.jobNum} className="rounded-lg border p-3 space-y-2 cursor-pointer hover:bg-accent/5 transition-colors" onClick={() => openDrawer(app)}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium">{app.jobNum}</span>
                      <Badge variant="outline" className={app.source === "DOB_NOW_BUILD" ? "bg-blue-500/10 text-blue-700 border-blue-500/20" : "bg-muted text-muted-foreground text-[10px]"}>
                        {app.source === "DOB_NOW_BUILD" ? "DOB NOW" : "Legacy"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{app.desc}</p>
                    {app.tenant && <p className="text-xs">Tenant: <span className="font-medium">{app.tenant}</span></p>}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={STATUS_COLORS[app.status] || ""} >{app.status}</Badge>
                      <Badge variant="outline" className={PRIORITY_COLORS[app.priority]}>{app.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">{app.action}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {viewMode === "table" && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Application Detail Drawer */}
      <Sheet open={!!selectedApp} onOpenChange={(open) => { if (!open) setSelectedApp(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedApp && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    const idx = filtered.findIndex(a => a.jobNum === selectedApp.jobNum);
                    if (idx > 0) openDrawer(filtered[idx - 1]);
                  }}><ChevronLeft className="h-4 w-4" /></Button>
                  <SheetTitle className="font-mono">Job #{selectedApp.jobNum}</SheetTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    const idx = filtered.findIndex(a => a.jobNum === selectedApp.jobNum);
                    if (idx < filtered.length - 1) openDrawer(filtered[idx + 1]);
                  }}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <SheetDescription>Filed {format(new Date(selectedApp.fileDate), "MMMM d, yyyy")}</SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={selectedApp.source === "DOB_NOW_BUILD" ? "bg-blue-500/10 text-blue-700 border-blue-500/20" : "bg-muted text-muted-foreground"}>
                    {selectedApp.source === "DOB_NOW_BUILD" ? "DOB NOW Build" : "Legacy DOB"}
                  </Badge>
                  <Badge variant="outline" className={WORK_TYPE_COLORS[selectedApp.workType]}>{selectedApp.workType} — {WORK_TYPE_LABELS[selectedApp.workType]}</Badge>
                  <Badge variant="outline">{selectedApp.jobType}</Badge>
                  <Badge variant="outline" className={STATUS_COLORS[selectedApp.status]}>{selectedApp.status}</Badge>
                  <Badge variant="outline" className={PRIORITY_COLORS[selectedApp.priority]}>{selectedApp.priority}</Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="font-medium">{selectedApp.desc}</p>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <span>Tenant: <span className="text-foreground">{selectedApp.tenant || "—"}</span></span>
                    <span>Floor(s): <span className="text-foreground">{selectedApp.floor}</span></span>
                    <span>Doc #: <span className="text-foreground">{selectedApp.docNum || "—"}</span></span>
                    <span>Job Type: <span className="text-foreground">{selectedApp.jobType}</span></span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium">Action Required</label>
                  <Textarea value={drawerAction} onChange={(e) => setDrawerAction(e.target.value)} rows={3} className="text-sm" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea value={drawerNotes} onChange={(e) => setDrawerNotes(e.target.value)} rows={3} placeholder="Add PM notes..." className="text-sm" />
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status History</p>
                  <div className="space-y-2">
                    {[
                      { date: selectedApp.fileDate, event: "Application Filed", icon: FileText },
                      { date: "2020-03-15", event: "Permit Issued", icon: CheckCircle2 },
                      { date: "2024-01-10", event: "Status reviewed by PM", icon: Clock },
                    ].map((h, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <h.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{format(new Date(h.date), "MM/dd/yyyy")}</span>
                        <span>{h.event}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 gap-1.5" onClick={() => {
                    onUpdateApp(selectedApp.jobNum, { status: "Signed Off", action: "Closed out" });
                    setSelectedApp(null);
                  }}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Closed
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => {
                    onUpdateApp(selectedApp.jobNum, { action: "FLAGGED FOR WITHDRAWAL — " + drawerAction });
                    setSelectedApp(null);
                  }}>
                    <Flag className="h-3.5 w-3.5" /> Flag for Withdrawal
                  </Button>
                </div>

                <Button variant="ghost" size="sm" className="w-full gap-1.5" onClick={() => {
                  onUpdateApp(selectedApp.jobNum, { action: drawerAction, notes: drawerNotes });
                  setSelectedApp(null);
                }}>
                  Save & Close
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
