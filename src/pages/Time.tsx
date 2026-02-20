import { useState, useMemo, useEffect } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Plus, Users, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { ActiveTimerBar } from "@/components/time/ActiveTimerBar";
import { AttendanceTable } from "@/components/time/AttendanceTable";
import { TimeEntriesTable } from "@/components/time/TimeEntriesTable";
import { TimeEntryDialog } from "@/components/time/TimeEntryDialog";
import { ClockOutModal } from "@/components/time/ClockOutModal";
import { WeeklyTimesheet } from "@/components/time/WeeklyTimesheet";
import { addDays, startOfWeek, format } from "date-fns";

export default function Time() {
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const { track } = useTelemetry();

  useEffect(() => {
    track("time", "page_viewed");
  }, []);

  const weekStart = useMemo(() => {
    const now = new Date();
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    return addDays(monday, weekOffset * 7);
  }, [weekOffset]);

  const weekEnd = addDays(weekStart, 6);

  const weekRange = {
    from: format(weekStart, "yyyy-MM-dd"),
    to: format(weekEnd, "yyyy-MM-dd"),
  };

  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Time Tracking</h1>
            <p className="text-muted-foreground mt-1">
              Track your hours and attribute time to projects
            </p>
          </div>
          <Button
            onClick={() => setLogTimeOpen(true)}
            className="bg-accent text-accent-foreground hover:bg-accent/90 glow-amber"
          >
            <Plus className="h-4 w-4 mr-2" />
            Log Time
          </Button>
        </div>

        {/* Active Timer */}
        <ActiveTimerBar />

        {/* Week Navigation */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekOffset(0)}
            className="text-sm font-medium"
          >
            {weekOffset === 0 ? "This Week" : weekLabel}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekOffset((o) => o + 1)}
            disabled={weekOffset >= 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <span className="text-xs text-muted-foreground">{weekLabel}</span>
          )}
        </div>

        {/* Tabbed Views */}
        <Tabs defaultValue="timesheet" className="space-y-4">
          <TabsList>
            <TabsTrigger value="timesheet" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Weekly Timesheet
            </TabsTrigger>
            <TabsTrigger value="entries" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time Entries
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Attendance Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timesheet">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Timesheet</CardTitle>
                <CardDescription>
                  Hours logged per project for {weekLabel}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <WeeklyTimesheet weekStart={weekStart} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entries">
            <Card>
              <CardHeader>
                <CardTitle>Time Entries</CardTitle>
                <CardDescription>
                  Your logged time broken down by project and service
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <TimeEntriesTable dateRange={weekRange} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Team Attendance</CardTitle>
                <CardDescription>
                  Clock-in/out records for your team — {weekLabel}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <AttendanceTable dateRange={weekRange} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <TimeEntryDialog open={logTimeOpen} onOpenChange={setLogTimeOpen} />
      <ClockOutModal />
    </AppLayout>
  );
}
