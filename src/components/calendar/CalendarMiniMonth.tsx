import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CalendarMiniMonthProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

export function CalendarMiniMonth({ selectedDate, onSelectDate }: CalendarMiniMonthProps) {
  const [viewMonth, setViewMonth] = useState(selectedDate || new Date());

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewMonth(subMonths(viewMonth, 1))}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-semibold text-foreground">{format(viewMonth, "MMM yyyy")}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewMonth(addMonths(viewMonth, 1))}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth);
          const today = isToday(day);
          const selected = selectedDate && isSameDay(day, selectedDate);
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                "w-7 h-7 flex items-center justify-center text-[11px] rounded-full transition-colors",
                !inMonth && "text-muted-foreground/30",
                inMonth && !today && !selected && "text-foreground hover:bg-accent/40",
                today && !selected && "bg-primary/15 text-primary font-bold",
                selected && "bg-primary text-primary-foreground font-bold"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
