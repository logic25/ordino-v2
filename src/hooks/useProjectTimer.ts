import { useState, useEffect, useCallback } from "react";
import { useCreateTimeEntry } from "./useTimeEntries";
import { useToast } from "./use-toast";

interface TimerState {
  projectId: string;
  projectName: string;
  applicationId?: string;
  startedAt: number; // epoch ms
}

const TIMER_KEY = "project_active_timer";

export function useProjectTimer() {
  const [timer, setTimer] = useState<TimerState | null>(() => {
    try {
      const saved = localStorage.getItem(TIMER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [elapsed, setElapsed] = useState("");
  const createEntry = useCreateTimeEntry();
  const { toast } = useToast();

  // Sync elapsed time
  useEffect(() => {
    if (!timer) { setElapsed(""); return; }

    const update = () => {
      const diff = Date.now() - timer.startedAt;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const start = useCallback((projectId: string, projectName: string, applicationId?: string) => {
    const state: TimerState = { projectId, projectName, applicationId, startedAt: Date.now() };
    localStorage.setItem(TIMER_KEY, JSON.stringify(state));
    setTimer(state);
  }, []);

  const stop = useCallback(async () => {
    if (!timer) return;
    const durationMs = Date.now() - timer.startedAt;
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));

    try {
      await createEntry.mutateAsync({
        activity_type: "time_log",
        duration_minutes: durationMinutes,
        description: `Timer: ${timer.projectName}`,
        application_id: timer.applicationId || undefined,
        activity_date: new Date().toISOString().split("T")[0],
        billable: true,
      });
      toast({ title: "Time logged", description: `${durationMinutes} minutes recorded for ${timer.projectName}` });
    } catch {
      toast({ title: "Error saving time entry", variant: "destructive" });
    }

    localStorage.removeItem(TIMER_KEY);
    setTimer(null);
  }, [timer, createEntry, toast]);

  const cancel = useCallback(() => {
    localStorage.removeItem(TIMER_KEY);
    setTimer(null);
  }, []);

  return { timer, elapsed, start, stop, cancel, isRunning: !!timer };
}
