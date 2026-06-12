import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay, isToday,
  parseISO, isWithinInterval,
} from "date-fns";
import { ChevronLeft, ChevronRight, List as ListIcon, CalendarDays } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar, MapPin, ExternalLink, Plus, MoreHorizontal, Check, X, Trash2,
  Users, Globe, BadgeCheck, ChevronDown, Pencil,
} from "lucide-react";
import {
  useBdEvents, useCreateBdEvent, useUpdateBdEvent, useDeleteBdEvent,
  useEventAttendees, useAddEventAttendee, useUpdateEventAttendee, useRemoveEventAttendee,
  useEventSources, useUpsertEventSource, useMarkSourceChecked, useDeleteEventSource,
  useMemberships, useUpsertMembership, useDeleteMembership,
  type BdEvent, type EventStatus, type EventSource, type BdMembership,
} from "@/hooks/useBdEvents";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { useToast } from "@/hooks/use-toast";
import { initials } from "@/components/bd/leadConstants";
import { EventBudgetSummary } from "@/components/bd/EventBudgetSummary";
import { ProposeEventDialog } from "@/components/bd/ProposeEventDialog";
import { AttendeesPicker, AttendeeAvatarStack } from "@/components/bd/AttendeesPicker";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { isInvested, isConsidering, eventCost, fmtMoney0, scopeToYear } from "@/lib/eventBudget";


