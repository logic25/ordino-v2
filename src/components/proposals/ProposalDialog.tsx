import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import type { ProposalWithRelations, ProposalFormInput } from "@/hooks/useProposals";
import { useProperties } from "@/hooks/useProperties";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { useClients, useCreateClient, Client } from "@/hooks/useClients";
import { useCompanySettings, ServiceCatalogItem } from "@/hooks/useCompanySettings";
import { useToast } from "@/hooks/use-toast";

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Service name is required"),
  description: z.string().optional(),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  unit_price: z.coerce.number().min(0, "Price must be 0 or greater"),
  estimated_hours: z.coerce.number().min(0).optional(),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
  sort_order: z.number().optional(),
});

const proposalSchema = z.object({
  property_id: z.string().min(1, "Property is required"),
  title: z.string().min(1, "Title is required"),
  payment_terms: z.string().optional(),
  deposit_required: z.coerce.number().optional(),
  deposit_percentage: z.coerce.number().optional(),
  valid_until: z.string().optional(),
  client_id: z.string().optional(),
  client_name: z.string().optional(),
  client_email: z.string().email().optional().or(z.literal("")),
  assigned_pm_id: z.string().optional(),
  notes: z.string().optional(),
  terms_conditions: z.string().optional(),
  items: z.array(itemSchema),
});

type FormData = z.infer<typeof proposalSchema>;

interface ProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProposalFormInput) => Promise<void>;
  proposal?: ProposalWithRelations | null;
  isLoading?: boolean;
  defaultPropertyId?: string;
}

