import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Bell, Receipt, FolderKanban, FileText, Mail, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface NotificationCategory {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const CATEGORIES: NotificationCategory[] = [
  { key: "billing_submissions", label: "Billing Submissions", description: "When PMs submit billing requests", icon: Receipt },
  { key: "project_updates", label: "Project Updates", description: "Assignments, checklist changes, status updates", icon: FolderKanban },
  { key: "proposal_activity", label: "Proposal Activity", description: "New proposals, status changes, follow-ups", icon: FileText },
  { key: "email_alerts", label: "Email Alerts", description: "New emails, follow-up reminders", icon: Mail },
  { key: "system_alerts", label: "System Alerts", description: "Feature updates, product news", icon: Megaphone },
];

type Frequency = "realtime" | "daily" | "weekly";

interface Preferences {
  [key: string]: { enabled: boolean; frequency: Frequency };
}

const DEFAULT_PREFS: Preferences = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, { enabled: true, frequency: "realtime" as Frequency }])
);

function useNotificationPreferences() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["notification-preferences"],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("user_id", session!.user.id)
        .single();
      if (error) throw error;
      const raw = (data?.notification_preferences as Record<string, any>) || {};
      const prefs: Preferences = { ...DEFAULT_PREFS };
      for (const key of Object.keys(prefs)) {
        if (raw[key]) {
          prefs[key] = { enabled: raw[key].enabled ?? true, frequency: raw[key].frequency ?? "realtime" };
        }
      }
      return prefs;
    },
  });
}

function useUpdateNotificationPreferences() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: Preferences) => {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: prefs as any })
        .eq("user_id", session!.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });
}

export function NotificationSettings() {
  const { data: prefs, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();
  const { toast } = useToast();
  const [local, setLocal] = useState<Preferences>(DEFAULT_PREFS);

  useEffect(() => {
    if (prefs) setLocal(prefs);
  }, [prefs]);

  const toggleEnabled = (key: string) => {
    setLocal((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  };

  const setFrequency = (key: string, frequency: Frequency) => {
    setLocal((prev) => ({ ...prev, [key]: { ...prev[key], frequency } }));
  };

  const handleSave = async () => {
    try {
      await updatePrefs.mutateAsync(local);
      toast({ title: "Preferences saved", description: "Your notification settings have been updated." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Control which notifications you receive and how often they're delivered.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {CATEGORIES.map((cat) => {
            const pref = local[cat.key];
            return (
              <div
                key={cat.key}
                className="flex items-center justify-between gap-4 p-4 rounded-lg border"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <cat.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <Label className="font-medium">{cat.label}</Label>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Select
                    value={pref.frequency}
                    onValueChange={(v) => setFrequency(cat.key, v as Frequency)}
                    disabled={!pref.enabled}
                  >
                    <SelectTrigger className="w-[120px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Realtime</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch checked={pref.enabled} onCheckedChange={() => toggleEnabled(cat.key)} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updatePrefs.isPending}>
          {updatePrefs.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
