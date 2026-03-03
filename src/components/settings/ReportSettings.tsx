import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { useReportSettings } from "@/hooks/useReportSettings";

const DAYS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
];

export function ReportSettings() {
  const { settings, isLoading, updateSettings, sendNow } = useReportSettings();

  const frequency = settings?.frequency || "monthly";
  const dayOfWeek = settings?.day_of_week || "monday";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Open Services Report</CardTitle>
          <CardDescription>
            Automated email showing open services grouped by PM with billing comparison and goal tracking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(val) => updateSettings.mutate({ frequency: val, day_of_week: dayOfWeek })}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {frequency === "weekly" && (
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select
                  value={dayOfWeek}
                  onValueChange={(val) => updateSettings.mutate({ frequency, day_of_week: val })}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground mb-3">
              The report includes total services & value, billed vs. remaining per service, and PM goal progress with motivational badges.
            </p>
            <Button
              variant="outline"
              onClick={() => sendNow.mutate()}
              disabled={sendNow.isPending}
            >
              {sendNow.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Report Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