export function ProposalDialog({
  open,
  onOpenChange,
  onSubmit,
  proposal,
  isLoading,
  defaultPropertyId,
}: ProposalDialogProps) {
  const isEditing = !!proposal;
  const { data: properties = [] } = useProperties();
  const { data: profiles = [] } = useAssignableProfiles();
  const { data: clients = [] } = useClients();
  const { data: companyData } = useCompanySettings();
  const createClient = useCreateClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("services");
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

  const serviceCatalog = companyData?.settings?.service_catalog || [];
  const defaultTerms = companyData?.settings?.default_terms || "";

  const form = useForm<FormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      property_id: defaultPropertyId || "",
      title: "",
      payment_terms: "",
      deposit_required: 0,
      deposit_percentage: undefined,
      valid_until: "",
      client_id: "",
      client_name: "",
      client_email: "",
      assigned_pm_id: "",
      notes: "",
      terms_conditions: defaultTerms,
      items: [{ name: "", description: "", quantity: 1, unit_price: 0, estimated_hours: 0, discount_percent: 0 }],
    },
  });

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (proposal) {
      form.reset({
        property_id: proposal.property_id || "",
        title: proposal.title || "",
        payment_terms: proposal.payment_terms || "",
        deposit_required: Number(proposal.deposit_required) || 0,
        deposit_percentage: proposal.deposit_percentage ? Number(proposal.deposit_percentage) : undefined,
        valid_until: proposal.valid_until || "",
        client_id: (proposal as any).client_id || "",
        client_name: proposal.client_name || "",
        client_email: proposal.client_email || "",
        assigned_pm_id: proposal.assigned_pm_id || "",
        notes: proposal.notes || "",
        terms_conditions: (proposal as any).terms_conditions || defaultTerms,
        items: proposal.items?.length ? proposal.items.map(i => ({
          id: i.id,
          name: i.name,
          description: i.description || "",
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          estimated_hours: Number((i as any).estimated_hours) || 0,
          discount_percent: Number((i as any).discount_percent) || 0,
          sort_order: i.sort_order ?? undefined,
        })) : [{ name: "", description: "", quantity: 1, unit_price: 0, estimated_hours: 0, discount_percent: 0 }],
      });
    } else {
      form.reset({
        property_id: defaultPropertyId || "",
        title: "",
        payment_terms: "",
        deposit_required: 0,
        deposit_percentage: undefined,
        valid_until: "",
        client_id: "",
        client_name: "",
        client_email: "",
        assigned_pm_id: "",
        notes: "",
        terms_conditions: defaultTerms,
        items: [{ name: "", description: "", quantity: 1, unit_price: 0, estimated_hours: 0, discount_percent: 0 }],
      });
    }
  }, [proposal, form, defaultPropertyId, defaultTerms]);

  const watchedItems = form.watch("items");
  
  const calculateLineTotal = (item: typeof watchedItems[0]) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const discountPct = Number(item.discount_percent) || 0;
    const subtotal = qty * price;
    const discount = subtotal * (discountPct / 100);
    return subtotal - discount;
  };

  const subtotal = watchedItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  const totalHours = watchedItems.reduce((sum, item) => sum + (Number(item.estimated_hours) || 0), 0);

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      form.setValue("client_id", clientId);
      form.setValue("client_name", client.name);
      form.setValue("client_email", client.email || "");
    }
    setShowNewClient(false);
  };

  const handleAddNewClient = async () => {
    if (!newClientName.trim()) {
      toast({ title: "Error", description: "Client name is required", variant: "destructive" });
      return;
    }

    try {
      const newClient = await createClient.mutateAsync({
        name: newClientName,
        email: newClientEmail || null,
      });
      form.setValue("client_id", newClient.id);
      form.setValue("client_name", newClient.name);
      form.setValue("client_email", newClient.email || "");
      setNewClientName("");
      setNewClientEmail("");
      setShowNewClient(false);
      toast({ title: "Client added", description: "New client has been created." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAddServiceFromCatalog = (service: ServiceCatalogItem) => {
    appendItem({
      name: service.name,
      description: service.description || "",
      quantity: 1,
      unit_price: service.default_price || 0,
      estimated_hours: service.default_hours || 0,
      discount_percent: 0,
    });
  };

  const handleSubmit = async (data: FormData) => {
    const validItems = data.items.filter(i => i.name);

    const formData: ProposalFormInput = {
      property_id: data.property_id,
      title: data.title,
      payment_terms: data.payment_terms || null,
      deposit_required: data.deposit_required || null,
      deposit_percentage: data.deposit_percentage || null,
      valid_until: data.valid_until || null,
      client_name: data.client_name || null,
      client_email: data.client_email || null,
      assigned_pm_id: data.assigned_pm_id || null,
      notes: data.notes || null,
      items: validItems.map((item, idx) => ({
        id: item.id,
        name: item.name,
        description: item.description || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        sort_order: idx,
      })),
      milestones: [],
    };
    await onSubmit(formData);
    form.reset();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Proposal" : "New Proposal"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the proposal details."
              : "Create a new proposal for a property."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="property_id">Property *</Label>
              <Select
                value={form.watch("property_id")}
                onValueChange={(value) => form.setValue("property_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.property_id && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.property_id.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Proposal Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Full Permit Package"
                {...form.register("title")}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>
          </div>

          {/* Client Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Client</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNewClient(!showNewClient)}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                {showNewClient ? "Select Existing" : "New Client"}
              </Button>
            </div>
            
            {showNewClient ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Client name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Email (optional)"
                  type="email"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleAddNewClient}
                  disabled={createClient.isPending}
                  size="sm"
                >
                  {createClient.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
            ) : (
              <Select
                value={form.watch("client_id") || ""}
                onValueChange={handleClientSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select or add a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.email && `(${c.email})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="terms">Terms & Notes</TabsTrigger>
            </TabsList>

            {/* Services Tab - Spreadsheet Style */}
            <TabsContent value="services" className="space-y-4 mt-4">
              {serviceCatalog.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Quick add:</span>
                  {serviceCatalog.map((service) => (
                    <Button
                      key={service.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddServiceFromCatalog(service)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {service.name}
                    </Button>
                  ))}
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Service</th>
                      <th className="text-left p-2 font-medium w-[200px]">Description</th>
                      <th className="text-left p-2 font-medium w-20">Qty</th>
                      <th className="text-left p-2 font-medium w-24">Unit Price</th>
                      <th className="text-left p-2 font-medium w-20">Hours</th>
                      <th className="text-left p-2 font-medium w-20">Disc %</th>
                      <th className="text-right p-2 font-medium w-28">Total</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemFields.map((field, index) => {
                      const lineTotal = calculateLineTotal(watchedItems[index] || {});

                      return (
                        <tr key={field.id} className="border-t">
                          <td className="p-1">
                            <Input
                              placeholder="Service name"
                              className="border-0 shadow-none focus-visible:ring-0 h-8"
                              {...form.register(`items.${index}.name`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              placeholder="Description"
                              className="border-0 shadow-none focus-visible:ring-0 h-8"
                              {...form.register(`items.${index}.description`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="border-0 shadow-none focus-visible:ring-0 h-8"
                              {...form.register(`items.${index}.quantity`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="border-0 shadow-none focus-visible:ring-0 h-8"
                              {...form.register(`items.${index}.unit_price`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              className="border-0 shadow-none focus-visible:ring-0 h-8"
                              {...form.register(`items.${index}.estimated_hours`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              className="border-0 shadow-none focus-visible:ring-0 h-8"
                              {...form.register(`items.${index}.discount_percent`)}
                            />
                          </td>
                          <td className="p-2 text-right font-medium">
                            {formatCurrency(lineTotal)}
                          </td>
                          <td className="p-1">
                            {itemFields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendItem({ name: "", description: "", quantity: 1, unit_price: 0, estimated_hours: 0, discount_percent: 0 })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>

              {/* Totals */}
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Hours</span>
                    <span className="font-medium">{totalHours} hrs</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg">{formatCurrency(subtotal)}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Terms & Notes Tab */}
            <TabsContent value="terms" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <Textarea
                  id="payment_terms"
                  placeholder="e.g., 50% deposit upon signing, balance due upon permit approval"
                  rows={3}
                  {...form.register("payment_terms")}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deposit_percentage">Deposit %</Label>
                  <Input
                    id="deposit_percentage"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="50"
                    {...form.register("deposit_percentage")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid_until">Valid Until</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    {...form.register("valid_until")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assigned_pm_id">Assigned PM</Label>
                  <Select
                    value={form.watch("assigned_pm_id") || ""}
                    onValueChange={(value) => form.setValue("assigned_pm_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select PM" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="terms_conditions">Terms & Conditions</Label>
                <Textarea
                  id="terms_conditions"
                  placeholder="Enter terms and conditions..."
                  rows={6}
                  {...form.register("terms_conditions")}
                />
                <p className="text-xs text-muted-foreground">
                  Configure default terms in Settings → Company
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Internal Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Notes visible only to your team..."
                  rows={3}
                  {...form.register("notes")}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Update Proposal"
              ) : (
                "Create Proposal"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
