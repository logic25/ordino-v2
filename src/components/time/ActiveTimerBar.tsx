import { useState, useEffect } from "react";
import { useTodayAttendance, useClockOut } from "@/hooks/useAttendance";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ActiveTimerBar({ onClockOut }: { onClockOut?: () => void }) {
  const { data: attendance } = useTodayAttendance();
  const clockOut = useClockOut();
  const { toast } = useToast();
  const [elapsed, setElapsed] = useState("");

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

  if (!isActive) return null;

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
  );
}
