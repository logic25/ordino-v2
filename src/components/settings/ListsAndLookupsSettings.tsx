import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyTypeSettings } from "./CompanyTypeSettings";
import { ReviewCategorySettings } from "./ReviewCategorySettings";
import { LeadSourceSettings } from "./LeadSourceSettings";
import { LeadStatusSettings } from "./LeadStatusSettings";
import { FilingChecklistSettings } from "./FilingChecklistSettings";

export function ListsAndLookupsSettings({ defaultTab }: { defaultTab?: string }) {
  return (
    <Tabs defaultValue={defaultTab || "company_types"} className="space-y-4">
      <TabsList>
        <TabsTrigger value="company_types">Company Types</TabsTrigger>
        <TabsTrigger value="review_categories">Review Categories</TabsTrigger>
        <TabsTrigger value="lead_sources">Lead Sources</TabsTrigger>
        <TabsTrigger value="lead_statuses">Lead Statuses</TabsTrigger>
        <TabsTrigger value="filing_checklist">Filing Checklist</TabsTrigger>
      </TabsList>

      <TabsContent value="company_types">
        <CompanyTypeSettings />
      </TabsContent>

      <TabsContent value="review_categories">
        <ReviewCategorySettings />
      </TabsContent>

      <TabsContent value="lead_sources">
        <LeadSourceSettings />
      </TabsContent>

      <TabsContent value="lead_statuses">
        <LeadStatusSettings />
      </TabsContent>

      <TabsContent value="filing_checklist">
        <FilingChecklistSettings />
      </TabsContent>
    </Tabs>
  );
}
