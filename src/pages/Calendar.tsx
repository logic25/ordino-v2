import { useState, useMemo, useEffect, useCallback } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";
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
  differenceInDays,
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
import { CalendarMiniMonth } from "@/components/calendar/CalendarMiniMonth";
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  BILLING_EVENT_TYPES,
  type UnifiedEvent,
  type CalendarViewMode,
} from "@/components/calendar/calendarConstants";
import { useCalendarDragDrop } from "@/hooks/useCalendarDragDrop";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { useCanAccessBilling } from "@/hooks/useUserRoles";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function Calendar() {
  const { toast } = useToast();
  const { track } = useTelemetry();
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

  const { moveEventToDate, moveEventToTime } = useCalendarDragDrop();
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

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

  useEffect(() => {
    if (!gmailConnection) return;
    const SYNC_INTERVAL_MS = 15 * 60 * 1000;
    const lastSync = localStorage.getItem("last_calendar_sync");
    const lastSyncTime = lastSync ? parseInt(lastSync, 10) : 0;
    if (Date.now() - lastSyncTime > SYNC_INTERVAL_MS) {
      syncCalendar.mutateAsync({}).then(() => {
        localStorage.setItem("last_calendar_sync", Date.now().toString());
      }).catch(() => {});
    }
  }, [gmailConnection]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const toDateKey = useCallback((isoString: string, allDay: boolean | null | undefined): string => {
    if (allDay && isoString.length >= 10) {
      return isoString.slice(0, 10);
    }
    return format(new Date(isoString), "yyyy-MM-dd");
  }, []);

  const getAllDayRange = useCallback((ev: Pick<UnifiedEvent, "start_time" | "end_time" | "all_day">) => {
    const startKey = toDateKey(ev.start_time, ev.all_day);
    let endKey = ev.end_time ? toDateKey(ev.end_time, ev.all_day) : startKey;

    if (ev.all_day && ev.end_time) {
      const startDate = new Date(`${startKey}T00:00:00`);
      const endDate = new Date(`${endKey}T00:00:00`);

      if (endDate > startDate) {
        endKey = format(addDays(endDate, -1), "yyyy-MM-dd");
      }
    }

    return { startKey, endKey };
  }, [toDateKey]);

  const getAllDaySpanDays = useCallback((ev: Pick<UnifiedEvent, "start_time" | "end_time" | "all_day">) => {
    const { startKey, endKey } = getAllDayRange(ev);
    return differenceInDays(
      new Date(`${endKey}T00:00:00`),
      new Date(`${startKey}T00:00:00`)
    ) + 1;
  }, [getAllDayRange]);

  // Build eventsByDay including multi-day event span
  const eventsByDay = useMemo(() => {
    const map: Record<string, UnifiedEvent[]> = {};

    allEvents.forEach((ev) => {
      if (!ev.start_time) return;

      const { startKey, endKey } = getAllDayRange(ev);

      if (ev.all_day && startKey !== endKey) {
        const startD = new Date(`${startKey}T00:00:00`);
        const endD = new Date(`${endKey}T00:00:00`);
        const evDays = eachDayOfInterval({ start: startD, end: endD });

        evDays.forEach((d) => {
          const key = format(d, "yyyy-MM-dd");
          if (!map[key]) map[key] = [];
          map[key].push(ev);
        });
      } else {
        if (!map[startKey]) map[startKey] = [];
        map[startKey].push(ev);
      }
    });

    return map;
  }, [allEvents, getAllDayRange]);

  const handleSync = async () => {
    track("calendar", "google_sync_triggered");
    try {
      const result = await syncCalendar.mutateAsync({ time_min: calStart.toISOString(), time_max: calEnd.toISOString() });
      toast({ title: `Synced ${result.synced} events from Google Calendar` });
    } catch (err: any) {
      toast({
        title: "Sync failed",
        description: err instanceof Error ? err.message : "Calendar sync failed.",
        variant: "destructive",
      });
    }
  };

  const handleDayClick = (day: Date) => {
    track("calendar", "event_create_started");
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

  // Drag handlers for month grid
  const handleMonthDragStart = (e: React.DragEvent, ev: UnifiedEvent) => {
    if (ev.is_billing) { e.preventDefault(); return; }
    e.dataTransfer.setData("text/plain", JSON.stringify(ev));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleMonthDragOver = (e: React.DragEvent, cellKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell(cellKey);
  };

  const handleMonthDrop = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    setDragOverCell(null);
    try {
      const ev = JSON.parse(e.dataTransfer.getData("text/plain")) as CalendarEvent;
      if (ev) moveEventToDate(ev, day);
    } catch {}
  };

  // Week view drop handler
  const handleWeekDrop = useCallback(
    (ev: CalendarEvent, targetDate: Date, targetHour?: number) => {
      if (targetHour !== undefined) {
        moveEventToTime(ev, targetDate, targetHour);
      } else {
        moveEventToDate(ev, targetDate);
      }
    },
    [moveEventToDate, moveEventToTime]
  );

  const handleMiniMonthSelect = (date: Date) => {
    setCurrentDate(date);
    setSelectedDate(date);
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
      <div className="p-6 space-y-5 max-w-7xl mx-auto" data-tour="calendar-page">
        {/* Cinematic Header */}
        <div className="flex items-center justify-between" data-tour="calendar-header">
          <div>
            <h1 className="cal-heading-cinematic text-foreground">Calendar</h1>
            <p className="text-sm text-muted-foreground/60 font-light mt-0.5">
              Appointments, inspections, RFP deadlines & project milestones
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl border-border/40 bg-card/50 backdrop-blur-sm hover:bg-card/80">
                  <SlidersHorizontal className="h-4 w-4 mr-1" />
                  Filter
                  {hiddenTypes.size > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {hiddenTypes.size} hidden
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3 cal-glass-strong cal-depth-md rounded-xl border-border/30" align="end">
                <p className="text-[9px] font-bold text-muted-foreground/50 mb-2 uppercase tracking-widest">Show / Hide</p>
                <div className="space-y-1.5">
                  {Object.entries(EVENT_TYPE_LABELS)
                    .filter(([type]) => canAccessBilling || !BILLING_EVENT_TYPES.has(type))
                    .map(([type, label]) => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer rounded-lg px-1.5 py-1 hover:bg-accent/10 transition-colors">
                        <Checkbox checked={!hiddenTypes.has(type)} onCheckedChange={() => toggleType(type)} />
                        <span className={cn("w-2 h-2 rounded-full shrink-0", EVENT_TYPE_COLORS[type]?.split(" ")[0] || "bg-muted")} />
                        <span className="text-sm text-foreground/80">{label}</span>
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
              <Button variant={showBilling ? "default" : "outline"} size="sm" className="rounded-xl" onClick={() => setShowBilling(!showBilling)}>
                <DollarSign className="h-4 w-4 mr-1" />
                Billing Dates
              </Button>
            )}
            {gmailConnection && (
              <Button variant="outline" size="sm" className="rounded-xl border-border/40 bg-card/50 backdrop-blur-sm" onClick={handleSync} disabled={syncCalendar.isPending}>
                <RefreshCw className={cn("h-4 w-4 mr-2", syncCalendar.isPending && "animate-spin")} />
                Sync
              </Button>
            )}
            <Button size="sm" className="rounded-xl glow-amber" onClick={() => { setEditingEvent(null); setSelectedDate(new Date()); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              New Event
            </Button>
          </div>
        </div>

        {/* Navigation bar — glass surface */}
        <div className="flex items-center justify-between cal-glass-strong cal-depth-sm rounded-2xl px-5 py-3">
          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-accent/10" onClick={navigatePrev}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center flex-1">
            <h2 className="text-xl font-extrabold text-foreground tracking-tighter">{headingText}</h2>
            <p className="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-wider mt-0.5">
              {allEvents.length} event{allEvents.length !== 1 ? "s" : ""} in view
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as CalendarViewMode)}>
              <TabsList className="h-8 rounded-xl bg-muted/30 backdrop-blur-sm">
                <TabsTrigger value="month" className="text-xs px-3 h-6 rounded-lg data-[state=active]:shadow-sm">Month</TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-3 h-6 rounded-lg data-[state=active]:shadow-sm">Week</TabsTrigger>
                <TabsTrigger value="day" className="text-xs px-3 h-6 rounded-lg data-[state=active]:shadow-sm">Day</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" className="rounded-xl border-border/40" onClick={() => setCurrentDate(new Date())}>Today</Button>
            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-accent/10" onClick={navigateNext}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Interactive Legend — refined */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {legendItems.map((item) => {
            const isHidden = hiddenTypes.has(item.type);
            return (
              <button
                key={item.type}
                onClick={() => toggleType(item.type)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all duration-200 cursor-pointer font-medium",
                  isHidden
                    ? "opacity-30 line-through bg-muted/20 text-muted-foreground/50 border-border/20"
                    : EVENT_TYPE_COLORS[item.type] || EVENT_TYPE_COLORS.general,
                  !isHidden && "cal-event-chip"
                )}
                title={isHidden ? `Show ${item.label} events` : `Hide ${item.label} events`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-5">
          {/* Month view */}
          {viewMode === "month" && (
            <div className="flex-1">
              <div className="grid grid-cols-7 mb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/40 py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 cal-glass cal-depth-md rounded-2xl overflow-hidden">
                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDay[key] || [];
                  const singleDayEvents = dayEvents.filter((ev) => {
                    if (!ev.all_day || !ev.end_time) return true;
                    return differenceInDays(new Date(ev.end_time), new Date(ev.start_time)) === 0;
                  });
                  const multiDayStarting = dayEvents.filter((ev) => {
                    if (!ev.all_day || !ev.end_time) return false;
                    const spanDays = differenceInDays(new Date(ev.end_time), new Date(ev.start_time));
                    return spanDays > 0 && isSameDay(new Date(ev.start_time), day);
                  });
                  const multiDayContinuing = dayEvents.filter((ev) => {
                    if (!ev.all_day || !ev.end_time) return false;
                    const spanDays = differenceInDays(new Date(ev.end_time), new Date(ev.start_time));
                    return spanDays > 0 && !isSameDay(new Date(ev.start_time), day);
                  });

                  const inMonth = isSameMonth(day, currentDate);
                  const today = isToday(day);
                  const selected = selectedDate && isSameDay(day, selectedDate);
                  const isDragOver = dragOverCell === key;

                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedDate(day)}
                      onDragOver={(e) => handleMonthDragOver(e, key)}
                      onDragLeave={() => setDragOverCell(null)}
                      onDrop={(e) => handleMonthDrop(e, day)}
                      className={cn(
                        "min-h-[110px] p-1.5 border-b border-r border-border/15 cursor-pointer transition-all duration-200 overflow-hidden",
                        !inMonth && "bg-background/30",
                        inMonth && "bg-card/40",
                        today && "cal-today-glow bg-primary/[0.03]",
                        selected && "bg-primary/8 ring-1 ring-primary/25 ring-inset",
                        isDragOver && "bg-primary/12 ring-2 ring-primary/40 ring-inset",
                        !selected && !isDragOver && !today && "cal-cell-hover"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className={cn(
                          "text-xs font-bold w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-300",
                          !inMonth && "text-muted-foreground/25",
                          today && "bg-primary text-primary-foreground shadow-md",
                          inMonth && !today && "text-foreground/80"
                        )}>
                          {format(day, "d")}
                        </div>
                        {dayEvents.length > 0 && !today && (
                          <span className="flex gap-0.5">
                            {dayEvents.slice(0, 3).map((_, i) => (
                              <span key={i} className="w-1 h-1 rounded-full bg-primary/30" />
                            ))}
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {multiDayStarting.map((ev) => {
                          const spanDays = Math.min(
                            differenceInDays(new Date(ev.end_time), new Date(ev.start_time)) + 1,
                            7 - day.getDay()
                          );
                          return (
                            <button
                              key={`bar-${ev.id}`}
                              draggable={!ev.is_billing}
                              onDragStart={(e) => handleMonthDragStart(e, ev)}
                              onClick={(e) => { e.stopPropagation(); if (!ev.is_billing) { setEditingEvent(ev as CalendarEvent); setDialogOpen(true); } }}
                              className={cn(
                                "text-left text-[10px] leading-tight px-2 py-0.5 rounded-l-lg border-l border-t border-b truncate font-semibold cal-event-chip",
                                EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general,
                                ev.is_billing && "italic cursor-default",
                                !ev.is_billing && "cursor-grab active:cursor-grabbing"
                              )}
                              style={{
                                width: `calc(${spanDays * 100}% + ${(spanDays - 1) * 1}px)`,
                                position: "relative",
                                zIndex: 5,
                              }}
                            >
                              {ev.title}
                            </button>
                          );
                        })}
                        {multiDayContinuing.length > 0 && day.getDay() === 0 && multiDayContinuing.map((ev) => (
                          <div
                            key={`cont-${ev.id}`}
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-l-lg border-l border-t border-b truncate font-medium opacity-60",
                              EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general
                            )}
                          >
                            ↳ {ev.title}
                          </div>
                        ))}
                        {singleDayEvents.slice(0, 3).map((ev) => (
                          <button
                            key={ev.id}
                            draggable={!ev.is_billing}
                            onDragStart={(e) => handleMonthDragStart(e, ev)}
                            onClick={(e) => { e.stopPropagation(); if (!ev.is_billing) { setEditingEvent(ev as CalendarEvent); setDialogOpen(true); } }}
                            className={cn(
                              "w-full text-left text-[10px] leading-tight px-2 py-0.5 rounded-lg border truncate font-medium cal-event-chip",
                              EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general,
                              ev.is_billing && "italic cursor-default",
                              !ev.is_billing && "cursor-grab active:cursor-grabbing"
                            )}
                          >
                            {ev.title}
                          </button>
                        ))}
                        {singleDayEvents.length > 3 && (
                          <span className="text-[10px] text-muted-foreground/40 pl-1 font-medium">+{singleDayEvents.length - 3} more</span>
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
              onDropEvent={handleWeekDrop}
            />
          )}

          {viewMode === "day" && (
            <CalendarDayView
              currentDate={currentDate}
              eventsByDay={eventsByDay}
              onEventClick={handleEventClick}
            />
          )}

          {/* Sidebar */}
          {viewMode !== "day" && (
            <div className="w-72 shrink-0 space-y-4">
              <CalendarMiniMonth
                selectedDate={selectedDate || currentDate}
                onSelectDate={handleMiniMonthSelect}
              />

              {/* Day detail — glass panel */}
              <div className="rounded-2xl cal-glass cal-depth-sm p-4 sticky top-6">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2 rounded-xl bg-primary/8">
                    <CalendarDays className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground tracking-tight">
                    {selectedDate ? format(selectedDate, "EEEE, MMM d") : "Select a day"}
                  </h3>
                </div>

                {selectedDate && (
                  <>
                    <Button variant="outline" size="sm" className="w-full mb-4 rounded-xl border-border/30 hover:bg-accent/10" onClick={() => handleDayClick(selectedDate)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Event
                    </Button>

                    {selectedDayEvents.length === 0 ? (
                      <div className="text-center py-10">
                        <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/15 mb-3" />
                        <p className="text-sm text-muted-foreground/50 font-medium">No events</p>
                        <p className="text-[10px] text-muted-foreground/30 mt-1">Click "Add Event" to create one</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {selectedDayEvents.map((ev) => (
                          <div key={ev.id} className={cn(
                            "rounded-xl border p-3 space-y-1.5 transition-all duration-200 cal-event-chip",
                            EVENT_TYPE_COLORS[ev.event_type] || "border-border/30 hover:bg-accent/10"
                          )}>
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-bold text-foreground leading-tight tracking-tight">{ev.title}</span>
                              <Badge variant="outline" className={cn("text-[9px] shrink-0 capitalize rounded-md", EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general)}>
                                {ev.event_type?.replace(/_/g, " ")}
                              </Badge>
                            </div>
                            {!ev.all_day && (
                              <p className="text-xs text-muted-foreground/60 font-medium tabular-nums">
                                🕐 {format(new Date(ev.start_time), "h:mm a")} – {format(new Date(ev.end_time), "h:mm a")}
                              </p>
                            )}
                            {ev.description && <p className="text-xs text-muted-foreground/50 line-clamp-2">{ev.description}</p>}
                            {ev.location && <p className="text-xs text-muted-foreground/50 truncate">📍 {ev.location}</p>}
                            {(ev as any).recurrence_rule && (
                              <p className="text-[10px] text-muted-foreground/40">🔁 Recurring</p>
                            )}
                            {!ev.is_billing && (
                              <div className="flex gap-1 pt-1">
                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2 rounded-lg" onClick={(e) => { e.stopPropagation(); setEditingEvent(ev as CalendarEvent); setDialogOpen(true); }}>Edit</Button>
                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2 rounded-lg text-destructive hover:text-destructive" onClick={() => handleDelete(ev.id)}>Delete</Button>
                              </div>
                            )}
                            {ev.is_billing && (
                              <p className="text-[9px] text-muted-foreground/30 italic pt-1">
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
