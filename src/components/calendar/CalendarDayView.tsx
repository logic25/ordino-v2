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
  const hours = Array.from({ length: 16 }, (_, i) => i + 6);
  const today = isToday(currentDate);

  return (
    <div className="flex-1 overflow-auto rounded-2xl cal-glass cal-depth-md">
      {/* Day header */}
      <div className="sticky top-0 z-10 cal-glass-strong border-b border-border/30 p-4 flex items-center gap-4">
        <div
          className={cn(
            "text-2xl font-extrabold w-14 h-14 flex items-center justify-center rounded-2xl transition-all duration-300",
            today && "bg-primary text-primary-foreground shadow-lg cal-today-glow",
            !today && "bg-muted/50 text-foreground"
          )}
        >
          {format(currentDate, "d")}
        </div>
        <div>
          <div className="text-base font-bold text-foreground tracking-tight">{format(currentDate, "EEEE")}</div>
          <div className="text-xs text-muted-foreground/60">{format(currentDate, "MMMM yyyy")}</div>
        </div>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-border/20 p-3 cal-glass-subtle">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-2 font-semibold">All Day</div>
          <div className="space-y-1.5">
            {allDayEvents.map((ev) => (
              <button
                key={ev.id}
                onClick={() => !ev.is_billing && onEventClick(ev as CalendarEvent)}
                className={cn(
                  "w-full text-left text-xs px-3 py-2 rounded-xl border font-medium cal-event-chip",
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
            <div key={hour} className="flex border-b border-border/15 min-h-[68px] cal-cell-hover">
              <div className="w-16 shrink-0 text-[10px] text-muted-foreground/40 text-right pr-3 pt-2 border-r border-border/15 font-medium tabular-nums">
                {format(new Date(2000, 0, 1, hour), "h a")}
              </div>
              <div className="flex-1 p-1.5 space-y-1">
                {hourEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => !ev.is_billing && onEventClick(ev as CalendarEvent)}
                    className={cn(
                      "w-full text-left text-xs px-3 py-2 rounded-xl border font-medium cal-event-chip",
                      EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general,
                      ev.is_billing && "italic"
                    )}
                  >
                    <span className="font-semibold tabular-nums">{format(new Date(ev.start_time), "h:mm a")}</span>
                    {" – "}
                    {ev.title}
                    {ev.location && (
                      <span className="text-muted-foreground/60 ml-1.5">📍 {ev.location}</span>
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
