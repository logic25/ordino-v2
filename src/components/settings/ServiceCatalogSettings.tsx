import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Loader2, Save, Package } from "lucide-react";
import { useCompanySettings, useUpdateCompanySettings, ServiceCatalogItem } from "@/hooks/useCompanySettings";
import { useToast } from "@/hooks/use-toast";

export function ServiceCatalogSettings() {
  const { data: companyData, isLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const { toast } = useToast();

  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [defaultTerms, setDefaultTerms] = useState("");

  useEffect(() => {
    if (companyData?.settings) {
      setServices(companyData.settings.service_catalog || []);
      setDefaultTerms(companyData.settings.default_terms || "");
    }
  }, [companyData]);

  const addService = () => {
    setServices([
      ...services,
      {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        default_price: 0,
        default_hours: 0,
      },
    ]);
  };

  const removeService = (id: string) => {
    setServices(services.filter((s) => s.id !== id));
  };

  const updateService = (id: string, field: keyof ServiceCatalogItem, value: string | number) => {
    setServices(
      services.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      )
    );
  };

  const handleSave = async () => {
    if (!companyData?.companyId) return;

    try {
      await updateSettings.mutateAsync({
        companyId: companyData.companyId,
        settings: {
          service_catalog: services.filter((s) => s.name.trim()),
          default_terms: defaultTerms,
        },
      });
      toast({
        title: "Settings saved",
        description: "Service catalog and terms have been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Service Catalog */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Service Catalog
          </CardTitle>
          <CardDescription>
            Define your standard services for quick addition to proposals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No services defined yet.</p>
              <p className="text-sm">Add services to quickly populate proposals.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="grid grid-cols-12 gap-2 items-start p-3 border rounded-lg"
                >
                  <div className="col-span-3">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input
                      value={service.name}
                      onChange={(e) => updateService(service.id, "name", e.target.value)}
                      placeholder="Service name"
                    />
                  </div>
                  <div className="col-span-4">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input
                      value={service.description || ""}
                      onChange={(e) => updateService(service.id, "description", e.target.value)}
                      placeholder="Description"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Default Price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={service.default_price || ""}
                      onChange={(e) => updateService(service.id, "default_price", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Est. Hours</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={service.default_hours || ""}
                      onChange={(e) => updateService(service.id, "default_hours", parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-1 pt-5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeService(service.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button type="button" variant="outline" size="sm" onClick={addService}>
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </Button>
        </CardContent>
      </Card>

      {/* Default Terms */}
      <Card>
        <CardHeader>
          <CardTitle>Default Terms & Conditions</CardTitle>
          <CardDescription>
            These terms will be pre-filled when creating new proposals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={defaultTerms}
            onChange={(e) => setDefaultTerms(e.target.value)}
            placeholder="Enter your standard terms and conditions..."
            rows={8}
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateSettings.isPending}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          {updateSettings.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
