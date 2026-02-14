import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, Star, FileText, DollarSign, Award } from "lucide-react";
import { CompanyInfoTab } from "./tabs/CompanyInfoTab";
import { StaffBiosTab } from "./tabs/StaffBiosTab";
import { NotableProjectsTab } from "./tabs/NotableProjectsTab";
import { NarrativesTab } from "./tabs/NarrativesTab";
import { PricingTab } from "./tabs/PricingTab";
import { CertificationsTab } from "./tabs/CertificationsTab";

const TABS = [
  { value: "company_info", label: "Company", icon: Building2, color: "text-info" },
  { value: "staff_bios", label: "Staff", icon: Users, color: "text-accent" },
  { value: "notable_projects", label: "Projects", icon: Star, color: "text-warning" },
  { value: "narratives", label: "Narratives", icon: FileText, color: "text-success" },
  { value: "pricing", label: "Pricing", icon: DollarSign, color: "text-accent" },
  { value: "certifications", label: "Certs", icon: Award, color: "text-info" },
] as const;

export function ContentLibraryTabs() {
  return (
    <Tabs defaultValue="company_info" className="space-y-4">
      <TabsList className="flex w-full overflow-x-auto bg-card border border-border p-1 rounded-xl shadow-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-1.5 text-xs data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-amber rounded-lg transition-all"
            >
              <Icon className={`h-3.5 w-3.5 ${tab.color}`} />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          );
        })}
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
