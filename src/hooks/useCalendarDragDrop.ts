import { useCallback } from "react";
import { useUpdateCalendarEvent } from "@/hooks/useCalendarEvents";
import { useToast } from "@/hooks/use-toast";
import { format, setHours, setMinutes } from "date-fns";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

export function useCalendarDragDrop() {
  const updateEvent = useUpdateCalendarEvent();
  const { toast } = useToast();

  const moveEventToDate = useCallback(
    async (event: CalendarEvent, newDate: Date) => {
      const oldStart = new Date(event.start_time);
      const oldEnd = new Date(event.end_time);
      const durationMs = oldEnd.getTime() - oldStart.getTime();

      // Keep same time-of-day, change date
      const newStart = new Date(newDate);
      newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
      const newEnd = new Date(newStart.getTime() + durationMs);

      const pad = (n: number) => String(n).padStart(2, "0");
      const toLocalISO = (d: Date) => {
        const off = -d.getTimezoneOffset();
        const sign = off >= 0 ? "+" : "-";
        const hh = pad(Math.floor(Math.abs(off) / 60));
        const mm = pad(Math.abs(off) % 60);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${hh}:${mm}`;
      };

      try {
        await updateEvent.mutateAsync({
          event_id: event.id,
          title: event.title,
          description: event.description || undefined,
          location: event.location || undefined,
          start_time: event.all_day ? `${format(newStart, "yyyy-MM-dd")}T00:00:00` : toLocalISO(newStart),
          end_time: event.all_day ? `${format(newEnd, "yyyy-MM-dd")}T23:59:59` : toLocalISO(newEnd),
          all_day: event.all_day,
          event_type: event.event_type,
          project_id: event.project_id || undefined,
        });
        toast({ title: `Moved "${event.title}" to ${format(newStart, "MMM d")}` });
      } catch (err: any) {
        toast({ title: "Failed to move event", description: err.message, variant: "destructive" });
      }
    },
    [updateEvent, toast]
  );

  const moveEventToTime = useCallback(
    async (event: CalendarEvent, newDate: Date, hour: number) => {
      const oldStart = new Date(event.start_time);
      const oldEnd = new Date(event.end_time);
      const durationMs = oldEnd.getTime() - oldStart.getTime();

      const newStart = setMinutes(setHours(new Date(newDate), hour), oldStart.getMinutes());
      const newEnd = new Date(newStart.getTime() + durationMs);

      const pad = (n: number) => String(n).padStart(2, "0");
      const toLocalISO = (d: Date) => {
        const off = -d.getTimezoneOffset();
        const sign = off >= 0 ? "+" : "-";
        const hh = pad(Math.floor(Math.abs(off) / 60));
        const mm = pad(Math.abs(off) % 60);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${hh}:${mm}`;
      };

      try {
        await updateEvent.mutateAsync({
          event_id: event.id,
          title: event.title,
          description: event.description || undefined,
          location: event.location || undefined,
          start_time: toLocalISO(newStart),
          end_time: toLocalISO(newEnd),
          all_day: false,
          event_type: event.event_type,
          project_id: event.project_id || undefined,
        });
        toast({ title: `Moved "${event.title}" to ${format(newStart, "MMM d, h:mm a")}` });
      } catch (err: any) {
        toast({ title: "Failed to move event", description: err.message, variant: "destructive" });
      }
    },
    [updateEvent, toast]
  );

  return { moveEventToDate, moveEventToTime, isPending: updateEvent.isPending };
}
