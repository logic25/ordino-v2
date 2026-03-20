import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useUpdateTimeEntry } from "@/hooks/useTimeEntries";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface TimeEntryEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: {
    id: string;
    duration_minutes: number | null;
    description: string | null;
    activity_date: string | null;
    billable: boolean | null;
  };
}

export function TimeEntryEditDialog({ open, onOpenChange, entry }: TimeEntryEditDialogProps) {
  const [hours, setHours] = useState(Math.floor((entry.duration_minutes || 0) / 60).toString());
  const [minutes, setMinutes] = useState(((entry.duration_minutes || 0) % 60).toString());
  const [description, setDescription] = useState(entry.description || "");
  const [date, setDate] = useState(entry.activity_date || new Date().toISOString().split("T")[0]);
  const [billable, setBillable] = useState(entry.billable ?? true);
  const updateEntry = useUpdateTimeEntry();
  const { toast } = useToast();

  const handleSave = async () => {
    const totalMinutes = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        duration_minutes: totalMinutes,
        description: description || undefined,
        activity_date: date,
        billable,
      });
      toast({ title: "Entry updated" });
      onOpenChange(false);
    } catch {
      toast({ title: "Error updating entry", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Time Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>Hours</Label>
              <Input type="number" min="0" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label>Minutes</Label>
              <Input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="billable" checked={billable} onCheckedChange={(c) => setBillable(!!c)} />
            <Label htmlFor="billable">Billable</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateEntry.isPending}>
            {updateEntry.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
