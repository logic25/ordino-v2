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
    <div className="rounded-2xl cal-glass cal-depth-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg hover:bg-accent/10" onClick={() => setViewMonth(subMonths(viewMonth, 1))}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-bold text-foreground tracking-tight">{format(viewMonth, "MMM yyyy")}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg hover:bg-accent/10" onClick={() => setViewMonth(addMonths(viewMonth, 1))}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/40 py-1">{d}</div>
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
                "w-7 h-7 flex items-center justify-center text-[11px] rounded-lg transition-all duration-200",
                !inMonth && "text-muted-foreground/20",
                inMonth && !today && !selected && "text-foreground/80 hover:bg-accent/15 hover:text-foreground",
                today && !selected && "bg-primary/10 text-primary font-bold",
                selected && "bg-primary text-primary-foreground font-bold shadow-sm"
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
