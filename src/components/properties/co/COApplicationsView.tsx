import { useState, useMemo, Fragment } from "react";
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
  Search, LayoutGrid, LayoutList, ChevronLeft, ChevronRight, ChevronDown,
  Flag, FileText, CheckCircle2, Clock, AlertCircle, ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import type { COApplication, BISOpenItem } from "./coMockData";
import {
  WORK_TYPE_LABELS, WORK_TYPE_COLORS, STATUS_COLORS, PRIORITY_COLORS,
} from "./coMockData";
import { type RequiredItem } from "./requiredItemsData";
import { RequiredItemsModal } from "./RequiredItemsModal";

interface COApplicationsViewProps {
  applications: COApplication[];
  onUpdateApp: (jobNum: string, updates: Partial<COApplication>) => void;
  initialWorkTypeFilter?: string | null;
}

const WORK_TYPES = ["All", "OT", "PL", "MH", "SP", "FA", "FP", "SG", "EQ", "EL"];
const SOURCE_FILTERS = ["All", "Legacy DOB", "DOB NOW Build", "DOB NOW Electrical"];
const STATUS_FILTERS = ["All", "Permit Issued", "Approved", "In Process", "Signed Off", "Plan Exam - Approved"];
const ACTION_FILTERS = ["All", "Needs LOC", "Needs FDNY LOA", "Needs Cost Affidavit", "Needs Plans", "Withdrawal Candidate"];

