import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, Star, FileText, DollarSign, Award } from "lucide-react";
import { CompanyInfoTab } from "./tabs/CompanyInfoTab";
import { StaffBiosTab } from "./tabs/StaffBiosTab";
import { NotableProjectsTab } from "./tabs/NotableProjectsTab";
import { NarrativesTab } from "./tabs/NarrativesTab";
import { PricingTab } from "./tabs/PricingTab";
import { CertificationsTab } from "./tabs/CertificationsTab";
import { useSearchParams } from "react-router-dom";

const TABS = [
  { value: "company_info", label: "Company", icon: Building2, color: "text-info", aliases: ["company"] },
  { value: "staff_bios", label: "Staff", icon: Users, color: "text-accent", aliases: ["staff"] },
  { value: "notable_projects", label: "Projects", icon: Star, color: "text-warning", aliases: ["projects"] },
  { value: "narratives", label: "Narratives", icon: FileText, color: "text-success", aliases: ["narratives"] },
  { value: "pricing", label: "Pricing", icon: DollarSign, color: "text-accent", aliases: ["pricing"] },
  { value: "certifications", label: "Certs", icon: Award, color: "text-info", aliases: ["certs"] },
] as const;

function resolveTab(param: string | null): string {
  if (!param) return "company_info";
  const match = TABS.find(
    (t) => t.value === param || (t.aliases as readonly string[]).includes(param)
  );
  return match?.value ?? "company_info";
}

export function ContentLibraryTabs() {
  const [searchParams] = useSearchParams();
  const initialTab = resolveTab(searchParams.get("tab"));

  return (
    <Tabs defaultValue={initialTab} className="space-y-4">
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
              {tab.label}
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