const STATUS_META: Record<EventStatus, { label: string; className: string }> = {
  SUGGESTED: { label: "AI Suggested", className: "bg-amber-50 text-amber-800 border-amber-200" },
  PENDING_APPROVAL: { label: "Pending", className: "bg-gray-100 text-gray-700 border-gray-200" },
  APPROVED: { label: "Approved", className: "bg-blue-100 text-blue-700 border-blue-200" },
  REGISTERED: { label: "Registered", className: "bg-purple-100 text-purple-700 border-purple-200" },
  ATTENDED: { label: "Attended", className: "bg-green-100 text-green-700 border-green-200" },
  SKIPPED: { label: "Skipped", className: "bg-amber-100 text-amber-700 border-amber-200" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
  DISMISSED: { label: "Dismissed", className: "bg-gray-50 text-gray-500 border-gray-200" },
};

const FREQ_LABELS = { WEEKLY: "Weekly", BI_WEEKLY: "Bi-weekly", MONTHLY: "Monthly", QUARTERLY: "Quarterly" } as const;
const SRC_PRIORITY_LABELS = { HIGH: "High", MED: "Medium", LOW: "Low" } as const;

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "MMM d, yyyy"); } catch { return d; }
}
function fmtTimeRange(start: string | null, end: string | null) {
  if (!start && !end) return null;
  const fmt = (v: string) => format(new Date(`2000-01-01T${v.slice(0, 5)}`), "h:mm a");
  return [start ? fmt(start) : null, end ? fmt(end) : null].filter(Boolean).join("–");
}
function fmtEventWhen(event: BdEvent) {
  const time = fmtTimeRange(event.start_time, event.end_time);
  return time ? `${fmtDate(event.start_date)} · ${time}` : fmtDate(event.start_date);
}
function fmtMoney(v: number | null) {
  if (v == null) return "—";
  return `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
function GoingCell({ eventId }: { eventId: string }) {
  const { data } = useEventAttendees(eventId);
  const users = (data ?? []).map((a) => ({
    id: a.user_id,
    first_name: a.user?.first_name ?? null,
    last_name: a.user?.last_name ?? null,
  }));
  return <AttendeeAvatarStack users={users} max={3} />;
}

export default function BdEvents() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("events");
  const [createOpen, setCreateOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const isAdmin = useIsAdmin();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [editEvent, setEditEvent] = useState<BdEvent | null>(null);
  const [detailEvent, setDetailEvent] = useState<BdEvent | null>(null);
  // Multi-status filter — empty set means "all (default: hide SUGGESTED + DISMISSED)".
  const [statusFilter, setStatusFilter] = useState<Set<EventStatus>>(new Set());
  // Bucket filter from the summary strip. When set, overrides statusFilter and
  // uses the shared helpers (isInvested / isConsidering) for the table filter
  // so the strip totals and the table content stay in lock-step.
  const [bucketFilter, setBucketFilter] = useState<"INVESTED" | "CONSIDERING" | null>(null);
  const [search, setSearch] = useState("");
  const [timeRange, setTimeRange] = useState<"UPCOMING" | "PAST" | "THIS_MONTH" | "ALL">("UPCOMING");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState<Date>(new Date());


  const events = useBdEvents();
  const updateEvent = useUpdateBdEvent();
  const deleteEvent = useDeleteBdEvent();
  const { toast } = useToast();

  const parseEventDate = (s: string | null) => {
    if (!s) return null;
    try { return parseISO(s.length <= 10 ? s : s.slice(0, 10)); } catch { return null; }
  };

  const filtered = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const hasFilter = statusFilter.size > 0;
    return (events.data ?? []).filter((e) => {
      // Bucket filter (from summary strip) wins over status filter.
      if (bucketFilter === "INVESTED") {
        if (!isInvested(e)) return false;
      } else if (bucketFilter === "CONSIDERING") {
        if (!isConsidering(e)) return false;
      } else {
        // Default view (no statuses picked) hides SUGGESTED + DISMISSED noise.
        if (!hasFilter && (e.status === "SUGGESTED" || e.status === "DISMISSED")) return false;
        if (hasFilter && !statusFilter.has(e.status)) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!(`${e.name} ${e.location ?? ""} ${e.category ?? ""}`.toLowerCase().includes(q))) return false;
      }
      if (timeRange !== "ALL") {
        const start = parseEventDate(e.start_date);
        const end = parseEventDate(e.end_date) ?? start;
        if (!start) return timeRange === "UPCOMING"; // undated → treat as upcoming
        if (timeRange === "UPCOMING" && (end as Date) < today) return false;
        if (timeRange === "PAST" && (end as Date) >= today) return false;
        if (timeRange === "THIS_MONTH" && !isSameMonth(start, today)) return false;
      }
      return true;
    }).sort((a, b) => {
      const da = parseEventDate(a.start_date)?.getTime() ?? Infinity;
      const db = parseEventDate(b.start_date)?.getTime() ?? Infinity;
      return timeRange === "PAST" ? db - da : da - db;
    });
  }, [events.data, statusFilter, bucketFilter, search, timeRange]);

  // Summary strip data — year-scoped to the current year. Derives off the
  // same useBdEvents query (no extra request); shares math with the Budget tab
  // via lib/eventBudget.ts so totals can never drift between the two views.
  const stripData = useMemo(() => {
    const yearScoped = scopeToYear(events.data ?? [], new Date().getFullYear());
    const invested = yearScoped.filter(isInvested);
    const considering = yearScoped.filter(isConsidering);
    const byStatus = (s: EventStatus) => yearScoped.filter((e) => e.status === s).length;
    return {
      invested: { count: invested.length, total: invested.reduce((s, e) => s + eventCost(e), 0) },
      considering: { count: considering.length, total: considering.reduce((s, e) => s + eventCost(e), 0) },
      perStatus: [
        "PENDING_APPROVAL", "APPROVED", "REGISTERED", "ATTENDED", "SKIPPED",
      ].map((s) => ({ status: s as EventStatus, count: byStatus(s as EventStatus) })),
    };
  }, [events.data]);


  const toggleStatus = (s: EventStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };
  const isOnlyStatus = (s: EventStatus) =>
    statusFilter.size === 1 && statusFilter.has(s);

  const setStatus = (id: string, status: EventStatus) =>
    updateEvent.mutate({ id, status }, { onSuccess: () => toast({ title: `Marked ${STATUS_META[status].label.toLowerCase()}` }) });

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Events</h1>
            <p className="text-sm text-muted-foreground">Industry events, sources to monitor, and your memberships.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setProposeOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />Propose event
            </Button>
            <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" />New event</Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="events"><Calendar className="h-4 w-4 mr-1.5" />Events</TabsTrigger>
            <TabsTrigger value="budget"><Calendar className="h-4 w-4 mr-1.5" />Budget</TabsTrigger>
            <TabsTrigger value="sources"><Globe className="h-4 w-4 mr-1.5" />Sources</TabsTrigger>
            <TabsTrigger value="memberships"><BadgeCheck className="h-4 w-4 mr-1.5" />Memberships</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="Search events…" className="max-w-sm"
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPCOMING">Upcoming</SelectItem>
                  <SelectItem value="THIS_MONTH">This month</SelectItem>
                  <SelectItem value="PAST">Past</SelectItem>
                  <SelectItem value="ALL">All time</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-44 justify-between font-normal">
                    <span className="truncate">
                      {statusFilter.size === 0
                        ? "All statuses"
                        : statusFilter.size === 1
                          ? STATUS_META[[...statusFilter][0]].label
                          : `${statusFilter.size} statuses`}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-2">
                  <div className="flex items-center justify-between px-1 pb-1.5 mb-1.5 border-b">
                    <span className="text-xs font-medium">Filter by status</span>
                    {statusFilter.size > 0 && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setStatusFilter(new Set())}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {(Object.keys(STATUS_META) as EventStatus[]).map((k) => (
                      <label
                        key={k}
                        className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={statusFilter.has(k)}
                          onCheckedChange={() => toggleStatus(k)}
                        />
                        <Badge variant="outline" className={`${STATUS_META[k].className} text-[10px]`}>
                          {STATUS_META[k].label}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {(() => {
                const pendingCount = (events.data ?? []).filter((e) => e.status === "PENDING_APPROVAL").length;
                const suggestedCount = (events.data ?? []).filter((e) => e.status === "SUGGESTED").length;
                const pendingActive = isOnlyStatus("PENDING_APPROVAL");
                const suggestedActive = isOnlyStatus("SUGGESTED");
                return (
                  <>
                    <Button size="sm" variant={pendingActive ? "default" : "outline"}
                      onClick={() => setStatusFilter(pendingActive ? new Set() : new Set(["PENDING_APPROVAL"]))}>
                      Proposed
                      {pendingCount > 0 && (
                        <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{pendingCount}</Badge>
                      )}
                    </Button>
                    <Button size="sm" variant={suggestedActive ? "default" : "outline"}
                      className={suggestedActive ? "" : "border-amber-300 text-amber-800 hover:bg-amber-50"}
                      onClick={() => setStatusFilter(suggestedActive ? new Set() : new Set(["SUGGESTED"]))}>
                      ✨ Suggestions
                      {suggestedCount > 0 && (
                        <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{suggestedCount}</Badge>
                      )}
                    </Button>
                  </>
                );
              })()}
              <div className="ml-auto flex items-center gap-2">
                <div className="text-sm text-muted-foreground">{filtered.length} events</div>
                <div className="inline-flex rounded-md border bg-background p-0.5">
                  <Button size="sm" variant={view === "list" ? "secondary" : "ghost"}
                    className="h-7 px-2" onClick={() => setView("list")}>
                    <ListIcon className="h-3.5 w-3.5 mr-1" />List
                  </Button>
                  <Button size="sm" variant={view === "calendar" ? "secondary" : "ghost"}
                    className="h-7 px-2" onClick={() => setView("calendar")}>
                    <CalendarDays className="h-3.5 w-3.5 mr-1" />Calendar
                  </Button>
                </div>
              </div>
            </div>

            {view === "calendar" ? (
              <EventCalendar
                month={calMonth}
                onMonthChange={setCalMonth}
                events={filtered}
                onSelect={(e) => navigate(`/bd/events/${e.id}`)}
                parseDate={parseEventDate}
              />
            ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Going</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead className="text-right">Pipeline</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((e) => (
                      <TableRow key={e.id} className="cursor-pointer hover:bg-muted/40"
                        onClick={() => navigate(`/bd/events/${e.id}`)}>
                        <TableCell className="font-medium">
                          <div>{e.name}</div>
                          {e.location && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3" />{e.location}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{fmtEventWhen(e)}</TableCell>
                        <TableCell onClick={(ev) => ev.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button"
                                title="Change status"
                                className="focus:outline-none">
                                <Badge variant="outline"
                                  className={`${STATUS_META[e.status].className} cursor-pointer hover:opacity-80`}>
                                  {STATUS_META[e.status].label}
                                  <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
                                </Badge>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              {(Object.keys(STATUS_META) as EventStatus[]).map((s) => (
                                <DropdownMenuItem key={s} onClick={() => setStatus(e.id, s)}>
                                  <Badge variant="outline" className={`${STATUS_META[s].className} mr-2`}>
                                    {STATUS_META[s].label}
                                  </Badge>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell className="text-sm">
                          {e.included_in_membership ? (
                            <span className="text-green-700 text-xs">Included</span>
                          ) : (
                            <span>{fmtMoney(e.cost_actual ?? e.cost_member ?? e.cost_low)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm" onClick={(ev) => ev.stopPropagation()}><GoingCell eventId={e.id} /></TableCell>
                        <TableCell className="text-sm">{e.lead_count ?? 0}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums">
                          {e.pipeline_generated ? `$${Math.round(e.pipeline_generated).toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell onClick={(ev) => ev.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setStatus(e.id, "APPROVED")}>Approve</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setStatus(e.id, "REGISTERED")}>Registered</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setStatus(e.id, "ATTENDED")}>Attended</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setStatus(e.id, "SKIPPED")}>Skip</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setStatus(e.id, "CANCELLED")}>Cancel</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditEvent(e)}><Pencil className="h-3.5 w-3.5 mr-1.5" />Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive"
                                onClick={() => { if (confirm("Delete event?")) deleteEvent.mutate(e.id); }}>
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                        {events.isLoading ? "Loading…" : "No events match these filters."}
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            )}
          </TabsContent>

          <TabsContent value="budget"><EventBudgetSummary /></TabsContent>
          <TabsContent value="sources"><SourcesTab /></TabsContent>
          <TabsContent value="memberships"><MembershipsTab /></TabsContent>
        </Tabs>
      </div>

      <EventDialog open={createOpen || !!editEvent} event={editEvent}
        onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditEvent(null); } }} />
      <ProposeEventDialog open={proposeOpen} onOpenChange={setProposeOpen} />
      <EventDetailSheet event={detailEvent} onOpenChange={(o) => { if (!o) setDetailEvent(null); }} />
    </AppLayout>
  );
}

