import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAttendanceLogs, type AttendanceWithProfile } from "@/hooks/useAttendance";
import { formatMinutes } from "@/hooks/useTimeEntries";
import { format } from "date-fns";

interface AttendanceTableProps {
  dateRange?: { from: string; to: string };
}

export function AttendanceTable({ dateRange }: AttendanceTableProps) {
  const { data: logs, isLoading } = useAttendanceLogs(dateRange);

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading attendance…</div>;
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No attendance records for this period.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team Member</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Clock In</TableHead>
            <TableHead>Clock Out</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <AttendanceRow key={log.id} log={log} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AttendanceRow({ log }: { log: AttendanceWithProfile }) {
  const name =
    log.profiles?.display_name ??
    [log.profiles?.first_name, log.profiles?.last_name].filter(Boolean).join(" ") ??
    "Unknown";

  const clockInTime = new Date(log.clock_in).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const clockOutTime = log.clock_out
    ? new Date(log.clock_out).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const isActive = !log.clock_out;

  return (
    <TableRow>
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell>{format(new Date(log.log_date), "MMM d, yyyy")}</TableCell>
      <TableCell className="tabular-nums">{clockInTime}</TableCell>
      <TableCell className="tabular-nums">
        {clockOutTime ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>{log.clock_in_location ?? "—"}</TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {log.total_minutes != null ? formatMinutes(log.total_minutes) : (
          isActive ? (
            <span className="text-success">running…</span>
          ) : "—"
        )}
      </TableCell>
      <TableCell>
        {isActive ? (
          <Badge className="status-approved text-xs">Active</Badge>
        ) : log.auto_closed ? (
          <Badge variant="outline" className="text-xs text-warning border-warning/30">Auto-closed</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">Complete</Badge>
        )}
      </TableCell>
    </TableRow>
  );
}
