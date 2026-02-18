import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle } from "lucide-react";
import { HowToGuides } from "@/components/helpdesk/HowToGuides";
import { WhatsNew } from "@/components/helpdesk/WhatsNew";
import { FeatureRequests } from "@/components/helpdesk/FeatureRequests";

export default function HelpDesk() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Help Center</h1>
            <p className="text-sm text-muted-foreground">Guides, updates, and feature requests</p>
          </div>
        </div>

        <Tabs defaultValue="guides" className="space-y-4">
          <TabsList>
            <TabsTrigger value="guides">How-To Guides</TabsTrigger>
            <TabsTrigger value="whats-new">What's New</TabsTrigger>
            <TabsTrigger value="requests">Feature Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="guides"><HowToGuides /></TabsContent>
          <TabsContent value="whats-new"><WhatsNew /></TabsContent>
          <TabsContent value="requests"><FeatureRequests /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
