import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Loader2 } from "lucide-react";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_TYPES = [
  "Architect",
  "General Contractor",
  "Plumber",
  "Electrician",
  "Engineer",
  "Property Owner",
  "Developer",
  "Expediter",
  "Attorney",
  "Insurance",
];

export function CompanyTypeSettings() {
  const { data } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const { toast } = useToast();
  const [newType, setNewType] = useState("");

  const types = data?.settings?.company_types ?? DEFAULT_TYPES;

  const handleAdd = async () => {
    const trimmed = newType.trim();
    if (!trimmed || !data?.companyId) return;
    if (types.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Type already exists", variant: "destructive" });
      return;
    }
    const updated = [...types, trimmed];
    await updateSettings.mutateAsync({
      companyId: data.companyId,
      settings: { ...data.settings, company_types: updated },
    });
    setNewType("");
    toast({ title: "Type added" });
  };

  const handleRemove = async (typeToRemove: string) => {
    if (!data?.companyId) return;
    const updated = types.filter((t) => t !== typeToRemove);
    await updateSettings.mutateAsync({
      companyId: data.companyId,
      settings: { ...data.settings, company_types: updated },
    });
    toast({ title: "Type removed" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Types</CardTitle>
        <CardDescription>
          Define types for companies (e.g. Architect, Plumber, GC). These appear as filter/sort options.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {types.map((type) => (
            <Badge key={type} variant="secondary" className="text-sm px-3 py-1.5 gap-1.5">
              {type}
              <button
                onClick={() => handleRemove(type)}
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
            placeholder="Add new type..."
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="max-w-xs"
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newType.trim() || updateSettings.isPending}
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
