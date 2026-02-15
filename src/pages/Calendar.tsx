import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  CalendarDays,
  DollarSign,
  SlidersHorizontal,
} from "lucide-react";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import {
  useCalendarEvents,
  useSyncCalendar,
  useDeleteCalendarEvent,
  type CalendarEvent,
} from "@/hooks/useCalendarEvents";
import { useBillingCalendarItems } from "@/hooks/useBillingCalendarItems";
import { CalendarEventDialog } from "@/components/calendar/CalendarEventDialog";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { CalendarDayView } from "@/components/calendar/CalendarDayView";
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  BILLING_EVENT_TYPES,
  type UnifiedEvent,
  type CalendarViewMode,
} from "@/components/calendar/calendarConstants";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { useCanAccessBilling } from "@/hooks/useUserRoles";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function Calendar() {
  const { toast } = useToast();
  const canAccessBilling = useCanAccessBilling();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showBilling, setShowBilling] = useState(true);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("calendar_hidden_types");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const toggleType = (type: string) => {
    setHiddenTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      localStorage.setItem("calendar_hidden_types", JSON.stringify([...next]));
      return next;
    });
  };

  const { data: gmailConnection } = useGmailConnection();
  const syncCalendar = useSyncCalendar();
  const deleteEvent = useDeleteCalendarEvent();

  // Compute date range based on view
  const { calStart, calEnd } = useMemo(() => {
    if (viewMode === "week") {
      return {
        calStart: startOfWeek(currentDate, { weekStartsOn: 0 }),
        calEnd: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    }
    if (viewMode === "day") {
      return { calStart: startOfDay(currentDate), calEnd: endOfDay(currentDate) };
    }
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    return {
      calStart: startOfWeek(monthStart, { weekStartsOn: 0 }),
      calEnd: endOfWeek(monthEnd, { weekStartsOn: 0 }),
    };
  }, [currentDate, viewMode]);

  const { data: events } = useCalendarEvents(calStart.toISOString(), calEnd.toISOString());
  const { data: billingItems } = useBillingCalendarItems(calStart.toISOString(), calEnd.toISOString(), canAccessBilling);

  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const allEvents: UnifiedEvent[] = useMemo(() => {
    const combined: UnifiedEvent[] = [...(events || [])];
    if (showBilling && billingItems) combined.push(...billingItems);
    return combined.filter(ev => !hiddenTypes.has(ev.event_type || "general"));
  }, [events, billingItems, showBilling, hiddenTypes]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, UnifiedEvent[]> = {};
    allEvents.forEach((ev) => {
      if (!ev.start_time) return;
      const d = new Date(ev.start_time);
      if (isNaN(d.getTime())) return;
      const key = format(d, "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [allEvents]);

  const handleSync = async () => {
    try {
      const result = await syncCalendar.mutateAsync({ time_min: calStart.toISOString(), time_max: calEnd.toISOString() });
      toast({ title: `Synced ${result.synced} events from Google Calendar` });
    } catch (err: any) {
      toast({
        title: "Sync failed",
        description: err.message.includes("needs_reauth") ? "Please reconnect Gmail with Calendar permissions" : err.message,
        variant: "destructive",
      });
    }
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const handleEventClick = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setDialogOpen(true);
  };

  const handleDelete = async (eventId: string) => {
    try {
      await deleteEvent.mutateAsync(eventId);
      toast({ title: "Event deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const navigatePrev = () => {
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const navigateNext = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const headingText = viewMode === "month"
    ? format(currentDate, "MMMM yyyy")
    : viewMode === "week"
    ? `${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "MMM d")} – ${format(endOfWeek(currentDate, { weekStartsOn: 0 }), "MMM d, yyyy")}`
    : format(currentDate, "EEEE, MMMM d, yyyy");

  const selectedDayEvents = selectedDate ? eventsByDay[format(selectedDate, "yyyy-MM-dd")] || [] : [];

  // Build legend items
  const legendItems = [
    { type: "inspection", label: "Inspection" },
    { type: "hearing", label: "Hearing" },
    { type: "deadline", label: "Deadline" },
    { type: "meeting", label: "Meeting" },
    { type: "site_visit", label: "Site Visit" },
    { type: "filing", label: "Filing" },
    { type: "milestone", label: "Milestone" },
    ...(canAccessBilling && showBilling
      ? [
          { type: "invoice_due", label: "Invoice Due" },
          { type: "follow_up", label: "Follow-up" },
          { type: "installment", label: "Installment" },
          { type: "promise", label: "Promise" },
          { type: "rfp_deadline", label: "RFP Deadline" },
        ]
      : []),
  ];

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Appointments, inspections, RFP deadlines & project milestones
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="h-4 w-4 mr-1" />
                  Filter
                  {hiddenTypes.size > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {hiddenTypes.size} hidden
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="end">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Show / Hide</p>
                <div className="space-y-1.5">
                  {Object.entries(EVENT_TYPE_LABELS)
                    .filter(([type]) => canAccessBilling || !BILLING_EVENT_TYPES.has(type))
                    .map(([type, label]) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-1 hover:bg-accent/40 transition-colors">
                        <Checkbox checked={!hiddenTypes.has(type)} onCheckedChange={() => toggleType(type)} />
                        <span className={cn("w-2 h-2 rounded-full shrink-0", EVENT_TYPE_COLORS[type]?.split(" ")[0] || "bg-muted")} />
                        <span className="text-sm text-foreground">{label}</span>
                      </label>
                    ))}
                </div>
                {hiddenTypes.size > 0 && (
                  <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => { setHiddenTypes(new Set()); localStorage.removeItem("calendar_hidden_types"); }}>
                    Show All
                  </Button>
                )}
              </PopoverContent>
            </Popover>
            {canAccessBilling && (
              <Button variant={showBilling ? "default" : "outline"} size="sm" onClick={() => setShowBilling(!showBilling)}>
                <DollarSign className="h-4 w-4 mr-1" />
                Billing Dates
              </Button>
            )}
            {gmailConnection && (
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncCalendar.isPending}>
                <RefreshCw className={cn("h-4 w-4 mr-2", syncCalendar.isPending && "animate-spin")} />
                Sync
              </Button>
            )}
            <Button size="sm" onClick={() => { setEditingEvent(null); setSelectedDate(new Date()); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              New Event
            </Button>
          </div>
        </div>

        {/* Month nav + view switcher */}
        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-5 py-3">
          <Button variant="ghost" size="icon" onClick={navigatePrev}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center flex-1">
            <h2 className="text-xl font-bold text-foreground tracking-tight">{headingText}</h2>
            <p className="text-xs text-muted-foreground">
              {allEvents.length} event{allEvents.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as CalendarViewMode)}>
              <TabsList className="h-8">
                <TabsTrigger value="month" className="text-xs px-2.5 h-6">Month</TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-2.5 h-6">Week</TabsTrigger>
                <TabsTrigger value="day" className="text-xs px-2.5 h-6">Day</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
            <Button variant="ghost" size="icon" onClick={navigateNext}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Interactive Legend */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {legendItems.map((item) => {
            const isHidden = hiddenTypes.has(item.type);
            return (
              <button
                key={item.type}
                onClick={() => toggleType(item.type)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all cursor-pointer",
                  isHidden
                    ? "opacity-40 line-through bg-muted/30 text-muted-foreground border-border"
                    : EVENT_TYPE_COLORS[item.type] || EVENT_TYPE_COLORS.general
                )}
                title={isHidden ? `Show ${item.label} events` : `Hide ${item.label} events`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-6">
          {/* Calendar views */}
          {viewMode === "month" && (
            <div className="flex-1">
              <div className="grid grid-cols-7 mb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDay[key] || [];
                  const inMonth = isSameMonth(day, currentDate);
                  const today = isToday(day);
                  const selected = selectedDate && isSameDay(day, selectedDate);
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "min-h-[110px] p-1.5 border-b border-r border-border/50 cursor-pointer transition-all duration-150",
                        !inMonth && "bg-muted/20",
                        inMonth && "bg-card",
                        selected && "bg-primary/5 ring-1 ring-primary/30 ring-inset",
                        !selected && "hover:bg-accent/20"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className={cn("text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors", !inMonth && "text-muted-foreground/40", today && "bg-primary text-primary-foreground shadow-sm", inMonth && !today && "text-foreground")}>
                          {format(day, "d")}
                        </div>
                        {hasEvents && !today && (
                          <span className="flex gap-0.5">
                            {dayEvents.slice(0, 3).map((_, i) => (
                              <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                            ))}
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <button
                            key={ev.id}
                            onClick={(e) => { e.stopPropagation(); if (!ev.is_billing) { setEditingEvent(ev as CalendarEvent); setDialogOpen(true); } }}
                            className={cn("w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded-md border truncate font-medium", EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general, ev.is_billing && "italic")}
                          >
                            {ev.title}
                          </button>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-muted-foreground pl-1 font-medium">+{dayEvents.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "week" && (
            <CalendarWeekView
              currentDate={currentDate}
              selectedDate={selectedDate}
              eventsByDay={eventsByDay}
              onSelectDate={setSelectedDate}
              onEventClick={handleEventClick}
            />
          )}

          {viewMode === "day" && (
            <CalendarDayView
              currentDate={currentDate}
              eventsByDay={eventsByDay}
              onEventClick={handleEventClick}
            />
          )}

          {/* Day detail sidebar */}
          {viewMode !== "day" && (
            <div className="w-72 shrink-0">
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm sticky top-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <CalendarDays className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">
                    {selectedDate ? format(selectedDate, "EEEE, MMM d") : "Select a day"}
                  </h3>
                </div>

                {selectedDate && (
                  <>
                    <Button variant="outline" size="sm" className="w-full mb-4" onClick={() => handleDayClick(selectedDate)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Event
                    </Button>

                    {selectedDayEvents.length === 0 ? (
                      <div className="text-center py-8">
                        <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">No events scheduled</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Click "Add Event" to create one</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedDayEvents.map((ev) => (
                          <div key={ev.id} className={cn("rounded-lg border p-3 space-y-1.5 transition-colors", EVENT_TYPE_COLORS[ev.event_type] || "border-border hover:bg-accent/30")}>
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-semibold text-foreground leading-tight">{ev.title}</span>
                              <Badge variant="outline" className={cn("text-[10px] shrink-0 capitalize", EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general)}>
                                {ev.event_type?.replace(/_/g, " ")}
                              </Badge>
                            </div>
                            {!ev.all_day && (
                              <p className="text-xs text-muted-foreground font-medium">
                                🕐 {format(new Date(ev.start_time), "h:mm a")} – {format(new Date(ev.end_time), "h:mm a")}
                              </p>
                            )}
                            {ev.description && <p className="text-xs text-muted-foreground line-clamp-2">{ev.description}</p>}
                            {ev.location && <p className="text-xs text-muted-foreground truncate">📍 {ev.location}</p>}
                            {!ev.is_billing && (
                              <div className="flex gap-1 pt-1">
                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={(e) => { e.stopPropagation(); setEditingEvent(ev as CalendarEvent); setDialogOpen(true); }}>Edit</Button>
                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-destructive hover:text-destructive" onClick={() => handleDelete(ev.id)}>Delete</Button>
                              </div>
                            )}
                            {ev.is_billing && (
                              <p className="text-[10px] text-muted-foreground italic pt-1">
                                Auto-generated from {ev.event_type === "rfp_deadline" ? "RFPs" : "Billing"}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <CalendarEventDialog open={dialogOpen} onOpenChange={setDialogOpen} event={editingEvent} defaultDate={selectedDate || undefined} />
    </AppLayout>
  );
}
