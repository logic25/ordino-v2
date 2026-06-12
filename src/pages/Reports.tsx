import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3 } from "lucide-react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { useSearchParams } from "react-router-dom";
import ProjectReports from "@/components/reports/ProjectReports";
import BillingReports from "@/components/reports/BillingReports";
import TimeReports from "@/components/reports/TimeReports";
import ProposalReports from "@/components/reports/ProposalReports";
import OperationsReports from "@/components/reports/OperationsReports";
import ReferralReports from "@/components/reports/ReferralReports";
import DataExports from "@/components/reports/DataExports";
import SignalReports from "@/components/reports/SignalReports";
import OpenServicesReport from "@/components/reports/OpenServicesReport";
import ServiceLevelReport from "@/components/reports/ServiceLevelReport";
import BdReports from "@/components/reports/BdReports";
import RfpReports from "@/components/reports/RfpReports";

export default function Reports() {
  const { track } = useTelemetry();
  const isAdmin = useIsAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "projects";
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports</h1>
            <p className="text-sm text-muted-foreground">Company-wide insights and analytics</p>
          </div>
        </div>

        <Tabs value={tab} className="space-y-4" onValueChange={(t) => { setSearchParams((p) => { p.set("tab", t); return p; }, { replace: true }); track("reports", "tab_viewed", { tab: t }); }}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="open-services">Open Services</TabsTrigger>
            <TabsTrigger value="service-level">Service Level</TabsTrigger>
            <TabsTrigger value="time">Time</TabsTrigger>
            <TabsTrigger value="proposals">Proposals</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            {isAdmin && <TabsTrigger value="referrals">Referrals</TabsTrigger>}
            {isAdmin && <TabsTrigger value="exports">Data Exports</TabsTrigger>}
            {isAdmin && <TabsTrigger value="signal">CitiSignal</TabsTrigger>}
          </TabsList>

          <TabsContent value="projects"><ProjectReports /></TabsContent>
          <TabsContent value="billing"><BillingReports /></TabsContent>
          <TabsContent value="open-services"><OpenServicesReport /></TabsContent>
          <TabsContent value="service-level"><ServiceLevelReport /></TabsContent>
          <TabsContent value="time"><TimeReports /></TabsContent>
          <TabsContent value="proposals"><ProposalReports /></TabsContent>
          <TabsContent value="operations"><OperationsReports /></TabsContent>
          {isAdmin && <TabsContent value="referrals"><ReferralReports /></TabsContent>}
          {isAdmin && <TabsContent value="exports"><DataExports /></TabsContent>}
          {isAdmin && <TabsContent value="signal"><SignalReports /></TabsContent>}
        </Tabs>
      </div>
    </AppLayout>
  );
}
