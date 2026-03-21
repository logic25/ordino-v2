import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Pencil, ChevronRight, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { MockService, MockTimeEntry } from "@/components/projects/projectMockData";
import { format } from "date-fns";

function AuditLogSection({ companyId, timeEntries }: { companyId: string; timeEntries: MockTimeEntry[] }) {
  const [open, setOpen] = useState(false);
  const activityIds = timeEntries.map(te => te.id).filter(Boolean);

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["audit-logs", companyId, activityIds.join(",")],
    enabled: open && activityIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("activity_edit_logs") as any)
        .select("id, activity_id, field_changed, old_value, new_value, reason, created_at, edited_by, editor:profiles!activity_edit_logs_edited_by_fkey(first_name, last_name, display_name)")
        .eq("company_id", companyId)
        .in("activity_id", activityIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  if (activityIds.length === 0) return null;

  const fieldLabels: Record<string, string> = {
    duration_minutes: "Duration",
    description: "Description",
  };

  const formatValue = (field: string, val: string | null) => {
    if (!val) return "—";
    if (field === "duration_minutes") {
      const mins = parseInt(val);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${m}m`;
    }
    return val;
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground h-7 px-2">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          📋 Audit Log
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {auditLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-2">No edits recorded.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Editor</TableHead>
                  <TableHead className="text-xs">Field</TableHead>
                  <TableHead className="text-xs">Old</TableHead>
                  <TableHead className="text-xs">New</TableHead>
                  <TableHead className="text-xs">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono">{format(new Date(log.created_at), "MM/dd HH:mm")}</TableCell>
                    <TableCell className="text-xs">{log.editor?.display_name || `${log.editor?.first_name || ""} ${log.editor?.last_name || ""}`.trim() || "Unknown"}</TableCell>
                    <TableCell className="text-xs">{fieldLabels[log.field_changed] || log.field_changed}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatValue(log.field_changed, log.old_value)}</TableCell>
                    <TableCell className="text-xs font-medium">{formatValue(log.field_changed, log.new_value)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground italic">{log.reason || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TimeLogsFull({ timeEntries, services, projectId, companyId, onCreateCO }: { timeEntries: MockTimeEntry[]; services: MockService[]; projectId: string; companyId: string; onCreateCO?: () => void }) {
  const totalHours = timeEntries.reduce((s, t) => s + t.hours, 0);
  const { toast } = useToast();
  const [budgetAlertShown, setBudgetAlertShown] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const [showLogForm, setShowLogForm] = useState(false);
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [logHours, setLogHours] = useState("");
  const [logMinutes, setLogMinutes] = useState("");
  const [logDesc, setLogDesc] = useState("");
  const [logService, setLogService] = useState("");
  const [logging, setLogging] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MockTimeEntry | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const hoursByService: Record<string, number> = {};
  timeEntries.forEach(te => {
    hoursByService[te.service] = (hoursByService[te.service] || 0) + te.hours;
  });

  const serviceUtilization = services
    .filter(svc => svc.allottedHours > 0)
    .map(svc => {
      const logged = hoursByService[svc.name] || 0;
      const pct = Math.round((logged / svc.allottedHours) * 100);
      const status: "ok" | "warning" | "over" = pct >= 100 ? "over" : pct >= 80 ? "warning" : "ok";
      return { name: svc.name, allotted: svc.allottedHours, logged, remaining: Math.max(svc.allottedHours - logged, 0), pct, status };
    });

  useEffect(() => {
    serviceUtilization.forEach(su => {
      if (budgetAlertShown.has(su.name)) return;
      if (su.status === "over") {
        setBudgetAlertShown(prev => new Set(prev).add(su.name));
        toast({
          title: `⚠️ ${su.name} is over budget`,
          description: `${su.logged.toFixed(1)} of ${su.allotted} hrs used (${su.pct}%). Consider creating a Change Order.`,
          variant: "destructive",
          duration: 10000,
          action: onCreateCO ? (
            <ToastAction altText="Create Change Order" onClick={onCreateCO}>
              Create CO
            </ToastAction>
          ) : undefined,
        });
      } else if (su.status === "warning") {
        setBudgetAlertShown(prev => new Set(prev).add(su.name));
        toast({
          title: `🔔 ${su.name} approaching budget`,
          description: `${su.logged.toFixed(1)} of ${su.allotted} hrs used (${su.pct}%). ${su.remaining.toFixed(1)} hrs remaining.`,
          duration: 8000,
        });
      }
    });
  }, [serviceUtilization.map(s => s.status).join(",")]);

  const handleLogTime = async () => {
    const hours = parseInt(logHours || "0");
    const minutes = parseInt(logMinutes || "0");
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes <= 0) {
      toast({ title: "Invalid time", description: "Enter hours or minutes.", variant: "destructive" });
      return;
    }
    setLogging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: profile } = await supabase.from("profiles").select("id, company_id").eq("user_id", user.id).single();
      if (!profile) throw new Error("Profile not found");

      const { data: apps } = await supabase.from("dob_applications").select("id").eq("project_id", projectId).limit(1);
      const appId = apps?.[0]?.id || null;

      let serviceId: string | null = null;
      if (logService) {
        const { data: svc } = await supabase.from("services").select("id").eq("project_id", projectId).eq("name", logService).limit(1).maybeSingle();
        serviceId = svc?.id || null;
      }

      const { error } = await supabase.from("activities").insert({
        user_id: profile.id,
        company_id: companyId,
        activity_type: "time_log" as any,
        activity_date: logDate,
        duration_minutes: totalMinutes,
        description: logDesc || null,
        application_id: appId,
        service_id: serviceId,
      } as any);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["project-time-entries"] });
      toast({ title: "Time logged", description: `${hours}h ${minutes}m logged successfully.` });
      setShowLogForm(false);
      setLogHours(""); setLogMinutes(""); setLogDesc(""); setLogService("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{timeEntries.length} entr{timeEntries.length !== 1 ? "ies" : "y"} · {totalHours.toFixed(1)} hrs total</span>
        <Button size="sm" className="gap-1.5" onClick={() => setShowLogForm(true)}>
          <Plus className="h-3.5 w-3.5" /> Log Time
        </Button>
      </div>

      {showLogForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hours</Label>
              <Input type="number" min="0" placeholder="0" value={logHours} onChange={e => setLogHours(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Minutes</Label>
              <Input type="number" min="0" max="59" placeholder="0" value={logMinutes} onChange={e => setLogMinutes(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Service</Label>
              <Select value={logService} onValueChange={setLogService}>
                <SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  {services.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input placeholder="What did you work on?" value={logDesc} onChange={e => setLogDesc(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowLogForm(false)}>Cancel</Button>
            <Button size="sm" disabled={logging} onClick={handleLogTime}>
              {logging ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              {logging ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {serviceUtilization.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Time by Service</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {serviceUtilization.map(su => {
              const barColor = su.status === "over"
                ? "[&>div]:bg-destructive"
                : su.status === "warning"
                ? "[&>div]:bg-amber-500"
                : "[&>div]:bg-primary";
              return (
                <div key={su.name} className="px-3 py-2 rounded-md border bg-background space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate mr-2">{su.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{su.logged.toFixed(1)} / {su.allotted} hrs</span>
                  </div>
                  <Progress value={Math.min(su.pct, 100)} className={cn("h-1.5", barColor)} />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    {su.status === "over" ? (
                      <span className="text-destructive font-medium">{(su.logged - su.allotted).toFixed(1)} hrs over budget</span>
                    ) : (
                      <span>{su.remaining.toFixed(1)} hrs remaining</span>
                    )}
                    <span className={cn(
                      su.status === "over" && "text-destructive font-semibold",
                      su.status === "warning" && "text-amber-600 dark:text-amber-400 font-medium",
                    )}>{su.pct}% used</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!editingEntry} onOpenChange={(open) => { if (!open) setEditingEntry(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>Changes are logged for audit purposes.</DialogDescription>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Hours</Label>
                  <Input type="number" min="0" value={editHours} onChange={e => setEditHours(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Minutes</Label>
                  <Input type="number" min="0" max="59" value={editMinutes} onChange={e => setEditMinutes(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reason for change <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. Incorrect hours logged" value={editReason} onChange={e => setEditReason(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditingEntry(null)}>Cancel</Button>
                <Button size="sm" disabled={editSaving || !editReason.trim()} onClick={async () => {
                  setEditSaving(true);
                  try {
                    const newHours = parseInt(editHours || "0");
                    const newMinutes = parseInt(editMinutes || "0");
                    const newTotalMinutes = newHours * 60 + newMinutes;
                    const oldTotalMinutes = Math.round(editingEntry.hours * 60);
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) throw new Error("Not authenticated");
                    const { data: profile } = await supabase.from("profiles").select("id, company_id").eq("user_id", user.id).single();
                    if (!profile) throw new Error("Profile not found");

                    const auditEntries: any[] = [];
                    if (newTotalMinutes !== oldTotalMinutes) {
                      auditEntries.push({
                        activity_id: editingEntry.id,
                        company_id: companyId,
                        edited_by: profile.id,
                        field_changed: "duration_minutes",
                        old_value: String(oldTotalMinutes),
                        new_value: String(newTotalMinutes),
                        reason: editReason,
                      });
                    }
                    if (editDesc !== editingEntry.description) {
                      auditEntries.push({
                        activity_id: editingEntry.id,
                        company_id: companyId,
                        edited_by: profile.id,
                        field_changed: "description",
                        old_value: editingEntry.description || null,
                        new_value: editDesc || null,
                        reason: editReason,
                      });
                    }
                    if (auditEntries.length > 0) {
                      await supabase.from("activity_edit_logs" as any).insert(auditEntries);
                    }

                    const updates: any = {};
                    if (newTotalMinutes !== oldTotalMinutes) updates.duration_minutes = newTotalMinutes;
                    if (editDesc !== editingEntry.description) updates.description = editDesc || null;
                    if (Object.keys(updates).length > 0) {
                      const { error } = await supabase.from("activities").update(updates).eq("id", editingEntry.id);
                      if (error) throw error;
                    }

                    queryClient.invalidateQueries({ queryKey: ["project-time-entries"] });
                    toast({ title: "Time entry updated", description: "Change has been logged for audit." });
                    setEditingEntry(null);
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  } finally {
                    setEditSaving(false);
                  }
                }}>
                  {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {timeEntries.length === 0 && !showLogForm ? (
        <p className="text-sm text-muted-foreground italic">No time logged.</p>
      ) : timeEntries.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Date</TableHead>
                <TableHead>Team Member</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeEntries.map((te) => (
                <TableRow key={te.id}>
                  <TableCell className="font-mono">{te.date}</TableCell>
                  <TableCell>{te.user}</TableCell>
                  <TableCell className="text-muted-foreground">{te.service}</TableCell>
                  <TableCell className="text-muted-foreground">{te.description}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{te.hours.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Edit time entry"
                      onClick={() => {
                        setEditingEntry(te);
                        setEditHours(String(Math.floor(te.hours)));
                        setEditMinutes(String(Math.round((te.hours % 1) * 60)));
                        setEditDesc(te.description);
                        setEditReason("");
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
        </Table>
      ) : null}

      <AuditLogSection companyId={companyId} timeEntries={timeEntries} />
    </div>
  );
}
