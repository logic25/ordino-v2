import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface NotificationPref {
  id: string;
  user_id: string;
  is_enabled: boolean;
  frequency: string;
  digest_day: string;
  digest_time: string;
  profile?: { id: string; first_name: string | null; last_name: string | null; display_name: string | null } | null;
}

function useBillingNotificationPrefs() {
  return useQuery({
    queryKey: ["billing-notification-prefs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_notification_preferences" as any)
        .select("*, profile:profiles!billing_notification_preferences_user_id_fkey (id, first_name, last_name, display_name)")
        .order("created_at");
      if (error) throw error;
      return (data || []) as unknown as NotificationPref[];
    },
  });
}

function useTeamMembers() {
  return useQuery({
    queryKey: ["team-members-for-notif"],
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("company_id").single();
      if (!profile?.company_id) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .eq("company_id", profile.company_id)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });
}

export function BillingNotificationSettings() {
  const { data: prefs = [], isLoading } = useBillingNotificationPrefs();
  const { data: team = [] } = useTeamMembers();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  const existingUserIds = prefs.map((p) => p.user_id);
  const availableUsers = team.filter((t) => !existingUserIds.includes(t.id));

  const addSubscriber = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("company_id").single();
      if (!profile?.company_id) throw new Error("No company");
      await supabase.from("billing_notification_preferences" as any).insert({
        company_id: profile.company_id,
        user_id: selectedUserId,
        is_enabled: true,
        frequency: "immediate",
      } as any);
      queryClient.invalidateQueries({ queryKey: ["billing-notification-prefs"] });
      setSelectedUserId("");
      toast({ title: "Subscriber added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const updatePref = async (id: string, field: string, value: any) => {
    try {
      await supabase.from("billing_notification_preferences" as any).update({ [field]: value } as any).eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["billing-notification-prefs"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const removePref = async (id: string) => {
    try {
      await supabase.from("billing_notification_preferences" as any).delete().eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["billing-notification-prefs"] });
      toast({ title: "Subscriber removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getName = (pref: NotificationPref) =>
    pref.profile?.display_name || `${pref.profile?.first_name || ""} ${pref.profile?.last_name || ""}`.trim() || "Unknown";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Billing Notification Subscribers</CardTitle>
        <CardDescription>Choose who gets notified when services are sent to billing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Digest Day</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : prefs.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No subscribers configured</TableCell></TableRow>
            ) : (
              prefs.map((pref) => (
                <TableRow key={pref.id}>
                  <TableCell className="font-medium text-sm">{getName(pref)}</TableCell>
                  <TableCell>
                    <Switch checked={pref.is_enabled} onCheckedChange={(v) => updatePref(pref.id, "is_enabled", v)} />
                  </TableCell>
                  <TableCell>
                    <Select value={pref.frequency} onValueChange={(v) => updatePref(pref.id, "frequency", v)}>
                      <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="daily">Daily Digest</SelectItem>
                        <SelectItem value="weekly">Weekly Digest</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {pref.frequency === "weekly" ? (
                      <Select value={pref.digest_day} onValueChange={(v) => updatePref(pref.id, "digest_day", v)}>
                        <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["monday","tuesday","wednesday","thursday","friday"].map((d) => (
                            <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePref(pref.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {availableUsers.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Select user to add" /></SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.display_name || `${u.first_name || ""} ${u.last_name || ""}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addSubscriber} disabled={!selectedUserId || adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
