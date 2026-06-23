import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain } from "lucide-react";
import { Navigate, useSearchParams } from "react-router-dom";
import { AIUsageDashboard } from "@/components/helpdesk/AIUsageDashboard";
import { usePermissions } from "@/hooks/usePermissions";
import { useHasRole } from "@/hooks/useUserRoles";
import { BeaconConfigPanel } from "@/components/beacon/BeaconConfigPanel";
import { BeaconKbGaps } from "@/components/beacon/BeaconKbGaps";
import { BeaconTeachPanel } from "@/components/beacon/BeaconTeachPanel";

export default function BeaconHub() {
  const { isAdmin } = usePermissions();
  const isManager = useHasRole("manager");
  const [searchParams] = useSearchParams();

  // Teach tab is open to admin + manager; the rest of the Hub stays admin-only.
  const canAccess = isAdmin || isManager;
  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const requestedTab = searchParams.get("tab");
  const defaultTab = requestedTab ?? (isAdmin ? "usage" : "teach");

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Brain className="h-7 w-7 text-[#f59e0b]" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Beacon Hub</h1>
            <p className="text-sm text-muted-foreground">
              Usage, configuration, knowledge-base gaps, and teaching
            </p>
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="teach">Teach</TabsTrigger>
            {isAdmin && <TabsTrigger value="usage">Usage</TabsTrigger>}
            {isAdmin && <TabsTrigger value="config">Config</TabsTrigger>}
            {isAdmin && <TabsTrigger value="gaps">KB Gaps</TabsTrigger>}
          </TabsList>
          <TabsContent value="teach"><BeaconTeachPanel /></TabsContent>
          {isAdmin && <TabsContent value="usage"><AIUsageDashboard /></TabsContent>}
          {isAdmin && <TabsContent value="config"><BeaconConfigPanel /></TabsContent>}
          {isAdmin && <TabsContent value="gaps"><BeaconKbGaps /></TabsContent>}
        </Tabs>
      </div>
    </AppLayout>
  );
}
