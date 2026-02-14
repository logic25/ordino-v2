import { useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useTimeEntries, formatMinutes } from "@/hooks/useTimeEntries";
import { format, addDays, startOfWeek, isSameDay, parseISO } from "date-fns";

interface WeeklyTimesheetProps {
  weekStart: Date;
}

export function WeeklyTimesheet({ weekStart }: WeeklyTimesheetProps) {
  const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const from = format(days[0], "yyyy-MM-dd");
  const to = format(days[6], "yyyy-MM-dd");

  const { data: entries, isLoading } = useTimeEntries({ from, to });

  // Group entries by project → day
  const { projectRows, dayTotals, grandTotal } = useMemo(() => {
    const projectMap = new Map<string, { label: string; byDay: number[] }>();

    for (const entry of (entries ?? []) as any[]) {
      const projectLabel =
        entry.dob_applications?.properties?.address ??
        entry.dob_applications?.job_number ??
        "Unassigned";

      const projectKey = entry.application_id ?? "unassigned";

      if (!projectMap.has(projectKey)) {
        projectMap.set(projectKey, { label: projectLabel, byDay: Array(7).fill(0) });
      }

      const entryDate = entry.activity_date ? parseISO(entry.activity_date) : null;
      if (entryDate) {
        const dayIdx = days.findIndex((d) => isSameDay(d, entryDate));
        if (dayIdx >= 0) {
          projectMap.get(projectKey)!.byDay[dayIdx] += entry.duration_minutes ?? 0;
        }
      }
    }

    const projectRows = Array.from(projectMap.values());
    const dayTotals = days.map((_, i) =>
      projectRows.reduce((sum, row) => sum + row.byDay[i], 0)
    );
    const grandTotal = dayTotals.reduce((a, b) => a + b, 0);

    return { projectRows, dayTotals, grandTotal };
  }, [entries, days]);

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading timesheet…</div>;
  }

  if (projectRows.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No time logged this week. Use "Log Time" to attribute your hours.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[180px]">Project</TableHead>
            {days.map((d) => (
              <TableHead key={d.toISOString()} className="text-center min-w-[70px]">
                <div className="text-xs">{format(d, "EEE")}</div>
                <div className="text-xs text-muted-foreground">{format(d, "MMM d")}</div>
              </TableHead>
            ))}
            <TableHead className="text-center font-bold min-w-[70px]">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projectRows.map((row, idx) => {
            const rowTotal = row.byDay.reduce((a, b) => a + b, 0);
            return (
              <TableRow key={idx}>
                <TableCell className="font-medium truncate max-w-[180px]">
                  {row.label}
                </TableCell>
                {row.byDay.map((mins, i) => (
                  <TableCell key={i} className="text-center tabular-nums text-sm">
                    {mins > 0 ? formatMinutes(mins) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-center tabular-nums font-semibold">
                  {formatMinutes(rowTotal)}
                </TableCell>
              </TableRow>
            );
          })}
          {/* Totals Row */}
          <TableRow className="border-t-2 border-border bg-muted/50">
            <TableCell className="font-bold">Daily Total</TableCell>
            {dayTotals.map((t, i) => (
              <TableCell key={i} className="text-center tabular-nums font-bold">
                {t > 0 ? formatMinutes(t) : "—"}
              </TableCell>
            ))}
            <TableCell className="text-center tabular-nums font-bold text-accent">
              {formatMinutes(grandTotal)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
