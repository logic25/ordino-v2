import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTimeEntries, useDeleteTimeEntry, formatMinutes } from "@/hooks/useTimeEntries";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TimeEntriesTableProps {
  dateRange?: { from: string; to: string };
}

export function TimeEntriesTable({ dateRange }: TimeEntriesTableProps) {
  const { data: entries, isLoading } = useTimeEntries(dateRange);
  const deleteEntry = useDeleteTimeEntry();
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    try {
      await deleteEntry.mutateAsync(id);
      toast({ title: "Entry deleted" });
    } catch {
      toast({ title: "Error deleting entry", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading entries…</div>;
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No time entries for this period. Click "Log Time" to add one.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Service</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry: any) => (
            <TableRow key={entry.id}>
              <TableCell className="tabular-nums">
                {entry.activity_date
                  ? format(new Date(entry.activity_date), "MMM d")
                  : "—"}
              </TableCell>
              <TableCell className="max-w-[180px] truncate">
                {entry.dob_applications?.properties?.address ??
                  entry.dob_applications?.job_number ??
                  "—"}
              </TableCell>
              <TableCell>{entry.services?.name ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {entry.duration_minutes
                  ? formatMinutes(entry.duration_minutes)
                  : "—"}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                {entry.description ?? "—"}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(entry.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
