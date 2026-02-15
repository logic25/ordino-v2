import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useTodayAttendance, useClockOut } from "@/hooks/useAttendance";
import { useTodaySummary, formatMinutes } from "@/hooks/useTimeEntries";
import { useToast } from "@/hooks/use-toast";
import { Clock, LogOut, AlarmClock, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "clockout-dismissed";
const SNOOZE_KEY = "clockout-snooze-until";
const MAX_SNOOZES = 2;
const SNOOZE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export function ClockOutModal() {
  const { data: attendance } = useTodayAttendance();
  const { data: todaySummary } = useTodaySummary();
  const clockOut = useClockOut();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [snoozeCount, setSnoozeCount] = useState(0);
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);
  const [snoozeRemaining, setSnoozeRemaining] = useState(0);

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

  // Load persisted snooze state on mount
  useEffect(() => {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return;
    try {
      const { until, count, date } = JSON.parse(raw);
      const today = new Date().toISOString().split("T")[0];
      if (date === today && until > Date.now()) {
        setSnoozeUntil(until);
        setSnoozeCount(count);
      } else {
        localStorage.removeItem(SNOOZE_KEY);
      }
    } catch {
      localStorage.removeItem(SNOOZE_KEY);
    }
  }, []);

  // Countdown timer for snooze
  useEffect(() => {
    if (!snoozeUntil) {
      setSnoozeRemaining(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, snoozeUntil - Date.now());
      setSnoozeRemaining(remaining);
      if (remaining <= 0) {
        setSnoozeUntil(null);
        localStorage.removeItem(SNOOZE_KEY);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [snoozeUntil]);

  // Trigger modal at 5 PM (or when snooze expires)
  useEffect(() => {
    if (!isActive) return;

    const check = () => {
      const now = new Date();
      const isPast5PM = now.getHours() >= 17;
      const isSnoozed = snoozeUntil && Date.now() < snoozeUntil;

      if (isPast5PM && !isSnoozed && !isDismissedToday()) {
        setOpen(true);
      }
    };

    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [isActive, snoozeUntil, isDismissedToday]);

  const handleDismiss = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: new Date().toISOString().split("T")[0] })
    );
    setOpen(false);
  };

  const handleSnooze = () => {
    if (snoozeCount < MAX_SNOOZES) {
      const until = Date.now() + SNOOZE_DURATION_MS;
      const newCount = snoozeCount + 1;
      setSnoozeUntil(until);
      setSnoozeCount(newCount);
      localStorage.setItem(
        SNOOZE_KEY,
        JSON.stringify({
          until,
          count: newCount,
          date: new Date().toISOString().split("T")[0],
        })
      );
      setOpen(false);
    }
  };

  const handleClockOut = async () => {
    if (!attendance) return;
    try {
      await clockOut.mutateAsync({ id: attendance.id, notes: notes || undefined });
      toast({ title: "Clocked out!", description: "Have a great evening." });
      setOpen(false);
      setSnoozeUntil(null);
      localStorage.removeItem(SNOOZE_KEY);
      handleDismiss();
    } catch {
      toast({ title: "Error", description: "Failed to clock out.", variant: "destructive" });
    }
  };

  const handleCancelSnooze = () => {
    setSnoozeUntil(null);
    localStorage.removeItem(SNOOZE_KEY);
    setOpen(true);
  };

  // Compute elapsed time
  const elapsed = attendance?.clock_in
    ? Math.round((Date.now() - new Date(attendance.clock_in).getTime()) / 60000)
    : 0;

  const attributed = todaySummary?.totalMinutes ?? 0;
  const gap = Math.max(0, elapsed - attributed);

  if (!isActive) return null;

  // Format remaining snooze time
  const snoozeMinutes = Math.floor(snoozeRemaining / 60000);
  const snoozeSeconds = Math.floor((snoozeRemaining % 60000) / 1000);
  const snoozeProgress = snoozeUntil
    ? ((SNOOZE_DURATION_MS - snoozeRemaining) / SNOOZE_DURATION_MS) * 100
    : 0;

  return (
    <>
      {/* Snooze countdown banner */}
      {snoozeUntil && snoozeRemaining > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-accent/10 border-b border-accent/20 backdrop-blur-sm">
          <div className="max-w-screen-lg mx-auto flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Timer className="h-4 w-4 text-accent" />
              <span className="font-medium">Clock-out snoozed</span>
              <span className="tabular-nums text-accent font-bold">
                {snoozeMinutes}:{snoozeSeconds.toString().padStart(2, "0")}
              </span>
              <span className="text-muted-foreground">remaining</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCancelSnooze} className="text-xs h-7">
              Dismiss & Clock Out
            </Button>
          </div>
          <Progress value={snoozeProgress} className="h-0.5 rounded-none" />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlarmClock className="h-5 w-5 text-accent" />
              Time to Clock Out?
            </DialogTitle>
            <DialogDescription>
              You've been clocked in for {formatMinutes(elapsed)} today.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted p-3">
                <div className="text-lg font-bold tabular-nums">{formatMinutes(elapsed)}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <button
                type="button"
                className="rounded-lg bg-muted p-3 hover:bg-muted/70 transition-colors cursor-pointer"
                onClick={() => { setOpen(false); navigate("/time"); }}
                title="Log time entries"
              >
                <div className="text-lg font-bold tabular-nums">{formatMinutes(attributed)}</div>
                <div className="text-xs text-muted-foreground">Attributed</div>
              </button>
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

          <DialogFooter className="flex-col sm:flex-row gap-2 px-1">
            {snoozeCount < MAX_SNOOZES && (
              <Button variant="outline" size="sm" onClick={handleSnooze} className="mr-auto">
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
    </>
  );
}