// ====== Event Calendar (month grid) ======
function EventCalendar({
  month, onMonthChange, events, onSelect, parseDate,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  events: BdEvent[];
  onSelect: (e: BdEvent) => void;
  parseDate: (s: string | null) => Date | null;
}) {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const eventsOnDay = (day: Date) =>
    events.filter((e) => {
      const s = parseDate(e.start_date);
      if (!s) return false;
      const en = parseDate(e.end_date) ?? s;
      return isWithinInterval(day, { start: s, end: en });
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
        <CardTitle className="text-base">{format(month, "MMMM yyyy")}</CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => onMonthChange(subMonths(month, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => onMonthChange(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 border-t">
        <div className="grid grid-cols-7 text-xs font-medium text-muted-foreground border-b">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = eventsOnDay(day);
            const muted = !isSameMonth(day, month);
            return (
              <div key={day.toISOString()}
                className={`min-h-[110px] border-r border-b p-1.5 ${muted ? "bg-muted/30" : ""}`}>
                <div className={`text-xs mb-1 flex items-center justify-end ${
                  isToday(day) ? "font-semibold" : ""
                }`}>
                  <span className={isToday(day)
                    ? "inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground"
                    : (muted ? "text-muted-foreground" : "")}>
                    {format(day, "d")}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <button key={e.id}
                      onClick={() => onSelect(e)}
                      title={e.name}
                      className={`w-full text-left text-[11px] px-1.5 py-0.5 rounded border truncate hover:opacity-80 ${STATUS_META[e.status].className}`}>
                      {e.name}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1.5">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ====== Event Dialog ======
function EventDialog({ open, event, onOpenChange }: { open: boolean; event: BdEvent | null; onOpenChange: (o: boolean) => void }) {
  const create = useCreateBdEvent();
  const update = useUpdateBdEvent();
  const memberships = useMemberships();
  const profiles = useCompanyProfiles();
  const { toast } = useToast();

  const [form, setForm] = useState<Partial<BdEvent>>({});

  useMemo(() => {
    setForm(event ? { ...event } : {
      name: "", status: "PENDING_APPROVAL", priority: "DISCUSS", included_in_membership: false,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, open]);

  const save = async () => {
    if (!form.name?.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    try {
      if (event) await update.mutateAsync({ id: event.id, ...form });
      else await create.mutateAsync(form as any);
      toast({ title: event ? "Event updated" : "Event created" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>Industry conferences, networking, etc.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name *</Label>
            <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={form.start_date ?? ""}
                onChange={(e) => setForm({ ...form, start_date: e.target.value || null })} />
            </div>
            <div>
              <Label>End date</Label>
              <Input type="date" value={form.end_date ?? ""}
                onChange={(e) => setForm({ ...form, end_date: e.target.value || null })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start time</Label>
              <Input type="time" value={form.start_time?.slice(0, 5) ?? ""}
                onChange={(e) => setForm({ ...form, start_time: e.target.value || null })} />
            </div>
            <div>
              <Label>End time</Label>
              <Input type="time" value={form.end_time?.slice(0, 5) ?? ""}
                onChange={(e) => setForm({ ...form, end_time: e.target.value || null })} />
            </div>
          </div>
          <div>
            <Label>Location</Label>
            <Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value || null })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Input value={form.category ?? ""} placeholder="e.g. Conference, Networking"
                onChange={(e) => setForm({ ...form, category: e.target.value || null })} />
            </div>
            <div>
              <Label>Source URL</Label>
              <Input value={form.source_url ?? ""} placeholder="https://…"
                onChange={(e) => setForm({ ...form, source_url: e.target.value || null })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EventStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority ?? "DISCUSS"} onValueChange={(v) => setForm({ ...form, priority: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GO">Go</SelectItem>
                  <SelectItem value="DISCUSS">Discuss</SelectItem>
                  <SelectItem value="SKIP">Skip</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md border p-3 space-y-3 bg-muted/20">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cost</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Member price</Label>
                <Input type="number" value={form.cost_member ?? ""}
                  onChange={(e) => setForm({ ...form, cost_member: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <Label className="text-xs">Non-member price</Label>
                <Input type="number" value={form.cost_nonmember ?? ""}
                  onChange={(e) => setForm({ ...form, cost_nonmember: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="flex items-start gap-2 pt-1">
              <input id="incl-mem" type="checkbox" className="mt-1"
                checked={!!form.included_in_membership}
                onChange={(e) => setForm({ ...form, included_in_membership: e.target.checked, ...(e.target.checked ? {} : { membership_id: null }) })} />
              <Label htmlFor="incl-mem" className="text-sm font-normal cursor-pointer">
                Included free as part of a membership (no cost to attend)
              </Label>
            </div>
            <div>
              <Label className="text-xs">Linked membership {form.included_in_membership ? "*" : "(optional)"}</Label>
              <Select
                value={form.membership_id ?? "__none"}
                onValueChange={(v) => setForm({ ...form, membership_id: v === "__none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {(memberships.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.organization}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Tie this event to an org membership you have on the Memberships tab (e.g. REBNY, NAIOP, BOMA) — used to flag dues-included events and show the right price.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <Label className="text-xs">Actual paid ($)</Label>
                <Input type="number" placeholder="0 if free"
                  value={form.cost_actual ?? ""}
                  onChange={(e) => setForm({ ...form, cost_actual: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Paid by</Label>
                <Select
                  value={form.paid_by_user_id ?? "__none"}
                  onValueChange={(v) => setForm({ ...form, paid_by_user_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {(profiles.data ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value || null })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={create.isPending || update.isPending}>
            {event ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ====== Event Detail Sheet (attendees + meta) ======
function EventDetailSheet({ event, onOpenChange }: { event: BdEvent | null; onOpenChange: (o: boolean) => void }) {
  const attendees = useEventAttendees(event?.id);
  const addAtt = useAddEventAttendee();
  const updAtt = useUpdateEventAttendee();
  const rmAtt = useRemoveEventAttendee();
  const profiles = useCompanyProfiles();
  const [pickUser, setPickUser] = useState("");

  if (!event) return null;
  const presentIds = new Set((attendees.data ?? []).map((a) => a.user_id));
  const available = (profiles.data ?? []).filter((p) => !presentIds.has(p.id));

  return (
    <Sheet open={!!event} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{event.name}</SheetTitle>
          <SheetDescription>{fmtEventWhen(event)} · {event.location ?? "—"}</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 mt-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className={STATUS_META[event.status].className}>{STATUS_META[event.status].label}</Badge>
            {event.category && <Badge variant="secondary">{event.category}</Badge>}
            {event.included_in_membership && <Badge variant="outline" className="bg-green-50 text-green-700">Membership</Badge>}
            {event.source_url && (
              <a href={event.source_url} target="_blank" rel="noreferrer"
                 className="text-xs underline inline-flex items-center gap-1">
                Source <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {event.notes && (
            <div>
              <h4 className="text-sm font-medium mb-1">Notes</h4>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{event.notes}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium flex items-center gap-1.5"><Users className="h-4 w-4" />Attendees</h4>
            </div>
            <AttendeesPicker eventId={event.id} />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Cost</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div>Range: {fmtMoney(event.cost_low)} – {fmtMoney(event.cost_high)}</div>
              <div>Member: {fmtMoney(event.cost_member)} · Non-member: {fmtMoney(event.cost_nonmember)}</div>
              <div>Actual paid: {fmtMoney(event.cost_actual)}</div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ====== Sources Tab ======
function SourcesTab() {
  const sources = useEventSources();
  const upsert = useUpsertEventSource();
  const markChecked = useMarkSourceChecked();
  const del = useDeleteEventSource();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<EventSource | null>(null);
  const [form, setForm] = useState<Partial<EventSource>>({});
  const { toast } = useToast();

  const startEdit = (s: EventSource | null) => {
    setEdit(s);
    setForm(s ? { ...s } : { name: "", url: "", check_frequency: "MONTHLY", priority: "MED" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name?.trim() || !form.url?.trim()) { toast({ title: "Name and URL required", variant: "destructive" }); return; }
    await upsert.mutateAsync(form as any);
    setOpen(false); toast({ title: edit ? "Source updated" : "Source added" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Sites/feeds to check periodically for new events.</p>
        <Button size="sm" onClick={() => startEdit(null)}><Plus className="h-4 w-4 mr-1.5" />Add source</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Last checked</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sources.data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-xs underline inline-flex items-center gap-1 max-w-xs truncate">
                      {s.url.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell className="text-sm">{FREQ_LABELS[s.check_frequency]}</TableCell>
                  <TableCell><Badge variant="outline">{SRC_PRIORITY_LABELS[s.priority]}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(s.last_checked_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => markChecked.mutate(s.id)}>
                      <Check className="h-3.5 w-3.5 mr-1" />Checked
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => { if (confirm("Delete source?")) del.mutate(s.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(sources.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No sources yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit source" : "Add source"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>URL *</Label><Input value={form.url ?? ""} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Frequency</Label>
                <Select value={form.check_frequency ?? "MONTHLY"} onValueChange={(v) => setForm({ ...form, check_frequency: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQ_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority ?? "MED"} onValueChange={(v) => setForm({ ...form, priority: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SRC_PRIORITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====== Memberships Tab ======
function MembershipsTab() {
  const memberships = useMemberships();
  const upsert = useUpsertMembership();
  const del = useDeleteMembership();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<BdMembership | null>(null);
  const [form, setForm] = useState<Partial<BdMembership>>({});
  const { toast } = useToast();

  const startEdit = (m: BdMembership | null) => {
    setEdit(m);
    setForm(m ? { ...m } : { organization: "", status: "EVALUATING" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.organization?.trim()) { toast({ title: "Organization required", variant: "destructive" }); return; }
    await upsert.mutateAsync(form as any);
    setOpen(false); toast({ title: edit ? "Membership updated" : "Membership added" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Memberships you hold (or are evaluating). Drives "included" events pricing.</p>
        <Button size="sm" onClick={() => startEdit(null)}><Plus className="h-4 w-4 mr-1.5" />Add membership</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Annual cost</TableHead>
                <TableHead>Renewal</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(memberships.data ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.organization}</TableCell>
                  <TableCell><Badge variant="outline">{m.status}</Badge></TableCell>
                  <TableCell>{fmtMoney(m.annual_cost)}</TableCell>
                  <TableCell className="text-sm">{fmtDate(m.next_renewal)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => { if (confirm("Delete membership?")) del.mutate(m.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(memberships.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">No memberships yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit membership" : "Add membership"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Organization *</Label><Input value={form.organization ?? ""} onChange={(e) => setForm({ ...form, organization: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status ?? "EVALUATING"} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="NOT_MEMBER">Not member</SelectItem>
                    <SelectItem value="EVALUATING">Evaluating</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Annual cost</Label>
                <Input type="number" value={form.annual_cost ?? ""} onChange={(e) => setForm({ ...form, annual_cost: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Member since</Label><Input type="date" value={form.member_since ?? ""} onChange={(e) => setForm({ ...form, member_since: e.target.value || null })} /></div>
              <div><Label>Next renewal</Label><Input type="date" value={form.next_renewal ?? ""} onChange={(e) => setForm({ ...form, next_renewal: e.target.value || null })} /></div>
            </div>
            <div><Label>Login</Label><Input value={form.login_username ?? ""} onChange={(e) => setForm({ ...form, login_username: e.target.value || null })} /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
