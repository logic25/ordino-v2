import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle, Brain, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HowToGuides } from "@/components/helpdesk/HowToGuides";
import { WhatsNew } from "@/components/helpdesk/WhatsNew";
import { FeatureRequests } from "@/components/helpdesk/FeatureRequests";
import { InteractiveTraining } from "@/components/helpdesk/InteractiveTraining";
import { BugReports } from "@/components/helpdesk/BugReports";
import { BugFixDashboard } from "@/components/helpdesk/BugFixDashboard";
import { ProductRoadmap } from "@/components/helpdesk/ProductRoadmap";
import { AIUsageDashboard } from "@/components/helpdesk/AIUsageDashboard";
import { usePermissions } from "@/hooks/usePermissions";
import { useHasRole } from "@/hooks/useUserRoles";
import { useSearchParams } from "react-router-dom";

export default function HelpDesk() {
  const { isAdmin } = usePermissions();
  const isManager = useHasRole("manager");
  const [searchParams] = useSearchParams();
  const canSeeBeacon = isAdmin || isManager;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Help Center</h1>
            <p className="text-sm text-muted-foreground">Guides, training, updates, and feature requests</p>
          </div>
        </div>

        <Tabs defaultValue={searchParams.get("tab") ?? "training"} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="training">Interactive Training</TabsTrigger>
            <TabsTrigger value="guides">How-To Guides</TabsTrigger>
            {isAdmin && <TabsTrigger value="whats-new">What's New</TabsTrigger>}
            <TabsTrigger value="requests">Feature Requests</TabsTrigger>
            <TabsTrigger value="bugs">Bug Reports</TabsTrigger>
            {isAdmin && <TabsTrigger value="bug-metrics">Bug Metrics</TabsTrigger>}
            {isAdmin && <TabsTrigger value="roadmap">Product Roadmap</TabsTrigger>}
            {isAdmin && <TabsTrigger value="ai-usage">AI Usage</TabsTrigger>}
          </TabsList>

          <TabsContent value="training"><InteractiveTraining /></TabsContent>
          <TabsContent value="guides"><HowToGuides /></TabsContent>
          {isAdmin && <TabsContent value="whats-new"><WhatsNew /></TabsContent>}
          <TabsContent value="requests"><FeatureRequests /></TabsContent>
          <TabsContent value="bugs"><BugReports /></TabsContent>
          {isAdmin && <TabsContent value="bug-metrics"><BugFixDashboard /></TabsContent>}
          {isAdmin && <TabsContent value="roadmap"><ProductRoadmap /></TabsContent>}
          {isAdmin && (
            <TabsContent value="ai-usage" className="space-y-4">
              {canSeeBeacon && (
                <Card className="border-[#f59e0b]/30 bg-[#f59e0b]/5">
                  <CardContent className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Brain className="h-5 w-5 text-[#f59e0b] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Beacon Hub</p>
                        <p className="text-xs text-muted-foreground">
                          Train Beacon, review KB gaps, approve user-flagged answers, and tune config.
                        </p>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/beacon">
                        Open Beacon Hub <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
              <AIUsageDashboard />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}

