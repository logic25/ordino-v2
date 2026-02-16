import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Loader2, Save, Package, History, Search } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useCompanySettings, useUpdateCompanySettings, ServiceCatalogItem, PriceChangeEntry } from "@/hooks/useCompanySettings";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { format } from "date-fns";

export function ServiceCatalogSettings() {
  const { data: companyData, isLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [defaultTerms, setDefaultTerms] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Price change audit state
  const [priceChangeDialog, setPriceChangeDialog] = useState<{
    serviceId: string;
    oldPrice: number;
    newPrice: number;
  } | null>(null);
  const [priceChangeReason, setPriceChangeReason] = useState("");

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

  const handlePriceBlur = (serviceId: string, newPriceStr: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    const newPrice = parseFloat(newPriceStr) || 0;
    const oldPrice = companyData?.settings?.service_catalog?.find((s) => s.id === serviceId)?.default_price || 0;

    // Only prompt if price actually changed from saved value and service already existed
    if (oldPrice > 0 && newPrice !== oldPrice) {
      setPriceChangeDialog({ serviceId, oldPrice, newPrice });
      setPriceChangeReason("");
    }
  };

  const confirmPriceChange = () => {
    if (!priceChangeDialog) return;
    const { serviceId, oldPrice, newPrice } = priceChangeDialog;

    const entry: PriceChangeEntry = {
      old_price: oldPrice,
      new_price: newPrice,
      changed_at: new Date().toISOString(),
      changed_by: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : undefined,
      reason: priceChangeReason || "No reason provided",
    };

    setServices(
      services.map((s) =>
        s.id === serviceId
          ? { ...s, price_history: [...(s.price_history || []), entry] }
          : s
      )
    );

    setPriceChangeDialog(null);
    setPriceChangeReason("");
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
            Define your standard services for quick addition to proposals. Price changes are audited.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search services..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No services defined yet.</p>
              <p className="text-sm">Add services to quickly populate proposals.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[22%]">Name</TableHead>
                    <TableHead className="w-[28%]">Description</TableHead>
                    <TableHead className="w-[12%]">Price</TableHead>
                    <TableHead className="w-[10%]">Hours</TableHead>
                    <TableHead className="w-[12%]">Multiplier</TableHead>
                    <TableHead className="w-[16%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services
                    .filter((s) => {
                      if (!searchQuery) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        s.name.toLowerCase().includes(q) ||
                        (s.description || "").toLowerCase().includes(q)
                      );
                    })
                    .map((service) => (
                      <TableRow key={service.id}>
                        <TableCell>
                          <Input
                            value={service.name}
                            onChange={(e) => updateService(service.id, "name", e.target.value)}
                            placeholder="Service name"
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={service.description || ""}
                            onChange={(e) => updateService(service.id, "description", e.target.value)}
                            placeholder="Description"
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={service.default_price || ""}
                              onChange={(e) => updateService(service.id, "default_price", parseFloat(e.target.value) || 0)}
                              onBlur={(e) => handlePriceBlur(service.id, e.target.value)}
                              placeholder="0.00"
                              className="h-8 text-sm"
                            />
                            {service.price_history && service.price_history.length > 0 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="text-muted-foreground hover:text-foreground shrink-0">
                                    <History className="h-3.5 w-3.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 max-h-60 overflow-y-auto" align="start">
                                  <div className="space-y-2">
                                    <h4 className="font-medium text-sm">Price History</h4>
                                    {[...service.price_history].reverse().map((entry, i) => (
                                      <div key={i} className="text-xs border-b pb-2 last:border-0">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            ${entry.old_price.toLocaleString()} → ${entry.new_price.toLocaleString()}
                                          </span>
                                          <span className="text-muted-foreground">
                                            {format(new Date(entry.changed_at), "MM/dd/yy")}
                                          </span>
                                        </div>
                                        <p className="mt-0.5">{entry.reason}</p>
                                        {entry.changed_by && (
                                          <p className="text-muted-foreground">by {entry.changed_by}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={service.default_hours || ""}
                            onChange={(e) => updateService(service.id, "default_hours", parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={service.multiplier || ""}
                            onChange={(e) => updateService(service.id, "multiplier", parseFloat(e.target.value) || 0)}
                            placeholder="1.0"
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeService(service.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addService}>
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </div>
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

      {/* Price Change Reason Dialog */}
      <Dialog open={!!priceChangeDialog} onOpenChange={(open) => !open && setPriceChangeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Price Change Audit</DialogTitle>
            <DialogDescription>
              {priceChangeDialog && (
                <>
                  Price changing from <strong>${priceChangeDialog.oldPrice.toLocaleString()}</strong> to{" "}
                  <strong>${priceChangeDialog.newPrice.toLocaleString()}</strong>. Please provide a reason.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={priceChangeReason}
            onChange={(e) => setPriceChangeReason(e.target.value)}
            placeholder="e.g., Updated to reflect new cost analysis, market adjustment, client-specific pricing..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceChangeDialog(null)}>Cancel</Button>
            <Button onClick={confirmPriceChange}>Confirm Change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
