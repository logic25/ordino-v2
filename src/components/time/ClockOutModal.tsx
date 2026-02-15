import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTodayAttendance, useClockOut } from "@/hooks/useAttendance";
import { useTodaySummary, formatMinutes } from "@/hooks/useTimeEntries";
import { useToast } from "@/hooks/use-toast";
import { Clock, LogOut, AlarmClock } from "lucide-react";

const STORAGE_KEY = "clockout-dismissed";
const MAX_SNOOZES = 2;

export function ClockOutModal() {
  const { data: attendance } = useTodayAttendance();
  const { data: todaySummary } = useTodaySummary();
  const clockOut = useClockOut();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [snoozeCount, setSnoozeCount] = useState(0);

  const isActive = attendance && !attendance.clock_out;

  const isDismissedToday = useCallback(() => {
    const val = localStorage.getItem(STORAGE_KEY);
    if (!val) return false;
    try {
      const { date } = JSON.parse(val);
      return date === new Date().toISOString().split("T")[0];
    } catch {
      return false;
    }
  }, []);

  // Check every minute if it's 5 PM
  useEffect(() => {
    if (!isActive) return;

    const check = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const triggerHour = 17;
      const triggerMinute = snoozeCount * 30;

      if (hour >= triggerHour && minute >= triggerMinute && !isDismissedToday()) {
        setOpen(true);
      }
    };

    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [isActive, snoozeCount, isDismissedToday]);

  const handleDismiss = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: new Date().toISOString().split("T")[0] })
    );
    setOpen(false);
  };

  const handleSnooze = () => {
    if (snoozeCount < MAX_SNOOZES) {
      setSnoozeCount((c) => c + 1);
      setOpen(false);
    }
  };

  const handleClockOut = async () => {
    if (!attendance) return;
    try {
      await clockOut.mutateAsync({ id: attendance.id, notes: notes || undefined });
      toast({ title: "Clocked out!", description: "Have a great evening." });
      setOpen(false);
      handleDismiss();
    } catch {
      toast({ title: "Error", description: "Failed to clock out.", variant: "destructive" });
    }
  };

  // Compute elapsed time
  const elapsed = attendance?.clock_in
    ? Math.round((Date.now() - new Date(attendance.clock_in).getTime()) / 60000)
    : 0;

  const attributed = todaySummary?.totalMinutes ?? 0;
  const gap = Math.max(0, elapsed - attributed);

  if (!isActive) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlarmClock className="h-5 w-5 text-accent" />
            Time to Clock Out?
          </DialogTitle>
          <DialogDescription>
            You've been clocked in for {formatMinutes(elapsed)} today.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-hidden">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-muted p-3">
              <div className="text-lg font-bold tabular-nums">{formatMinutes(elapsed)}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="text-lg font-bold tabular-nums">{formatMinutes(attributed)}</div>
              <div className="text-xs text-muted-foreground">Attributed</div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="text-lg font-bold tabular-nums text-warning">{formatMinutes(gap)}</div>
              <div className="text-xs text-muted-foreground">Gap</div>
            </div>
          </div>

          {gap > 0 && (
            <p className="text-sm text-warning">
              You have {formatMinutes(gap)} of unattributed time. Consider logging time entries before clocking out.
            </p>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>End-of-day notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to note about today?"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {snoozeCount < MAX_SNOOZES && (
            <Button variant="ghost" size="sm" onClick={handleSnooze}>
              <Clock className="h-4 w-4 mr-1" />
              Snooze 30m
            </Button>
          )}
          <Button variant="outline" onClick={handleDismiss}>
            Keep Working
          </Button>
          <Button
            onClick={handleClockOut}
            disabled={clockOut.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90 glow-amber"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {clockOut.isPending ? "Clocking out…" : "Clock Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
