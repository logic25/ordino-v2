import { useState, useEffect } from "react";
import { useTodayAttendance, useClockOut } from "@/hooks/useAttendance";
import { useProjectTimer } from "@/hooks/useProjectTimer";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ActiveTimerBar({ onClockOut }: { onClockOut?: () => void }) {
  const { data: attendance } = useTodayAttendance();
  const clockOut = useClockOut();
  const { toast } = useToast();
  const [elapsed, setElapsed] = useState("");
  const projectTimer = useProjectTimer();

  const isActive = attendance && !attendance.clock_out;

  useEffect(() => {
    if (!isActive || !attendance?.clock_in) return;

    const update = () => {
      const diff = Date.now() - new Date(attendance.clock_in).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isActive, attendance?.clock_in]);

  const handleClockOut = async () => {
    if (onClockOut) {
      onClockOut();
      return;
    }
    try {
      await clockOut.mutateAsync({ id: attendance!.id });
      toast({ title: "Clocked out", description: "Your attendance has been recorded." });
    } catch {
      toast({ title: "Error", description: "Failed to clock out.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2">
      {isActive && (
        <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-accent/10 border border-accent/30">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
            <Clock className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium">Clocked in</span>
          </div>
          <span className="text-xl font-bold tabular-nums font-mono">{elapsed}</span>
          <span className="text-xs text-muted-foreground">
            since {new Date(attendance!.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <div className="ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={handleClockOut}
              className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Clock Out
            </Button>
          </div>
        </div>
      )}

      {projectTimer.isRunning && projectTimer.timer && (
        <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-primary/10 border border-primary/30">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Project Timer</span>
          </div>
          <span className="text-sm font-medium truncate max-w-[200px]">{projectTimer.timer.projectName}</span>
          <span className="text-xl font-bold tabular-nums font-mono">{projectTimer.elapsed}</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => projectTimer.cancel()}
              className="border-muted-foreground text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => projectTimer.stop()}
              className="bg-primary text-primary-foreground"
            >
              <Square className="h-3 w-3 mr-2" />
              Stop & Log
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
