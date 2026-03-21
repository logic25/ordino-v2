import { useState, useRef, useCallback } from "react";
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
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-card rounded-t-xl sticky top-0 z-10 shadow-sm">
        <div className="p-2 border-r border-border" />
        {days.map((day) => {
          const today = isToday(day);
          const selected = selectedDate && isSameDay(day, selectedDate);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                "p-2 text-center cursor-pointer border-l border-border/50 transition-colors",
                selected && "bg-primary/5",
                !selected && "hover:bg-accent/20"
              )}
            >
              <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
              <div
                className={cn(
                  "text-sm font-bold w-8 h-8 mx-auto flex items-center justify-center rounded-full",
                  today && "bg-primary text-primary-foreground",
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
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-card">
        <div className="p-1 text-[10px] text-muted-foreground text-right pr-2 pt-2 border-r border-border font-semibold">All day</div>
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const allDayEvents = (eventsByDay[key] || []).filter((ev) => ev.all_day);
          const cellKey = `allday-${key}`;
          return (
            <div
              key={key}
              className={cn(
                "border-l border-border/50 p-1 min-h-[32px] transition-colors",
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
                    "w-full text-left text-[10px] px-1.5 py-0.5 rounded border truncate font-medium mb-0.5 cursor-grab active:cursor-grabbing",
                    EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general,
                    ev.is_billing && "italic cursor-default"
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
      <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-card border border-border rounded-b-xl overflow-hidden">
        {hours.map((hour) => (
          <div key={hour} className="contents">
            <div className="text-[11px] text-muted-foreground text-right pr-2 pt-1 h-16 border-b border-border/60 border-r border-border font-medium bg-muted/30">
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
              return (
                <div
                  key={cellKey}
                  className={cn(
                    "border-l border-b border-border/60 h-16 p-0.5 relative hover:bg-accent/10 transition-colors",
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
                        "w-full text-left text-[10px] px-1.5 py-0.5 rounded border truncate font-medium mb-0.5 cursor-grab active:cursor-grabbing",
                        EVENT_TYPE_COLORS[ev.event_type] || EVENT_TYPE_COLORS.general,
                        ev.is_billing && "italic cursor-default"
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
