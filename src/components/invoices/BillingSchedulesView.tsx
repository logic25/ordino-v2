import { useState } from "react";
import { format } from "date-fns";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pause, Play, Trash2, Pencil } from "lucide-react";
import { useBillingSchedules, useUpdateBillingSchedule, useDeleteBillingSchedule } from "@/hooks/useBillingSchedules";
import { BillingScheduleDialog } from "@/components/invoices/BillingScheduleDialog";
import { toast } from "@/hooks/use-toast";

export function BillingSchedulesView() {
  const { data: schedules = [], isLoading } = useBillingSchedules();
  const updateSchedule = useUpdateBillingSchedule();
  const deleteSchedule = useDeleteBillingSchedule();
  const [dialogOpen, setDialogOpen] = useState(false);

  const toggleActive = async (id: string, currentlyActive: boolean) => {
    try {
      await updateSchedule.mutateAsync({ id, is_active: !currentlyActive });
      toast({ title: currentlyActive ? "Schedule paused" : "Schedule resumed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSchedule.mutateAsync(id);
      toast({ title: "Schedule deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Recurring Billing Schedules</h3>
          <p className="text-sm text-muted-foreground">Auto-bill services on a recurring basis</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Schedule
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Next Bill</TableHead>
            <TableHead>Last Billed</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
          ) : schedules.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No schedules configured. Click "New Schedule" to set up recurring billing.</TableCell></TableRow>
          ) : (
            schedules.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="text-sm font-medium">{s.projects?.project_number || "—"}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[180px]">{s.projects?.name || "—"}</div>
                </TableCell>
                <TableCell className="text-sm">{s.service_name}</TableCell>
                <TableCell className="text-sm tabular-nums font-medium">
                  {s.billing_method === "percentage" ? `${s.billing_value}%` : `$${Number(s.billing_value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] capitalize">{s.frequency}</Badge>
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {format(new Date(s.next_bill_date), "MM/dd/yyyy")}
                </TableCell>
                <TableCell className="text-sm tabular-nums text-muted-foreground">
                  {s.last_billed_at ? format(new Date(s.last_billed_at), "MM/dd/yyyy") : "Never"}
                </TableCell>
                <TableCell>
                  <Badge variant={s.is_active ? "default" : "secondary"} className="text-[10px]">
                    {s.is_active ? "Active" : "Paused"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(s.id, s.is_active)}>
                      {s.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <BillingScheduleDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
