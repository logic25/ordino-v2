import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Plus, Users } from "lucide-react";
import { TimeSummaryCards } from "@/components/time/TimeSummaryCards";
import { ActiveTimerBar } from "@/components/time/ActiveTimerBar";
import { AttendanceTable } from "@/components/time/AttendanceTable";
import { TimeEntriesTable } from "@/components/time/TimeEntriesTable";
import { TimeEntryDialog } from "@/components/time/TimeEntryDialog";
import { ClockOutModal } from "@/components/time/ClockOutModal";

export default function Time() {
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [clockOutOpen, setClockOutOpen] = useState(false);

  // Date range for queries - default to this week
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekRange = {
    from: monday.toISOString().split("T")[0],
    to: sunday.toISOString().split("T")[0],
  };

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
        <ActiveTimerBar onClockOut={() => setClockOutOpen(true)} />

        {/* Summary Cards */}
        <TimeSummaryCards />

        {/* Tabbed Views */}
        <Tabs defaultValue="entries" className="space-y-4">
          <TabsList>
            <TabsTrigger value="entries" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              My Time Entries
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Attendance Log
            </TabsTrigger>
          </TabsList>

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
                  Clock-in/out records for your team this week
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
