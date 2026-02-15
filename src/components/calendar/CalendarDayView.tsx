import { format, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_COLORS, type UnifiedEvent } from "./calendarConstants";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

interface CalendarDayViewProps {
  currentDate: Date;
  eventsByDay: Record<string, UnifiedEvent[]>;
  onEventClick: (ev: CalendarEvent) => void;
}

export function CalendarDayView({ currentDate, eventsByDay, onEventClick }: CalendarDayViewProps) {
  const key = format(currentDate, "yyyy-MM-dd");
  const dayEvents = eventsByDay[key] || [];
  const allDayEvents = dayEvents.filter((ev) => ev.all_day);
  const timedEvents = dayEvents.filter((ev) => !ev.all_day);
  const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6am-9pm
  const today = isToday(currentDate);

  return (
    <div className="flex-1 overflow-auto">
      {/* Day header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border p-3 flex items-center gap-3">
        <div
          className={cn(
            "text-2xl font-bold w-12 h-12 flex items-center justify-center rounded-full",
            today && "bg-primary text-primary-foreground"
          )}
        >
          {format(currentDate, "d")}
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">{format(currentDate, "EEEE")}</div>
          <div className="text-xs text-muted-foreground">{format(currentDate, "MMMM yyyy")}</div>
        </div>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-border p-2 bg-card">
          <div className="text-[10px] text-muted-foreground mb-1 uppercase font-semibold">All Day</div>
          <div className="space-y-1">
            {allDayEvents.map((ev) => (
              <button
                key={ev.id}
                onClick={() => !ev.is_billing && onEventClick(ev as CalendarEvent)}
                className={cn(
                  "w-full text-left text-xs px-2 py-1.5 rounded border font-medium",
                  EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general,
                  ev.is_billing && "italic"
                )}
              >
                {ev.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hourly grid */}
      <div>
        {hours.map((hour) => {
          const hourEvents = timedEvents.filter((ev) => new Date(ev.start_time).getHours() === hour);
          return (
            <div key={hour} className="flex border-b border-border/60 min-h-[64px] hover:bg-accent/10 transition-colors">
              <div className="w-16 shrink-0 text-[11px] text-muted-foreground text-right pr-3 pt-1 border-r border-border bg-muted/30 font-medium">
                {format(new Date(2000, 0, 1, hour), "h a")}
              </div>
              <div className="flex-1 p-1 space-y-0.5">
                {hourEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => !ev.is_billing && onEventClick(ev as CalendarEvent)}
                    className={cn(
                      "w-full text-left text-xs px-2 py-1.5 rounded border font-medium",
                      EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general,
                      ev.is_billing && "italic"
                    )}
                  >
                    <span className="font-semibold">{format(new Date(ev.start_time), "h:mm a")}</span>
                    {" – "}
                    {ev.title}
                    {ev.location && (
                      <span className="text-muted-foreground ml-1">📍 {ev.location}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
