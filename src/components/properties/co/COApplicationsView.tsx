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
  ExternalLink, Calendar, Users, DollarSign, Building2,
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

type GroupedApp =
  | { type: "single"; app: COApplication }
  | { type: "group"; baseJob: string; initial: COApplication; subsequents: COApplication[] };

const WORK_TYPES = ["All", "OT", "PL", "MH", "SP", "FA", "FP", "SG", "EQ", "EL"];
const SOURCE_FILTERS = ["All", "Legacy DOB", "DOB NOW Build", "DOB NOW Electrical"];
const STATUS_FILTERS = ["All", "Permit Issued", "Approved", "In Process", "Signed Off", "Plan Exam - Approved", "Plan Exam In Process", "Disapproved", "Withdrawn"];

const formatDateSafe = (value: string | null | undefined, pattern: string, fallback = "—") => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : format(date, pattern);
};

const getSourceBadge = (source: string) => {
  if (source === "DOB_NOW_BUILD" || source === "DOB_NOW") return { className: "bg-blue-500/10 text-blue-700 border-blue-500/20", label: "DOB NOW" };
  if (source === "DOB_NOW_ELECTRICAL" || source === "Electrical") return { className: "bg-amber-500/10 text-amber-700 border-amber-500/20", label: "Electrical" };
  if (source === "BIS_SCRAPE") return { className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", label: "BIS" };
  return { className: "bg-muted text-muted-foreground", label: "BIS" };
};

const getSourceLabel = (source: string) => {
  if (source === "DOB_NOW_BUILD" || source === "DOB_NOW") return "DOB NOW Build";
  if (source === "DOB_NOW_ELECTRICAL" || source === "Electrical") return "DOB NOW Electrical";
  if (source === "BIS_SCRAPE") return "DOB BIS (Scraped)";
  return "DOB BIS";
};

const getBISJobUrl = (jobNum: string) => {
  const digits = jobNum.replace(/\D/g, "");
  return `https://a810-bisweb.nyc.gov/bisweb/JobsQueryByNumberServlet?passjobnumber=${digits}`;
};

export function COApplicationsView({ applications, onUpdateApp, initialWorkTypeFilter }: COApplicationsViewProps) {
  const [search, setSearch] = useState("");
  const [workTypeFilter, setWorkTypeFilter] = useState(initialWorkTypeFilter || "All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedApp, setSelectedApp] = useState<COApplication | null>(null);
  const [drawerNotes, setDrawerNotes] = useState("");
  const [drawerAction, setDrawerAction] = useState("");
  const [drawerRequiredItems, setDrawerRequiredItems] = useState<RequiredItem[]>([]);
  const [requiredItemsModalOpen, setRequiredItemsModalOpen] = useState(false);

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      if (workTypeFilter !== "All" && app.workType !== workTypeFilter) return false;
      if (sourceFilter === "Legacy DOB" && app.source !== "DOB_JOB_FILINGS") return false;
      if (sourceFilter === "DOB NOW Build" && app.source !== "DOB_NOW_BUILD") return false;
      if (sourceFilter === "DOB NOW Electrical" && app.source !== "DOB_NOW_ELECTRICAL") return false;
      if (statusFilter !== "All" && app.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return app.jobNum.includes(q) || app.desc.toLowerCase().includes(q) || (app.tenant?.toLowerCase().includes(q) ?? false);
      }
      return true;
    });
  }, [applications, workTypeFilter, sourceFilter, statusFilter, search]);

  // Group applications by base job number for BIS filings to nest subsequents/PAAs
  const groupedApps = useMemo(() => {
    const jobGroups = new Map<string, COApplication[]>();
    const standalone: COApplication[] = [];

    // Sources that should be grouped by base job number (BIS-related filings)
    const GROUPABLE_SOURCES = new Set([
      "DOB_JOB_FILINGS",
      "DOB BIS",
      "BIS_SCRAPE",
      "BIS",
      "citisignal",
      "socrata",
    ]);
    const isGroupable = (source: string | undefined | null) =>
      !source || GROUPABLE_SOURCES.has(source) || source === "DOB_NOW_BUILD";
    const getBaseJobNumber = (jobNum: string | null | undefined) => {
      if (!jobNum) return "";
      return String(jobNum).trim().split("-")[0].replace(/\D/g, "");
    };
    const getGroupOrder = (app: COApplication) => {
      const normalizedJob = String(app.jobNum || "").trim();
      const explicitDoc = String(app.docNum || "").match(/\d+/)?.[0];
      if (explicitDoc) return parseInt(explicitDoc, 10);
      const suffixMatch = normalizedJob.match(/-(\d{1,3})$/);
      if (suffixMatch) return parseInt(suffixMatch[1], 10);
      return 1;
    };

    for (const app of filtered) {
      // Don't group electrical filings — they have different job number patterns
      if (app.source === "DOB_NOW_ELECTRICAL") {
        standalone.push(app);
        continue;
      }
      if (isGroupable(app.source)) {
        const baseJob = getBaseJobNumber(app.jobNum);
        if (baseJob) {
          if (!jobGroups.has(baseJob)) jobGroups.set(baseJob, []);
          jobGroups.get(baseJob)!.push(app);
          continue;
        }
      }
      standalone.push(app);
    }

    const result: GroupedApp[] = [];

    for (const [baseJob, apps] of jobGroups) {
      apps.sort((a, b) => getGroupOrder(a) - getGroupOrder(b) || (a.fileDate || "").localeCompare(b.fileDate || ""));
      if (apps.length === 1) {
        result.push({ type: "single", app: apps[0] });
      } else {
        result.push({ type: "group", baseJob, initial: apps[0], subsequents: apps.slice(1) });
      }
    }

    for (const app of standalone) {
      result.push({ type: "single", app });
    }

    // Sort chronologically — most recent first (use latest date in group)
    const latestDate = (g: GroupedApp): string => {
      if (g.type === "single") return g.app.fileDate || "";
      const all = [g.initial, ...g.subsequents];
      return all.reduce((max, a) => (a.fileDate || "") > max ? (a.fileDate || "") : max, "");
    };
    result.sort((a, b) => latestDate(b).localeCompare(latestDate(a)));

    return result;
  }, [filtered]);

  const paginatedGroups = groupedApps.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(groupedApps.length / pageSize);

  const openDrawer = (app: COApplication) => {
    setSelectedApp(app);
    setDrawerNotes(app.notes || "");
    setDrawerAction(app.action);
    setDrawerRequiredItems((app as any).requiredItems || []);
    setRequiredItemsModalOpen(false);
  };

  const renderExpandedDetails = (app: COApplication, subsequents?: COApplication[]) => {
    return (
      <TableRow className="bg-muted/20 hover:bg-muted/20">
        <TableCell colSpan={8} className="p-0">
          <div className="px-6 py-4 space-y-4">
            {/* Detail grid: Dates, People, Cost, Details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Dates
                </p>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p>Filed: <span className="text-foreground">{formatDateSafe(app.fileDate, "MM/dd/yy")}</span></p>
                  <p>Approved: <span className="text-foreground">—</span></p>
                  <p>Expires: <span className="text-foreground">—</span></p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" /> People
                </p>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p>Applicant: <span className="text-foreground">{app.tenant || "—"}</span></p>
                  {app.assignedTo && <p>Assigned: <span className="text-foreground">{app.assignedTo}</span></p>}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" /> Cost
                </p>
                <div className="text-sm text-muted-foreground">
                  <p>Est. Cost: <span className="text-foreground">—</span></p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Details
                </p>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p>Work Type: <span className="text-foreground">{app.workType ? `${app.workType} — ${WORK_TYPE_LABELS[app.workType] || app.workType}` : "—"}</span></p>
                  <p>Job Type: <span className="text-foreground">{app.jobType || "—"}</span></p>
                  <p>Floor: <span className="text-foreground">{app.floor || "—"}</span></p>
                  {app.docNum && <p>Doc #: <span className="text-foreground">{app.docNum}</span></p>}
                </div>
              </div>
            </div>

            {/* Description */}
            {app.desc && (
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Description
                </p>
                <p className="text-sm">{app.desc}</p>
              </div>
            )}

            {/* Status info */}
            <p className="text-xs text-muted-foreground italic">
              Status: {app.status}
              {app.source && ` · Source: ${getSourceLabel(app.source)}`}
            </p>

            {/* Related Filings (subsequents) */}
            {subsequents && subsequents.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Related Filings ({subsequents.length})
                </p>
                <div className="space-y-2">
                  {subsequents.map((sub) => (
                    <div
                      key={`${sub.jobNum}-${sub.docNum}`}
                      className="rounded-md border bg-background p-3 space-y-1 cursor-pointer hover:border-primary/30 transition-colors"
                      onClick={() => openDrawer(sub)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs font-mono">Doc #{sub.docNum || "—"}</Badge>
                        <span className="text-sm truncate flex-1">{sub.desc || "—"}</span>
                        <Badge variant="outline" className={STATUS_COLORS[sub.status] || ""}>{sub.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Applicant: {sub.tenant || "—"}
                        {sub.fileDate && ` · Filed: ${formatDateSafe(sub.fileDate, "MM/dd/yy")}`}
                        {sub.workType && ` · ${WORK_TYPE_LABELS[sub.workType] || sub.workType}`}
                        {sub.jobType && ` · ${sub.jobType}`}
                        {sub.floor && ` · Floor: ${sub.floor}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom actions */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); openDrawer(app); }}
              >
                <ClipboardList className="h-3.5 w-3.5" /> Notes & Actions
              </Button>
              <div className="ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(getBISJobUrl(app.jobNum), "_blank");
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View on DOB BIS Web
                </Button>
              </div>
            </div>
          </div>
        </TableCell>
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
          <span className="text-xs text-muted-foreground self-center ml-auto">{filtered.length} of {applications.length} applications</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-8"></TableHead>
              <TableHead>Application #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Agency</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Filed</TableHead>
              <TableHead className="max-w-[300px]">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedGroups.map((entry, idx) => {
              if (entry.type === "single") {
                const app = entry.app;
                const rowKey = `${app.jobNum}-${app.docNum || "s"}`;
                const isExpanded = expandedRows.has(rowKey);
                const sourceBadge = getSourceBadge(app.source);
                return (
                  <Fragment key={rowKey}>
                    <TableRow
                      className="cursor-pointer hover:bg-accent/5"
                      onClick={() => toggleRow(rowKey)}
                    >
                      <TableCell className="w-8 px-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">{app.jobNum}</TableCell>
                      <TableCell><Badge variant="outline">{app.jobType || "—"}</Badge></TableCell>
                      <TableCell><Badge className="bg-orange-500/10 text-orange-700 border-orange-500/20" variant="outline">DOB</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={sourceBadge.className}>{sourceBadge.label}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_COLORS[app.status] || ""}>{app.status}</Badge></TableCell>
                      <TableCell className="text-sm">{formatDateSafe(app.fileDate, "MM/dd/yy")}</TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">{app.desc || "—"}</TableCell>
                    </TableRow>
                    {isExpanded && renderExpandedDetails(app)}
                  </Fragment>
                );
              }

              // Grouped entry (initial + subsequents)
              const app = entry.initial;
              const rowKey = `group-${entry.baseJob}`;
              const isExpanded = expandedRows.has(rowKey);
              const sourceBadge = getSourceBadge(app.source);
              return (
                <Fragment key={rowKey}>
                  <TableRow
                    className="cursor-pointer hover:bg-accent/5"
                    onClick={() => toggleRow(rowKey)}
                  >
                    <TableCell className="w-8 px-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </Button>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {app.jobNum}
                      {!isExpanded && (
                        <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">+{entry.subsequents.length}</Badge>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline">{app.jobType || "—"}</Badge></TableCell>
                    <TableCell><Badge className="bg-orange-500/10 text-orange-700 border-orange-500/20" variant="outline">DOB</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={sourceBadge.className}>{sourceBadge.label}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_COLORS[app.status] || ""}>{app.status}</Badge></TableCell>
                    <TableCell className="text-sm">{formatDateSafe(app.fileDate, "MM/dd/yy")}</TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">{app.desc || "—"}</TableCell>
                  </TableRow>
                  {isExpanded && renderExpandedDetails(app, entry.subsequents)}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* Application Detail Drawer (for notes/actions) */}
      <Sheet open={!!selectedApp} onOpenChange={(open) => { if (!open) setSelectedApp(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedApp && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">Job #{selectedApp.jobNum}</SheetTitle>
                <SheetDescription>Filed {formatDateSafe(selectedApp.fileDate, "MMMM d, yyyy")}</SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={getSourceBadge(selectedApp.source).className}>
                    {getSourceLabel(selectedApp.source)}
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
