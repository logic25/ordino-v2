import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { MockTimeEntry } from "../projectMockData";

export function TimeLogsTab({ timeEntries }: { timeEntries: MockTimeEntry[] }) {
  if (timeEntries.length === 0) return <p className="text-sm text-muted-foreground italic p-4">No time logged.</p>;
  const totalHours = timeEntries.reduce((s, t) => s + t.hours, 0);
  return (
    <div className="p-4">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs uppercase tracking-wider">Date</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Team Member</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Service</TableHead>
            <TableHead className="text-xs uppercase tracking-wider">Description</TableHead>
            <TableHead className="text-xs uppercase tracking-wider text-right">Hours</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {timeEntries.map((te) => (
            <TableRow key={te.id} className="hover:bg-muted/20">
              <TableCell className="text-sm font-mono">{te.date}</TableCell>
              <TableCell className="text-sm">{te.user}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{te.service}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{te.description}</TableCell>
              <TableCell className="text-sm text-right tabular-nums font-medium">{te.hours.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="pt-2 text-xs text-muted-foreground text-right">
        Total: <span className="font-semibold text-foreground">{totalHours.toFixed(2)} hrs</span>
      </div>
    </div>
  );
}
