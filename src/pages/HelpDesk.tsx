import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle } from "lucide-react";
import { HowToGuides } from "@/components/helpdesk/HowToGuides";
import { WhatsNew } from "@/components/helpdesk/WhatsNew";
import { FeatureRequests } from "@/components/helpdesk/FeatureRequests";
import { InteractiveTraining } from "@/components/helpdesk/InteractiveTraining";
import { ProductRoadmap } from "@/components/helpdesk/ProductRoadmap";
import { AIUsageDashboard } from "@/components/helpdesk/AIUsageDashboard";
import { usePermissions } from "@/hooks/usePermissions";

export default function HelpDesk() {
  const { isAdmin } = usePermissions();

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

        <Tabs defaultValue="training" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="training">Interactive Training</TabsTrigger>
            <TabsTrigger value="guides">How-To Guides</TabsTrigger>
            {isAdmin && <TabsTrigger value="whats-new">What's New</TabsTrigger>}
            <TabsTrigger value="requests">Feature Requests</TabsTrigger>
            {isAdmin && <TabsTrigger value="roadmap">Product Roadmap</TabsTrigger>}
            {isAdmin && <TabsTrigger value="ai-usage">AI Usage</TabsTrigger>}
          </TabsList>

          <TabsContent value="training"><InteractiveTraining /></TabsContent>
          <TabsContent value="guides"><HowToGuides /></TabsContent>
          {isAdmin && <TabsContent value="whats-new"><WhatsNew /></TabsContent>}
          <TabsContent value="requests"><FeatureRequests /></TabsContent>
          {isAdmin && (
            <TabsContent value="roadmap"><ProductRoadmap /></TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="ai-usage"><AIUsageDashboard /></TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}
