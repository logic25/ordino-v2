import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle, Brain, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HowToGuides } from "@/components/helpdesk/HowToGuides";
import { WhatsNew } from "@/components/helpdesk/WhatsNew";
import { FeatureRequests } from "@/components/helpdesk/FeatureRequests";
import { InteractiveTraining } from "@/components/helpdesk/InteractiveTraining";
import { BugReports } from "@/components/helpdesk/BugReports";
import { BugFixDashboard } from "@/components/helpdesk/BugFixDashboard";
import { ProductRoadmap } from "@/components/helpdesk/ProductRoadmap";
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
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Help Center</h1>
              <p className="text-sm text-muted-foreground">Guides, training, updates, and feature requests</p>
            </div>
          </div>
          {canSeeBeacon && (
            <Button asChild size="sm" variant="outline" className="border-[#f59e0b]/40 text-[#f59e0b] hover:bg-[#f59e0b]/10 hover:text-[#f59e0b]">
              <Link to="/beacon">
                <Brain className="h-4 w-4 mr-1.5" />
                Beacon Hub
                <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          )}
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
          </TabsList>

          <TabsContent value="training"><InteractiveTraining /></TabsContent>
          <TabsContent value="guides"><HowToGuides /></TabsContent>
          {isAdmin && <TabsContent value="whats-new"><WhatsNew /></TabsContent>}
          <TabsContent value="requests"><FeatureRequests /></TabsContent>
          <TabsContent value="bugs"><BugReports /></TabsContent>
          {isAdmin && <TabsContent value="bug-metrics"><BugFixDashboard /></TabsContent>}
          {isAdmin && <TabsContent value="roadmap"><ProductRoadmap /></TabsContent>}
        </Tabs>
      </div>
    </AppLayout>
  );
}
