import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/emails/RichTextEditor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Loader2, Save, Package, History, Search, Pencil } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCompanySettings, useUpdateCompanySettings, ServiceCatalogItem, PriceChangeEntry, WORK_TYPE_DISCIPLINES, type ServiceRequirement } from "@/hooks/useCompanySettings";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
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
  const [customWorkTypes, setCustomWorkTypes] = useState<string[]>([]);
  const [newWorkType, setNewWorkType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [newService, setNewService] = useState<Partial<ServiceCatalogItem>>({
    name: "",
    description: "",
    default_price: 0,
    default_hours: 0,
    default_fee_type: "fixed",
    multiplier: 0,
    has_discipline_pricing: false,
    discipline_fee: 0,
  });

  // Price change audit state
  const [priceChangeDialog, setPriceChangeDialog] = useState<{
    serviceId: string;
    oldPrice: number;
    newPrice: number;
    field: "default_price" | "discipline_fee";
  } | null>(null);
  const [priceChangeReason, setPriceChangeReason] = useState("");

  useEffect(() => {
    if (companyData?.settings) {
      setServices(companyData.settings.service_catalog || []);
      setDefaultTerms(companyData.settings.default_terms || "");
      setCustomWorkTypes(companyData.settings.custom_work_types || []);
    }
  }, [companyData]);

  const addService = () => {
    if (!newService.name?.trim()) return;
    
    if (editingServiceId) {
      // Update existing service
      setServices(services.map(s => s.id === editingServiceId ? {
        ...s,
        name: newService.name || s.name,
        description: newService.description ?? s.description,
        default_price: newService.default_price ?? s.default_price,
        default_hours: newService.default_hours ?? s.default_hours,
        default_fee_type: (newService.default_fee_type as any) ?? s.default_fee_type,
        multiplier: newService.multiplier ?? s.multiplier,
        has_discipline_pricing: newService.has_discipline_pricing ?? s.has_discipline_pricing,
        discipline_fee: newService.discipline_fee ?? s.discipline_fee,
        show_work_types: newService.show_work_types ?? s.show_work_types,
        default_requirements: (newService as any).default_requirements ?? s.default_requirements,
        complexity_weight: (newService as any).complexity_weight ?? s.complexity_weight,
      } : s));
    } else {
      const id = crypto.randomUUID();
      setServices([
        {
          id,
          name: newService.name || "",
          description: newService.description || "",
          default_price: newService.default_price || 0,
          default_hours: newService.default_hours || 0,
          default_fee_type: newService.default_fee_type as any,
          multiplier: newService.multiplier || 0,
          has_discipline_pricing: newService.has_discipline_pricing || false,
          discipline_fee: newService.discipline_fee || 0,
          default_requirements: (newService as any).default_requirements || [],
          complexity_weight: (newService as any).complexity_weight || 1,
        },
        ...services,
      ]);
    }
    setNewService({
      name: "",
      description: "",
      default_price: 0,
      default_hours: 0,
      default_fee_type: "fixed",
      multiplier: 0,
      has_discipline_pricing: false,
      discipline_fee: 0,
    });
    setEditingServiceId(null);
    setAddDialogOpen(false);
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

  const handlePriceBlur = (serviceId: string, newPriceStr: string, field: "default_price" | "discipline_fee" = "default_price") => {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    const newPrice = parseFloat(newPriceStr) || 0;
    const savedService = companyData?.settings?.service_catalog?.find((s) => s.id === serviceId);
    const oldPrice = field === "discipline_fee" 
      ? (savedService?.discipline_fee || 0) 
      : (savedService?.default_price || 0);

    // Only prompt if price actually changed from saved value and service already existed
    if (oldPrice > 0 && newPrice !== oldPrice) {
      setPriceChangeDialog({ serviceId, oldPrice, newPrice, field });
      setPriceChangeReason("");
    }
  };

  const confirmPriceChange = () => {
    if (!priceChangeDialog) return;
    const { serviceId, oldPrice, newPrice } = priceChangeDialog;

    const fieldLabel = priceChangeDialog.field === "discipline_fee" ? "Work Type Fee" : "Base Price";
    const entry: PriceChangeEntry = {
      old_price: oldPrice,
      new_price: newPrice,
      changed_at: new Date().toISOString(),
      changed_by: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : undefined,
      reason: `[${fieldLabel}] ${priceChangeReason || "No reason provided"}`,
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
          custom_work_types: customWorkTypes,
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
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Service Catalog
            </CardTitle>
            <CardDescription>
              Define your standard services for quick addition to proposals. Price changes are audited.
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </Button>
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
                    <TableHead className="w-[20%]">Name</TableHead>
                     <TableHead className="w-[8%]">Fee Type</TableHead>
                     <TableHead className="w-[8%]">Base Price</TableHead>
                     <TableHead className="w-[6%]">Hours</TableHead>
                     <TableHead className="w-[6%]">Multiplier</TableHead>
                     <TableHead className="w-[5%]">Weight</TableHead>
                     <TableHead className="w-[6%]">Work Types</TableHead>
                     <TableHead className="w-[12%]">Per Work Type</TableHead>
                     <TableHead className="w-[8%]" />
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
                      <React.Fragment key={service.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={(e) => {
                          // Don't toggle if clicking an input/select/button
                          const tag = (e.target as HTMLElement).closest("input, textarea, select, button, [role='combobox'], [data-radix-collection-item]");
                          if (tag) return;
                          setExpandedServiceId(prev => prev === service.id ? null : service.id);
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {expandedServiceId === service.id ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                            <Input
                              value={service.name}
                              onChange={(e) => updateService(service.id, "name", e.target.value)}
                              placeholder="Service name"
                              className="h-8 text-sm"
                            />
                          </div>
                          {service.description && expandedServiceId !== service.id && (
                            <p className="text-xs text-muted-foreground truncate mt-1 ml-5 max-w-[200px]">{service.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={service.default_fee_type || "fixed"}
                            onValueChange={(v) => {
                              setServices(services.map(s => s.id === service.id ? { ...s, default_fee_type: v as any } : s));
                            }}
                          >
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Fixed</SelectItem>
                              <SelectItem value="hourly">Hourly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
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
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Input
                                  type="number"
                                  min="1"
                                  max="10"
                                  step="1"
                                  value={(service as any).complexity_weight || ""}
                                  onChange={(e) => {
                                    setServices(services.map(s => s.id === service.id ? { ...s, complexity_weight: parseInt(e.target.value) || 1 } : s));
                                  }}
                                  placeholder="1"
                                  className="h-8 text-sm w-14"
                                />
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Complexity weight (1-10) for PM capacity tracking</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={service.show_work_types !== false}
                            onCheckedChange={(checked) => {
                              setServices(services.map(s => s.id === service.id ? { ...s, show_work_types: !!checked } : s));
                            }}
                            className="h-3.5 w-3.5"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={!!service.has_discipline_pricing}
                              onCheckedChange={(checked) => {
                                setServices(services.map(s => s.id === service.id ? { ...s, has_discipline_pricing: !!checked, discipline_fee: s.discipline_fee || 0 } : s));
                              }}
                              className="h-3.5 w-3.5"
                            />
                            {service.has_discipline_pricing && (
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={service.discipline_fee || ""}
                                onChange={(e) => {
                                  setServices(services.map(s => s.id === service.id ? { ...s, discipline_fee: parseFloat(e.target.value) || 0 } : s));
                                }}
                                onBlur={(e) => handlePriceBlur(service.id, e.target.value, "discipline_fee")}
                                placeholder="$/wt"
                                className="h-8 text-sm w-20"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setNewService({
                                  ...service,
                                });
                                setEditingServiceId(service.id);
                                setAddDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeService(service.id)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded Description Row */}
                      {expandedServiceId === service.id && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-muted/30 border-t-0 pt-0 pb-3">
                            <div className="space-y-1.5 pl-5">
                              <Label className="text-xs text-muted-foreground">Description</Label>
                              <RichTextEditor
                                content={service.description || ""}
                                onChange={(html) => updateService(service.id, "description", html)}
                                placeholder="Enter a detailed description for this service..."
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {/* Default Requirements Row */}
                      <TableRow>
                        <TableCell colSpan={9} className="p-0">
                          <ServiceRequirementsEditor
                            requirements={service.default_requirements || []}
                            onChange={(reqs) => {
                              setServices(services.map(s => s.id === service.id ? { ...s, default_requirements: reqs } : s));
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}

          {services.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Click <strong>"Add Service"</strong> above to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Price Change Audit Log */}
      {(() => {
        const allChanges = services
          .flatMap((s) =>
            (s.price_history || []).map((entry) => ({
              serviceName: s.name,
              ...entry,
            }))
          )
          .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

        if (allChanges.length === 0) return null;

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Price Change Audit Log
              </CardTitle>
              <CardDescription>
                Chronological log of all service price changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Old Price</TableHead>
                      <TableHead>New Price</TableHead>
                      <TableHead>Changed By</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allChanges.map((entry, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(entry.changed_at), "MM/dd/yy h:mm a")}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{entry.serviceName}</TableCell>
                        <TableCell className="text-sm">${entry.old_price.toLocaleString()}</TableCell>
                        <TableCell className="text-sm">${entry.new_price.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.changed_by || "—"}</TableCell>
                        <TableCell className="text-sm">{entry.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Custom Work Types */}
      <Card>
        <CardHeader>
          <CardTitle>Work Type Disciplines</CardTitle>
          <CardDescription>
            Manage the list of disciplines available for work-type pricing. The default list includes Plumbing, Mechanical, Electrical, etc. Add custom disciplines below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {WORK_TYPE_DISCIPLINES.map((d) => (
              <span key={d} className="px-2.5 py-1 text-xs rounded-full bg-muted text-muted-foreground">{d}</span>
            ))}
            {customWorkTypes.map((d, i) => (
              <span key={d} className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary flex items-center gap-1">
                {d}
                <button className="hover:text-destructive" onClick={() => setCustomWorkTypes(customWorkTypes.filter((_, j) => j !== i))}>×</button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newWorkType}
              onChange={(e) => setNewWorkType(e.target.value)}
              placeholder="Add custom discipline…"
              className="h-8 text-sm max-w-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newWorkType.trim()) {
                  e.preventDefault();
                  if (!customWorkTypes.includes(newWorkType.trim()) && !WORK_TYPE_DISCIPLINES.includes(newWorkType.trim() as any)) {
                    setCustomWorkTypes([...customWorkTypes, newWorkType.trim()]);
                  }
                  setNewWorkType("");
                }
              }}
            />
            <Button variant="outline" size="sm" className="h-8" disabled={!newWorkType.trim()} onClick={() => {
              if (newWorkType.trim() && !customWorkTypes.includes(newWorkType.trim()) && !WORK_TYPE_DISCIPLINES.includes(newWorkType.trim() as any)) {
                setCustomWorkTypes([...customWorkTypes, newWorkType.trim()]);
              }
              setNewWorkType("");
            }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
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

      {/* Sticky Save Bar */}
      {(() => {
        const savedCatalog = companyData?.settings?.service_catalog || [];
        const isDirty = JSON.stringify(services.filter(s => s.name.trim())) !== JSON.stringify(savedCatalog) ||
          defaultTerms !== (companyData?.settings?.default_terms || "") ||
          JSON.stringify(customWorkTypes) !== JSON.stringify(companyData?.settings?.custom_work_types || []);
        if (!isDirty) return null;
        return (
          <div className="sticky bottom-0 z-10 bg-background border-t py-3 px-4 flex items-center justify-between rounded-lg shadow-lg -mx-2">
            <p className="text-sm text-muted-foreground">You have unsaved changes</p>
            <Button
              onClick={handleSave}
              disabled={updateSettings.isPending}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {updateSettings.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" />Save Settings</>
              )}
            </Button>
          </div>
        );
      })()}

      {/* Save Button (always visible) */}
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

      {/* Add Service Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open);
        if (!open) {
          setEditingServiceId(null);
          setNewService({ name: "", description: "", default_price: 0, default_hours: 0, default_fee_type: "fixed", multiplier: 0, has_discipline_pricing: false, discipline_fee: 0 });
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingServiceId ? "Edit Service" : "Add New Service"}</DialogTitle>
            <DialogDescription>{editingServiceId ? "Update this service in your catalog." : "Define a new service for your catalog."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Service Name *</Label>
              <Input
                value={newService.name || ""}
                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                placeholder="e.g., DOB Filing"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor
                content={newService.description || ""}
                onChange={(html) => setNewService({ ...newService, description: html })}
                placeholder="Service description / scope..."
              />
              <p className="text-xs text-muted-foreground">Use the toolbar to format scope items. This text appears on proposals.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label className="cursor-help inline-flex items-center gap-1">Fee Type <span className="text-muted-foreground text-xs">ⓘ</span></Label>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs max-w-[220px]"><strong>Fixed:</strong> One-time flat fee for the service.<br/><strong>Hourly:</strong> Billed per hour worked, uses Base Price as the hourly rate.<br/><strong>Monthly:</strong> Recurring charge per month (e.g., retainers, monitoring).</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Select
                  value={newService.default_fee_type || "fixed"}
                  onValueChange={(v) => setNewService({ ...newService, default_fee_type: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Base Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newService.default_price || ""}
                  onChange={(e) => setNewService({ ...newService, default_price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Est. Hours</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={newService.default_hours || ""}
                  onChange={(e) => setNewService({ ...newService, default_hours: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label className="cursor-help inline-flex items-center gap-1">Multiplier <span className="text-muted-foreground text-xs">ⓘ</span></Label>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs max-w-[220px]">Scales the base price when a service applies to multiple items. E.g., if base price is $500 and multiplier is 1.5 with 3 work types, the total adjusts accordingly. Set to 0 or leave blank if not applicable.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={newService.multiplier || ""}
                  onChange={(e) => setNewService({ ...newService, multiplier: parseFloat(e.target.value) || 0 })}
                  placeholder="1.0"
                />
              </div>
              <div className="space-y-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label className="cursor-help inline-flex items-center gap-1">Complexity Weight <span className="text-muted-foreground text-xs">ⓘ</span></Label>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs max-w-[220px]">How much PM bandwidth this service requires (1 = simple, 10 = very complex). Used on the dashboard to calculate each PM's workload so managers can balance assignments.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                  value={(newService as any).complexity_weight || ""}
                  onChange={(e) => setNewService({ ...newService, complexity_weight: parseInt(e.target.value) || 1 } as any)}
                  placeholder="1"
                />
              </div>
            </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                checked={newService.show_work_types !== false}
                onCheckedChange={(checked) => setNewService({ ...newService, show_work_types: !!checked })}
                className="h-3.5 w-3.5"
                id="new-show-wt"
              />
              <Label htmlFor="new-show-wt" className="text-sm cursor-pointer">Show Work Type picker on proposals</Label>
            </div>
            <div className="border-t pt-3">
              <ServiceRequirementsEditor
                requirements={(newService as any).default_requirements || []}
                onChange={(reqs) => setNewService({ ...newService, default_requirements: reqs } as any)}
              />
            </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={addService} disabled={!newService.name?.trim()}>{editingServiceId ? "Save Changes" : "Add Service"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

// ======== SERVICE REQUIREMENTS EDITOR ========

const REQUIREMENT_CATEGORIES = [
  { value: "missing_document", label: "Missing Document" },
  { value: "missing_info", label: "Missing Info" },
  { value: "pending_signature", label: "Pending Signature" },
  { value: "pending_response", label: "Pending Response" },
];

function ServiceRequirementsEditor({
  requirements,
  onChange,
}: {
  requirements: ServiceRequirement[];
  onChange: (reqs: ServiceRequirement[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const addReq = () => {
    onChange([...requirements, { label: "", category: "missing_document", from_whom_role: "" }]);
    setIsOpen(true);
  };

  const removeReq = (idx: number) => {
    onChange(requirements.filter((_, i) => i !== idx));
  };

  const updateReq = (idx: number, field: keyof ServiceRequirement, value: string) => {
    onChange(requirements.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground w-full text-left group">
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 cursor-help">
                  Default Requirements ({requirements.length})
                  <span className="text-muted-foreground text-[10px]">ⓘ</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                Pre-define a checklist of items needed before work can begin (e.g., sealed plans, owner authorization). When this service is added to a project, these requirements auto-populate so the PM knows exactly what to collect.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-3">
        <div className="space-y-2">
          {requirements.map((req, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={req.label}
                onChange={(e) => updateReq(idx, "label", e.target.value)}
                placeholder="e.g., Sealed plans from architect"
                className="h-7 text-xs flex-1"
              />
              <Select value={req.category} onValueChange={(v) => updateReq(idx, "category", v)}>
                <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REQUIREMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={req.from_whom_role}
                onChange={(e) => updateReq(idx, "from_whom_role", e.target.value)}
                placeholder="From whom"
                className="h-7 text-xs w-28"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeReq(idx)}>
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={addReq}>
            <Plus className="h-3 w-3" /> Add Requirement
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