const formatDateSafe = (value: string | null | undefined, pattern: string, fallback = "Unknown") => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : format(date, pattern);
};

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
  const [drawerRequiredItems, setDrawerRequiredItems] = useState<RequiredItem[]>([]);
  const [requiredItemsModalOpen, setRequiredItemsModalOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      if (workTypeFilter !== "All" && app.workType !== workTypeFilter) return false;
      if (sourceFilter === "Legacy DOB" && app.source !== "DOB_JOB_FILINGS") return false;
      if (sourceFilter === "DOB NOW Build" && app.source !== "DOB_NOW_BUILD") return false;
      if (sourceFilter === "DOB NOW Electrical" && app.source !== "DOB_NOW_ELECTRICAL") return false;
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

  // Group applications by job number to nest subsequents/PAAs
  const { groupedApps, expandedJobs, toggleExpand } = useMemo(() => {
    // Group by base job number (digits only) for BIS filings
    const jobGroups = new Map<string, COApplication[]>();
    const standalone: COApplication[] = [];

    for (const app of filtered) {
      // Only group BIS filings that have docNum patterns (01, 02, etc.)
      if (app.source === "DOB_JOB_FILINGS") {
        const baseJob = app.jobNum.replace(/\D/g, "");
        if (baseJob) {
          if (!jobGroups.has(baseJob)) jobGroups.set(baseJob, []);
          jobGroups.get(baseJob)!.push(app);
          continue;
        }
      }
      standalone.push(app);
    }

    // Build ordered list: groups with >1 entry get nested, singles stay flat
    type GroupedApp = { type: "single"; app: COApplication } | { type: "group"; baseJob: string; initial: COApplication; subsequents: COApplication[] };
    const result: GroupedApp[] = [];

    // First, process groups - sort each group by docNum ascending (01 first)
    for (const [baseJob, apps] of jobGroups) {
      apps.sort((a, b) => (a.docNum || "01").localeCompare(b.docNum || "01"));
      if (apps.length === 1) {
        result.push({ type: "single", app: apps[0] });
      } else {
        result.push({ type: "group", baseJob, initial: apps[0], subsequents: apps.slice(1) });
      }
    }

    // Add standalone apps
    for (const app of standalone) {
      result.push({ type: "single", app });
    }

    // Sort all entries by the primary app's fileDate descending
    result.sort((a, b) => {
      const dateA = a.type === "single" ? a.app.fileDate : a.initial.fileDate;
      const dateB = b.type === "single" ? b.app.fileDate : b.initial.fileDate;
      return (dateB || "").localeCompare(dateA || "");
    });

    return { groupedApps: result, expandedJobs: null as any, toggleExpand: null as any };
  }, [filtered]);

  const [expandedJobNums, setExpandedJobNums] = useState<Set<string>>(new Set());
  const toggleJobExpand = (baseJob: string) => {
    setExpandedJobNums(prev => {
      const next = new Set(prev);
      if (next.has(baseJob)) next.delete(baseJob);
      else next.add(baseJob);
      return next;
    });
  };

  // Paginate on grouped entries
  const paginatedGroups = groupedApps.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(groupedApps.length / pageSize);

  const openDrawer = (app: COApplication) => {
    setSelectedApp(app);
    setDrawerNotes(app.notes || "");
    setDrawerAction(app.action);
    // Initialize required items — start empty, user loads B-SCAN template on demand
    setDrawerRequiredItems((app as any).requiredItems || []);
    setRequiredItemsModalOpen(false);
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

  const openBisCount = (app: COApplication) => app.bisOpenItems?.filter(i => !i.resolved).length || 0;

  const getSourceBadge = (source: string) => {
    if (source === "DOB_NOW_BUILD") return { className: "bg-blue-500/10 text-blue-700 border-blue-500/20", label: "DOB NOW" };
    if (source === "DOB_NOW_ELECTRICAL") return { className: "bg-amber-500/10 text-amber-700 border-amber-500/20", label: "Electrical" };
    return { className: "bg-muted text-muted-foreground", label: "Legacy" };
  };

  const renderAppRow = (app: COApplication, rowNum: number | null, hasChildren: boolean, isExpanded: boolean, baseJob?: string, childCount?: number, isChild?: boolean) => {
    const bisCount = openBisCount(app);
    const sourceBadge = getSourceBadge(app.source);
    return (
      <TableRow
        key={`${app.jobNum}-${app.docNum || "00"}`}
        className={`cursor-pointer hover:bg-accent/5 ${isChild ? "bg-muted/30" : ""}`}
        onClick={() => openDrawer(app)}
      >
        <TableCell className="w-8 px-1">
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); toggleJobExpand(baseJob!); }}
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          ) : isChild ? (
            <span className="ml-2 text-muted-foreground">↳</span>
          ) : null}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{rowNum ?? ""}</TableCell>
        <TableCell className="font-mono text-sm font-medium">
          {app.jobNum}
          {hasChildren && !isExpanded && (
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">{childCount} sub</Badge>
          )}
          {isChild && app.docNum && (
            <span className="ml-1 text-xs text-muted-foreground">Doc {app.docNum}</span>
          )}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={sourceBadge.className}>{sourceBadge.label}</Badge>
        </TableCell>
        <TableCell className="text-sm max-w-[280px] truncate">{app.desc}</TableCell>
        <TableCell className="text-sm">{app.tenant || "—"}</TableCell>
        <TableCell className="text-sm">{app.floor}</TableCell>
        <TableCell className="text-xs">{app.jobType}</TableCell>
        <TableCell><Badge variant="outline" className={WORK_TYPE_COLORS[app.workType] || ""}>{app.workType}</Badge></TableCell>
        <TableCell><Badge variant="outline" className={STATUS_COLORS[app.status] || ""}>{app.status}</Badge></TableCell>
        <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">{app.action}</TableCell>
        <TableCell>
          {bisCount > 0 ? (
            <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/20 gap-1">
              <AlertCircle className="h-3 w-3" />{bisCount}
            </Badge>
          ) : "—"}
        </TableCell>
        <TableCell><Badge variant="outline" className={PRIORITY_COLORS[app.priority]}>{app.priority}</Badge></TableCell>
      </TableRow>
    );
  };

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
                <TableHead className="w-8"></TableHead>
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
                <TableHead>BIS</TableHead>
                <TableHead>Priority</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedGroups.map((entry, idx) => {
                if (entry.type === "single") {
                  return renderAppRow(entry.app, idx + 1 + page * pageSize, false, false);
                }
                const isExpanded = expandedJobNums.has(entry.baseJob);
                return (
                  <Fragment key={`group-${entry.baseJob}`}>
                    {renderAppRow(entry.initial, idx + 1 + page * pageSize, true, isExpanded, entry.baseJob, entry.subsequents.length)}
                    {isExpanded && entry.subsequents.map((sub, si) => (
                      renderAppRow(sub, null, false, false, undefined, undefined, true)
                    ))}
                  </Fragment>
                );
              })}
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
                {apps.map((app) => {
                  const bisCount = openBisCount(app);
                  return (
                    <div key={app.jobNum} className="rounded-lg border p-3 space-y-2 cursor-pointer hover:bg-accent/5 transition-colors" onClick={() => openDrawer(app)}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">{app.jobNum}</span>
                        <div className="flex items-center gap-1">
                          {bisCount > 0 && (
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/20 gap-1 text-[10px]">
                              <AlertCircle className="h-2.5 w-2.5" />{bisCount} open
                            </Badge>
                          )}
                          {(() => { const sb = getSourceBadge(app.source); return (
                            <Badge variant="outline" className={`${sb.className} text-[10px]`}>{sb.label}</Badge>
                          ); })()}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{app.desc}</p>
                      {app.tenant && <p className="text-xs">Tenant: <span className="font-medium">{app.tenant}</span></p>}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={STATUS_COLORS[app.status] || ""} >{app.status}</Badge>
                        <Badge variant="outline" className={PRIORITY_COLORS[app.priority]}>{app.priority}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">{app.action}</p>
                    </div>
                  );
                })}
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
                <SheetDescription>Filed {formatDateSafe(selectedApp.fileDate, "MMMM d, yyyy")}</SheetDescription>
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

                {/* Required Items — opens full modal */}
                <Button
                  variant="default"
                  className="w-full gap-2 justify-between"
                  onClick={() => setRequiredItemsModalOpen(true)}
                >
                  <span className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Required Items
                  </span>
                  <Badge variant="secondary" className="text-xs bg-primary-foreground/20 text-primary-foreground">
                    {drawerRequiredItems.filter(i => i.dateReceived).length}/{drawerRequiredItems.length || 0}
                  </Badge>
                </Button>

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
                        <span className="text-muted-foreground">{formatDateSafe(h.date, "MM/dd/yyyy")}</span>
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

      {/* Required Items Modal */}
      {selectedApp && (
        <RequiredItemsModal
          open={requiredItemsModalOpen}
          onOpenChange={setRequiredItemsModalOpen}
          items={drawerRequiredItems}
          onItemsChange={setDrawerRequiredItems}
          jobNum={selectedApp.jobNum}
        />
      )}
    </div>
  );
}
