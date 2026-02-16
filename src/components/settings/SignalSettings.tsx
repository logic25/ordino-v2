import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Radio, Bell, AlertTriangle, Clock, Shield, Save, Loader2 } from "lucide-react";
import { useSignalSubscriptions } from "@/hooks/useSignalSubscriptions";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { useToast } from "@/hooks/use-toast";

export function SignalSettings() {
  const { toast } = useToast();
  const { data: subscriptions = [] } = useSignalSubscriptions();
  const { data: companySettings } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();

  // Local state for signal settings — stored in company settings JSON
  const signalConfig = (companySettings?.settings as any)?.signal || {};
  const [autoEnroll, setAutoEnroll] = useState(signalConfig.auto_enroll_new_properties ?? false);
  const [violationAlerts, setViolationAlerts] = useState(signalConfig.violation_alerts ?? true);
  const [externalAppAlerts, setExternalAppAlerts] = useState(signalConfig.external_app_alerts ?? true);
  const [checkFrequency, setCheckFrequency] = useState(signalConfig.check_frequency || "daily");
  const [notifyPm, setNotifyPm] = useState(signalConfig.notify_pm ?? true);
  const [notifyAdmin, setNotifyAdmin] = useState(signalConfig.notify_admin ?? true);
  const [penaltyThreshold, setPenaltyThreshold] = useState(signalConfig.penalty_threshold?.toString() || "500");

  const activeCount = subscriptions.filter(s => s.status === "active" || s.status === "trial").length;
  const prospectCount = subscriptions.filter(s => s.status === "prospect").length;
  const totalCount = subscriptions.length;

  const handleSave = async () => {
    if (!companySettings?.companyId) return;
    try {
      const currentSettings = companySettings.settings || {};
      await updateSettings.mutateAsync({
        companyId: companySettings.companyId,
        settings: {
          ...currentSettings,
          signal: {
            auto_enroll_new_properties: autoEnroll,
            violation_alerts: violationAlerts,
            external_app_alerts: externalAppAlerts,
            check_frequency: checkFrequency,
            notify_pm: notifyPm,
            notify_admin: notifyAdmin,
            penalty_threshold: Number(penaltyThreshold) || 500,
          },
        } as any,
      });
      toast({ title: "Signal settings saved", description: "Your monitoring preferences have been updated." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Active Subscriptions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{prospectCount}</div>
            <div className="text-xs text-muted-foreground">Prospects</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{totalCount}</div>
            <div className="text-xs text-muted-foreground">Total Monitored</div>
          </CardContent>
        </Card>
      </div>

      {/* Monitoring Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" /> Monitoring Preferences
          </CardTitle>
          <CardDescription>
            Configure how Signal monitors your properties
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-enroll new properties</Label>
              <p className="text-xs text-muted-foreground">
                Automatically create a Signal subscription when a new property is added
              </p>
            </div>
            <Switch checked={autoEnroll} onCheckedChange={setAutoEnroll} />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Check Frequency</Label>
            <Select value={checkFrequency} onValueChange={setCheckFrequency}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often Signal checks for new violations and external applications
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notification Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Notification Rules
          </CardTitle>
          <CardDescription>
            Control when and who gets notified about Signal events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" /> Violation Alerts
              </Label>
              <p className="text-xs text-muted-foreground">
                Get notified when new violations are detected
              </p>
            </div>
            <Switch checked={violationAlerts} onCheckedChange={setViolationAlerts} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" /> External Application Alerts
              </Label>
              <p className="text-xs text-muted-foreground">
                Get notified when external DOB applications are filed at your properties
              </p>
            </div>
            <Switch checked={externalAppAlerts} onCheckedChange={setExternalAppAlerts} />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Penalty Threshold</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                className="w-[120px]"
                value={penaltyThreshold}
                onChange={(e) => setPenaltyThreshold(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Only send alerts for violations with penalties above this amount
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Notify Recipients</Label>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm">Assigned PM</p>
                <p className="text-xs text-muted-foreground">
                  Notify the project manager assigned to the property's project
                </p>
              </div>
              <Switch checked={notifyPm} onCheckedChange={setNotifyPm} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm">Admin</p>
                <p className="text-xs text-muted-foreground">
                  Always notify company admins
                </p>
              </div>
              <Switch checked={notifyAdmin} onCheckedChange={setNotifyAdmin} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending} className="gap-2">
          {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Signal Settings
        </Button>
      </div>
    </div>
  );
}
