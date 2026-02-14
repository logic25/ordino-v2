import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCreateTimeEntry } from "@/hooks/useTimeEntries";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface TimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TimeEntryDialog({ open, onOpenChange }: TimeEntryDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const createEntry = useCreateTimeEntry();

  const [applicationId, setApplicationId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [durationHours, setDurationHours] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [activityDate, setActivityDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const { data: applications } = useQuery({
    queryKey: ["applications-for-time", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("dob_applications")
        .select("id, job_number, property_id, properties(address)")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.company_id && open,
  });

  const { data: services } = useQuery({
    queryKey: ["services-for-time", applicationId],
    queryFn: async () => {
      if (!applicationId) return [];
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("application_id", applicationId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!applicationId && open,
  });

  const reset = () => {
    setApplicationId("");
    setServiceId("");
    setDurationHours("");
    setDurationMinutes("");
    setDescription("");
    setActivityDate(new Date().toISOString().split("T")[0]);
  };

  const handleSubmit = async () => {
    const totalMinutes =
      (parseInt(durationHours || "0") * 60) + parseInt(durationMinutes || "0");

    if (totalMinutes <= 0) {
      toast({ title: "Duration required", description: "Enter time spent.", variant: "destructive" });
      return;
    }

    try {
      await createEntry.mutateAsync({
        activity_type: "time_log",
        application_id: applicationId || null,
        service_id: serviceId || null,
        duration_minutes: totalMinutes,
        description: description || null,
        activity_date: activityDate,
      });
      toast({ title: "Time logged", description: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m recorded.` });
      reset();
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to log time.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Time</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={applicationId} onValueChange={(v) => { setApplicationId(v); setServiceId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select project…" />
              </SelectTrigger>
              <SelectContent>
                {(applications ?? []).map((app: any) => (
                  <SelectItem key={app.id} value={app.id}>
                    {app.properties?.address ?? app.job_number ?? app.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {applicationId && (
            <div className="space-y-1.5">
              <Label>Service</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service…" />
                </SelectTrigger>
                <SelectContent>
                  {(services ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Duration</Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">h</span>
              <Input
                type="number"
                min={0}
                max={59}
                placeholder="0"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">m</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>What did you work on?</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Reviewed plans, filed DOB application, site visit…"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={createEntry.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90 glow-amber"
          >
            {createEntry.isPending ? "Saving…" : "Log Time"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
