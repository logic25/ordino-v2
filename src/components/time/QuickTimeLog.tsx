import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCreateTimeEntry } from "@/hooks/useTimeEntries";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export function QuickTimeLog() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const createEntry = useCreateTimeEntry();

  const [applicationId, setApplicationId] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");

  const { data: applications } = useQuery({
    queryKey: ["applications-for-time", profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("dob_applications")
        .select("id, job_number, property_id, properties(address)")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.company_id,
  });

  const handleSubmit = async () => {
    const totalMinutes = Math.round(parseFloat(hours || "0") * 60);
    if (totalMinutes <= 0) {
      toast({ title: "Enter hours", variant: "destructive" });
      return;
    }

    try {
      await createEntry.mutateAsync({
        activity_type: "time_log",
        application_id: applicationId || null,
        duration_minutes: totalMinutes,
        description: description || null,
        activity_date: new Date().toISOString().split("T")[0],
      });
      toast({ title: "Time logged" });
      setApplicationId("");
      setHours("");
      setDescription("");
    } catch {
      toast({ title: "Failed to log", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card">
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Quick log:</span>

      <Select value={applicationId} onValueChange={setApplicationId}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Project…" />
        </SelectTrigger>
        <SelectContent>
          {(applications ?? []).map((app: any) => (
            <SelectItem key={app.id} value={app.id}>
              {app.properties?.address ?? app.job_number ?? app.id.slice(0, 8)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="number"
        min={0}
        step={0.25}
        placeholder="Hours"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        className="w-[80px]"
      />

      <Input
        placeholder="What did you do?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="flex-1 min-w-[150px]"
      />

      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={createEntry.isPending}
        className="bg-accent text-accent-foreground hover:bg-accent/90"
      >
        <Plus className="h-4 w-4 mr-1" />
        Log
      </Button>
    </div>
  );
}
