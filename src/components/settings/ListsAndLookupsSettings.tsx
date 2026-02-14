import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyTypeSettings } from "./CompanyTypeSettings";
import { ReviewCategorySettings } from "./ReviewCategorySettings";
import { LeadSourceSettings } from "./LeadSourceSettings";

export function ListsAndLookupsSettings() {
  return (
    <Tabs defaultValue="company_types" className="space-y-4">
      <TabsList>
        <TabsTrigger value="company_types">Company Types</TabsTrigger>
        <TabsTrigger value="review_categories">Review Categories</TabsTrigger>
        <TabsTrigger value="lead_sources">Lead Sources</TabsTrigger>
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
    </Tabs>
  );
}
