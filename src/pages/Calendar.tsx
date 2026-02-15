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
} from "lucide-react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
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
import { useBillingCalendarItems, type BillingCalendarItem } from "@/hooks/useBillingCalendarItems";
import { CalendarEventDialog } from "@/components/calendar/CalendarEventDialog";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { useCanAccessBilling } from "@/hooks/useUserRoles";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const EVENT_TYPE_COLORS: Record<string, string> = {
  inspection: "bg-orange-500/20 text-orange-700 border-orange-300",
  hearing: "bg-red-500/20 text-red-700 border-red-300",
  deadline: "bg-yellow-500/20 text-yellow-700 border-yellow-300",
  meeting: "bg-blue-500/20 text-blue-700 border-blue-300",
  site_visit: "bg-green-500/20 text-green-700 border-green-300",
  filing: "bg-purple-500/20 text-purple-700 border-purple-300",
  milestone: "bg-pink-500/20 text-pink-700 border-pink-300",
  general: "bg-muted text-muted-foreground border-border",
  invoice_due: "bg-emerald-500/20 text-emerald-700 border-emerald-300",
  follow_up: "bg-amber-500/20 text-amber-700 border-amber-300",
  installment: "bg-cyan-500/20 text-cyan-700 border-cyan-300",
  promise: "bg-violet-500/20 text-violet-700 border-violet-300",
  rfp_deadline: "bg-rose-500/20 text-rose-700 border-rose-300",
};

type UnifiedEvent = (CalendarEvent | BillingCalendarItem) & { is_billing?: boolean };

export default function Calendar() {
  const { toast } = useToast();
  const canAccessBilling = useCanAccessBilling();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showBilling, setShowBilling] = useState(true);

  const { data: gmailConnection } = useGmailConnection();
  const syncCalendar = useSyncCalendar();
  const deleteEvent = useDeleteCalendarEvent();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const { data: events } = useCalendarEvents(
    calStart.toISOString(),
    calEnd.toISOString()
  );

  const { data: billingItems } = useBillingCalendarItems(
    calStart.toISOString(),
    calEnd.toISOString(),
    canAccessBilling
  );

  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const allEvents: UnifiedEvent[] = useMemo(() => {
    const combined: UnifiedEvent[] = [...(events || [])];
    if (showBilling && billingItems) {
      combined.push(...billingItems);
    }
    return combined;
  }, [events, billingItems, showBilling]);

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
      const result = await syncCalendar.mutateAsync({
        time_min: calStart.toISOString(),
        time_max: calEnd.toISOString(),
      });
      toast({ title: `Synced ${result.synced} events from Google Calendar` });
    } catch (err: any) {
      toast({
        title: "Sync failed",
        description: err.message.includes("needs_reauth")
          ? "Please reconnect Gmail with Calendar permissions"
          : err.message,
        variant: "destructive",
      });
    }
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const handleEventClick = (e: React.MouseEvent, ev: CalendarEvent) => {
    e.stopPropagation();
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

  // Selected day panel events
  const selectedDayEvents = selectedDate
    ? eventsByDay[format(selectedDate, "yyyy-MM-dd")] || []
    : [];

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
            {canAccessBilling && (
              <Button
                variant={showBilling ? "default" : "outline"}
                size="sm"
                onClick={() => setShowBilling(!showBilling)}
              >
                <DollarSign className="h-4 w-4 mr-1" />
                Billing Dates
              </Button>
            )}
            {gmailConnection && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncCalendar.isPending}
              >
                <RefreshCw
                  className={cn("h-4 w-4 mr-2", syncCalendar.isPending && "animate-spin")}
                />
                Sync
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                setEditingEvent(null);
                setSelectedDate(new Date());
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Event
            </Button>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-5 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground tracking-tight">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {allEvents.length} event{allEvents.length !== 1 ? "s" : ""} this month
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {[
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
          ].map((item) => (
            <span
              key={item.type}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border",
                EVENT_TYPE_COLORS[item.type] || EVENT_TYPE_COLORS.general
              )}
            >
              {item.label}
            </span>
          ))}
        </div>

        <div className="flex gap-6">

          {/* Calendar Grid */}
          <div className="flex-1">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-medium text-muted-foreground py-2"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayEvents = eventsByDay[key] || [];
                const inMonth = isSameMonth(day, currentMonth);
                const today = isToday(day);
                const selected = selectedDate && isSameDay(day, selectedDate);
                const hasEvents = dayEvents.length > 0;

                return (
                  <div
                    key={key}
                    onClick={() => {
                      setSelectedDate(day);
                    }}
                    className={cn(
                      "min-h-[110px] p-1.5 border-b border-r border-border/50 cursor-pointer transition-all duration-150",
                      !inMonth && "bg-muted/20",
                      inMonth && "bg-card",
                      selected && "bg-primary/5 ring-1 ring-primary/30 ring-inset",
                      !selected && "hover:bg-accent/20"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div
                        className={cn(
                          "text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                          !inMonth && "text-muted-foreground/40",
                          today && "bg-primary text-primary-foreground shadow-sm",
                          inMonth && !today && "text-foreground"
                        )}
                      >
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
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!ev.is_billing) {
                              setEditingEvent(ev as CalendarEvent);
                              setDialogOpen(true);
                            }
                          }}
                          className={cn(
                            "w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded-md border truncate font-medium",
                            EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general,
                            ev.is_billing && "italic"
                          )}
                        >
                          {ev.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-muted-foreground pl-1 font-medium">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day detail sidebar */}
          <div className="w-72 shrink-0">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <CalendarDays className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-bold text-sm text-foreground">
                  {selectedDate
                    ? format(selectedDate, "EEEE, MMM d")
                    : "Select a day"}
                </h3>
              </div>

              {selectedDate && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mb-4"
                    onClick={() => handleDayClick(selectedDate)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Event
                  </Button>

                  {selectedDayEvents.length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No events scheduled
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Click "Add Event" to create one
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className={cn(
                            "rounded-lg border p-3 space-y-1.5 transition-colors",
                            EVENT_TYPE_COLORS[ev.event_type] || "border-border hover:bg-accent/30"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold text-foreground leading-tight">
                              {ev.title}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] shrink-0 capitalize",
                                EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general
                              )}
                            >
                              {ev.event_type?.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          {!ev.all_day && (
                            <p className="text-xs text-muted-foreground font-medium">
                              🕐 {format(new Date(ev.start_time), "h:mm a")} –{" "}
                              {format(new Date(ev.end_time), "h:mm a")}
                            </p>
                          )}
                          {ev.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {ev.description}
                            </p>
                          )}
                          {ev.location && (
                            <p className="text-xs text-muted-foreground truncate">
                              📍 {ev.location}
                            </p>
                          )}
                          {!ev.is_billing && (
                            <div className="flex gap-1 pt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEvent(ev as CalendarEvent);
                                  setDialogOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(ev.id)}
                              >
                                Delete
                              </Button>
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
        </div>
      </div>

      <CalendarEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editingEvent}
        defaultDate={selectedDate || undefined}
      />
    </AppLayout>
  );
}
