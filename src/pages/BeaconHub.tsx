import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Info } from "lucide-react";
import { Navigate, useSearchParams } from "react-router-dom";
import { AIUsageDashboard } from "@/components/helpdesk/AIUsageDashboard";
import { usePermissions } from "@/hooks/usePermissions";
import { useHasRole } from "@/hooks/useUserRoles";
import { BeaconConfigPanel } from "@/components/beacon/BeaconConfigPanel";
import { BeaconKbGaps } from "@/components/beacon/BeaconKbGaps";
import { BeaconTeachPanel } from "@/components/beacon/BeaconTeachPanel";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

function TabWithTip({ value, label, tip }: { value: string; label: string; tip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <TabsTrigger value={value} className="gap-1.5">
          {label}
          <Info className="h-3 w-3 opacity-50" />
        </TabsTrigger>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tip}</TooltipContent>
    </Tooltip>
  );
}

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
      <TooltipProvider delayDuration={200}>
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <Brain className="h-7 w-7 text-[#f59e0b]" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Beacon Hub</h1>
              <p className="text-sm text-muted-foreground">
                Train Beacon, review knowledge gaps, and monitor AI usage. Beacon is your
                in-app assistant — these tools control what it knows and how it answers.
              </p>
            </div>
          </div>

          <Tabs defaultValue={defaultTab} className="space-y-4">
            <TabsList>
              <TabWithTip
                value="teach"
                label="Teach"
                tip="Approve 👍/👎 feedback, accept Beacon's suggested answers, and add quick Q&A snippets to its knowledge base."
              />
              {isAdmin && (
                <TabWithTip
                  value="usage"
                  label="Usage"
                  tip="AI token spend, request volume, and per-user activity for Beacon over time."
                />
              )}
              {isAdmin && (
                <TabWithTip
                  value="config"
                  label="Config"
                  tip="Tune Beacon's behavior: model, temperature, retrieval, system prompt, and feature flags."
                />
              )}
              {isAdmin && (
                <TabWithTip
                  value="gaps"
                  label="KB Gaps"
                  tip="Questions users asked that Beacon couldn't confidently answer. Add documents or teach snippets to fill the gap, then mark addressed with a note describing what you did."
                />
              )}
            </TabsList>
            <TabsContent value="teach"><BeaconTeachPanel /></TabsContent>
            {isAdmin && <TabsContent value="usage"><AIUsageDashboard /></TabsContent>}
            {isAdmin && <TabsContent value="config"><BeaconConfigPanel /></TabsContent>}
            {isAdmin && <TabsContent value="gaps"><BeaconKbGaps /></TabsContent>}
          </Tabs>
        </div>
      </TooltipProvider>
    </AppLayout>
  );
}
