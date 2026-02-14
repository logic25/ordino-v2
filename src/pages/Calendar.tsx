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
import { CalendarEventDialog } from "@/components/calendar/CalendarEventDialog";
import { useGmailConnection } from "@/hooks/useGmailConnection";
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
};

export default function Calendar() {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const { data: gmailConnection } = useGmailConnection();
  const syncCalendar = useSyncCalendar();
  const deleteEvent = useDeleteCalendarEvent();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const { data: events, isLoading } = useCalendarEvents(
    calStart.toISOString(),
    calEnd.toISOString()
  );

  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events?.forEach((ev) => {
      const key = format(new Date(ev.start_time), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

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
            <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
            <p className="text-sm text-muted-foreground">
              DOB appointments, inspections & project milestones
            </p>
          </div>
          <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground min-w-[180px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
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
            <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden">
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayEvents = eventsByDay[key] || [];
                const inMonth = isSameMonth(day, currentMonth);
                const today = isToday(day);
                const selected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <div
                    key={key}
                    onClick={() => {
                      setSelectedDate(day);
                    }}
                    className={cn(
                      "min-h-[100px] p-1.5 border-b border-r border-border cursor-pointer transition-colors",
                      !inMonth && "bg-muted/30",
                      selected && "bg-accent/50",
                      "hover:bg-accent/30"
                    )}
                  >
                    <div
                      className={cn(
                        "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                        !inMonth && "text-muted-foreground/50",
                        today && "bg-primary text-primary-foreground",
                        inMonth && !today && "text-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <button
                          key={ev.id}
                          onClick={(e) => handleEventClick(e, ev)}
                          className={cn(
                            "w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded border truncate",
                            EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general
                          )}
                        >
                          {ev.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-muted-foreground pl-1">
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
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm text-foreground">
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
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No events
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedDayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded-lg border border-border p-3 space-y-1.5 hover:bg-accent/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-foreground leading-tight">
                              {ev.title}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] shrink-0",
                                EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general
                              )}
                            >
                              {ev.event_type}
                            </Badge>
                          </div>
                          {!ev.all_day && (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(ev.start_time), "h:mm a")} –{" "}
                              {format(new Date(ev.end_time), "h:mm a")}
                            </p>
                          )}
                          {ev.location && (
                            <p className="text-xs text-muted-foreground truncate">
                              📍 {ev.location}
                            </p>
                          )}
                          <div className="flex gap-1 pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={(e) => handleEventClick(e, ev)}
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
