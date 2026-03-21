import { useState } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_COLORS, type UnifiedEvent } from "./calendarConstants";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

interface CalendarWeekViewProps {
  currentDate: Date;
  selectedDate: Date | null;
  eventsByDay: Record<string, UnifiedEvent[]>;
  onSelectDate: (date: Date) => void;
  onEventClick: (ev: CalendarEvent) => void;
  onDropEvent?: (ev: CalendarEvent, targetDate: Date, targetHour?: number) => void;
}

export function CalendarWeekView({
  currentDate,
  selectedDate,
  eventsByDay,
  onSelectDate,
  onEventClick,
  onDropEvent,
}: CalendarWeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);

  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, ev: UnifiedEvent) => {
    if (ev.is_billing) { e.preventDefault(); return; }
    e.dataTransfer.setData("text/plain", JSON.stringify(ev));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, cellKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell(cellKey);
  };

  const handleDragLeave = () => setDragOverCell(null);

  const handleDrop = (e: React.DragEvent, day: Date, hour?: number) => {
    e.preventDefault();
    setDragOverCell(null);
    try {
      const ev = JSON.parse(e.dataTransfer.getData("text/plain")) as CalendarEvent;
      if (ev && onDropEvent) onDropEvent(ev, day, hour);
    } catch {}
  };

  return (
    <div className="flex-1 overflow-auto rounded-2xl cal-glass cal-depth-md">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/30 cal-glass-strong sticky top-0 z-10">
        <div className="p-2 border-r border-border/20" />
        {days.map((day) => {
          const today = isToday(day);
          const selected = selectedDate && isSameDay(day, selectedDate);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                "p-3 text-center cursor-pointer border-l border-border/20 transition-all duration-200",
                selected && "bg-primary/5",
                today && "cal-today-glow",
                !selected && "hover:bg-accent/10"
              )}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">{format(day, "EEE")}</div>
              <div
                className={cn(
                  "text-lg font-bold w-9 h-9 mx-auto flex items-center justify-center rounded-full transition-all duration-300",
                  today && "bg-primary text-primary-foreground shadow-md",
                  !today && "text-foreground"
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day events row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/20 cal-glass-subtle">
        <div className="p-1 text-[9px] uppercase tracking-widest text-muted-foreground/60 text-right pr-2 pt-2 border-r border-border/20 font-semibold">All day</div>
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const allDayEvents = (eventsByDay[key] || []).filter((ev) => ev.all_day);
          const cellKey = `allday-${key}`;
          return (
            <div
              key={key}
              className={cn(
                "border-l border-border/20 p-1 min-h-[36px] transition-all duration-200",
                dragOverCell === cellKey && "bg-primary/10 ring-1 ring-primary/30 ring-inset"
              )}
              onDragOver={(e) => handleDragOver(e, cellKey)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, day)}
            >
              {allDayEvents.slice(0, 2).map((ev) => (
                <button
                  key={ev.id}
                  draggable={!ev.is_billing}
                  onDragStart={(e) => handleDragStart(e, ev)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!ev.is_billing) onEventClick(ev as CalendarEvent);
                  }}
                  className={cn(
                    "w-full text-left text-[10px] px-2 py-1 rounded-lg border truncate font-medium mb-0.5 cal-event-chip",
                    EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general,
                    ev.is_billing && "italic cursor-default",
                    !ev.is_billing && "cursor-grab active:cursor-grabbing"
                  )}
                >
                  {ev.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)]">
        {hours.map((hour) => (
          <div key={hour} className="contents">
            <div className="text-[10px] text-muted-foreground/50 text-right pr-3 pt-1 h-16 border-b border-border/15 border-r border-border/20 font-medium tabular-nums">
              {format(new Date(2000, 0, 1, hour), "h a")}
            </div>
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const cellKey = `${key}-${hour}`;
              const dayEvents = (eventsByDay[key] || []).filter((ev) => {
                if (ev.all_day) return false;
                const evHour = new Date(ev.start_time).getHours();
                return evHour === hour;
              });
              const today = isToday(day);
              return (
                <div
                  key={cellKey}
                  className={cn(
                    "border-l border-b border-border/15 h-16 p-0.5 relative cal-cell-hover",
                    today && "bg-primary/[0.02]",
                    dragOverCell === cellKey && "bg-primary/10 ring-1 ring-primary/30 ring-inset"
                  )}
                  onClick={() => onSelectDate(day)}
                  onDragOver={(e) => handleDragOver(e, cellKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day, hour)}
                >
                  {dayEvents.map((ev) => (
                    <button
                      key={ev.id}
                      draggable={!ev.is_billing}
                      onDragStart={(e) => handleDragStart(e, ev)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!ev.is_billing) onEventClick(ev as CalendarEvent);
                      }}
                      className={cn(
                        "w-full text-left text-[10px] px-2 py-1 rounded-lg border truncate font-medium mb-0.5 cal-event-chip",
                        EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general,
                        ev.is_billing && "italic cursor-default",
                        !ev.is_billing && "cursor-grab active:cursor-grabbing"
                      )}
                    >
                      {format(new Date(ev.start_time), "h:mm")} {ev.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
