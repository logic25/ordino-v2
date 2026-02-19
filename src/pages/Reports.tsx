import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3 } from "lucide-react";
import ProjectReports from "@/components/reports/ProjectReports";
import BillingReports from "@/components/reports/BillingReports";
import TimeReports from "@/components/reports/TimeReports";
import ProposalReports from "@/components/reports/ProposalReports";
import OperationsReports from "@/components/reports/OperationsReports";
import ReferralReports from "@/components/reports/ReferralReports";
import DataExports from "@/components/reports/DataExports";
import ReportsKPISummary from "@/components/reports/ReportsKPISummary";

export default function Reports() {
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

        <ReportsKPISummary />

        <Tabs defaultValue="projects" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="time">Time</TabsTrigger>
            <TabsTrigger value="proposals">Proposals</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="exports">Data Exports</TabsTrigger>
          </TabsList>

          <TabsContent value="projects"><ProjectReports /></TabsContent>
          <TabsContent value="billing"><BillingReports /></TabsContent>
          <TabsContent value="time"><TimeReports /></TabsContent>
          <TabsContent value="proposals"><ProposalReports /></TabsContent>
          <TabsContent value="operations"><OperationsReports /></TabsContent>
          <TabsContent value="referrals"><ReferralReports /></TabsContent>
          <TabsContent value="exports"><DataExports /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
