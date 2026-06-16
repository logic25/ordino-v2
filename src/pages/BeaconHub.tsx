import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain } from "lucide-react";
import { Navigate, useSearchParams } from "react-router-dom";
import { AIUsageDashboard } from "@/components/helpdesk/AIUsageDashboard";
import { usePermissions } from "@/hooks/usePermissions";
import { BeaconConfigPanel } from "@/components/beacon/BeaconConfigPanel";
import { BeaconKbGaps } from "@/components/beacon/BeaconKbGaps";

export default function BeaconHub() {
  const { isAdmin } = usePermissions();
  const [searchParams] = useSearchParams();

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Brain className="h-7 w-7 text-[#f59e0b]" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Beacon Hub</h1>
            <p className="text-sm text-muted-foreground">Usage, configuration, and knowledge-base gaps</p>
          </div>
        </div>

        <Tabs defaultValue={searchParams.get("tab") ?? "usage"} className="space-y-4">
          <TabsList>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
            <TabsTrigger value="gaps">KB Gaps</TabsTrigger>
          </TabsList>
          <TabsContent value="usage"><AIUsageDashboard /></TabsContent>
          <TabsContent value="config"><BeaconConfigPanel /></TabsContent>
          <TabsContent value="gaps"><BeaconKbGaps /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
