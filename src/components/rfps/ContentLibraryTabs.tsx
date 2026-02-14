import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, Star, FileText, DollarSign, Award } from "lucide-react";
import { CompanyInfoTab } from "./tabs/CompanyInfoTab";
import { StaffBiosTab } from "./tabs/StaffBiosTab";
import { NotableProjectsTab } from "./tabs/NotableProjectsTab";
import { NarrativesTab } from "./tabs/NarrativesTab";
import { PricingTab } from "./tabs/PricingTab";
import { CertificationsTab } from "./tabs/CertificationsTab";

export function ContentLibraryTabs() {
  return (
    <Tabs defaultValue="company_info" className="space-y-4">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="company_info" className="flex items-center gap-1.5 text-xs">
          <Building2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Company</span>
        </TabsTrigger>
        <TabsTrigger value="staff_bios" className="flex items-center gap-1.5 text-xs">
          <Users className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Staff</span>
        </TabsTrigger>
        <TabsTrigger value="notable_projects" className="flex items-center gap-1.5 text-xs">
          <Star className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Projects</span>
        </TabsTrigger>
        <TabsTrigger value="narratives" className="flex items-center gap-1.5 text-xs">
          <FileText className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Narratives</span>
        </TabsTrigger>
        <TabsTrigger value="pricing" className="flex items-center gap-1.5 text-xs">
          <DollarSign className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Pricing</span>
        </TabsTrigger>
        <TabsTrigger value="certifications" className="flex items-center gap-1.5 text-xs">
          <Award className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Certs</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="company_info"><CompanyInfoTab /></TabsContent>
      <TabsContent value="staff_bios"><StaffBiosTab /></TabsContent>
      <TabsContent value="notable_projects"><NotableProjectsTab /></TabsContent>
      <TabsContent value="narratives"><NarrativesTab /></TabsContent>
      <TabsContent value="pricing"><PricingTab /></TabsContent>
      <TabsContent value="certifications"><CertificationsTab /></TabsContent>
    </Tabs>
  );
}
