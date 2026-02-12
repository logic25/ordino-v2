import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Loader2 } from "lucide-react";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_CATEGORIES = [
  "Responsiveness",
  "Fair Price",
  "Knowledgeable",
  "Quality of Work",
  "Communication",
  "Timeliness",
  "Professionalism",
];

export function ReviewCategorySettings() {
  const { data } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const { toast } = useToast();
  const [newCategory, setNewCategory] = useState("");

  const categories = data?.settings?.review_categories ?? DEFAULT_CATEGORIES;

  const handleAdd = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed || !data?.companyId) return;
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Category already exists", variant: "destructive" });
      return;
    }
    const updated = [...categories, trimmed];
    await updateSettings.mutateAsync({
      companyId: data.companyId,
      settings: { ...data.settings, review_categories: updated },
    });
    setNewCategory("");
    toast({ title: "Category added" });
  };

  const handleRemove = async (cat: string) => {
    if (!data?.companyId) return;
    const updated = categories.filter((c) => c !== cat);
    await updateSettings.mutateAsync({
      companyId: data.companyId,
      settings: { ...data.settings, review_categories: updated },
    });
    toast({ title: "Category removed" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Categories</CardTitle>
        <CardDescription>
          Define rating categories for company reviews (e.g. Responsiveness, Fair Price). Team members rate each category when leaving a review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Badge key={cat} variant="secondary" className="text-sm px-3 py-1.5 gap-1.5">
              {cat}
              <button
                onClick={() => handleRemove(cat)}
                className="ml-1 hover:text-destructive transition-colors"
                disabled={updateSettings.isPending}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Add new category..."
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="max-w-xs"
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newCategory.trim() || updateSettings.isPending}
          >
            {updateSettings.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
