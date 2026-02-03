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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2, DollarSign } from "lucide-react";
import type { ProposalWithRelations, ProposalFormInput } from "@/hooks/useProposals";
import { useProperties } from "@/hooks/useProperties";
import { useAssignableProfiles } from "@/hooks/useProfiles";

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Service name is required"),
  description: z.string().optional(),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  unit_price: z.coerce.number().min(0, "Price must be 0 or greater"),
  sort_order: z.number().optional(),
});

const milestoneSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Milestone name is required"),
  description: z.string().optional(),
  percentage: z.coerce.number().min(0).max(100).optional(),
  amount: z.coerce.number().optional(),
  due_date: z.string().optional(),
  sort_order: z.number().optional(),
});

const proposalSchema = z.object({
  property_id: z.string().min(1, "Property is required"),
  title: z.string().min(1, "Title is required"),
  scope_of_work: z.string().optional(),
  payment_terms: z.string().optional(),
  deposit_required: z.coerce.number().optional(),
  deposit_percentage: z.coerce.number().optional(),
  tax_rate: z.coerce.number().optional(),
  valid_until: z.string().optional(),
  client_name: z.string().optional(),
  client_email: z.string().email().optional().or(z.literal("")),
  assigned_pm_id: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema),
  milestones: z.array(milestoneSchema),
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
  const [activeTab, setActiveTab] = useState("services");

  const form = useForm<FormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      property_id: defaultPropertyId || "",
      title: "",
      scope_of_work: "",
      payment_terms: "",
      deposit_required: 0,
      deposit_percentage: undefined,
      tax_rate: 0,
      valid_until: "",
      client_name: "",
      client_email: "",
      assigned_pm_id: "",
      notes: "",
      items: [{ name: "", description: "", quantity: 1, unit_price: 0 }],
      milestones: [],
    },
  });

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const { fields: milestoneFields, append: appendMilestone, remove: removeMilestone } = useFieldArray({
    control: form.control,
    name: "milestones",
  });

  useEffect(() => {
    if (proposal) {
      form.reset({
        property_id: proposal.property_id || "",
        title: proposal.title || "",
        scope_of_work: proposal.scope_of_work || "",
        payment_terms: proposal.payment_terms || "",
        deposit_required: Number(proposal.deposit_required) || 0,
        deposit_percentage: proposal.deposit_percentage ? Number(proposal.deposit_percentage) : undefined,
        tax_rate: Number(proposal.tax_rate) || 0,
        valid_until: proposal.valid_until || "",
        client_name: proposal.client_name || "",
        client_email: proposal.client_email || "",
        assigned_pm_id: proposal.assigned_pm_id || "",
        notes: proposal.notes || "",
        items: proposal.items?.length ? proposal.items.map(i => ({
          id: i.id,
          name: i.name,
          description: i.description || "",
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          sort_order: i.sort_order,
        })) : [{ name: "", description: "", quantity: 1, unit_price: 0 }],
        milestones: proposal.milestones?.map(m => ({
          id: m.id,
          name: m.name,
          description: m.description || "",
          percentage: m.percentage ? Number(m.percentage) : undefined,
          amount: m.amount ? Number(m.amount) : undefined,
          due_date: m.due_date || "",
          sort_order: m.sort_order,
        })) || [],
      });
    } else {
      form.reset({
        property_id: defaultPropertyId || "",
        title: "",
        scope_of_work: "",
        payment_terms: "",
        deposit_required: 0,
        deposit_percentage: undefined,
        tax_rate: 0,
        valid_until: "",
        client_name: "",
        client_email: "",
        assigned_pm_id: "",
        notes: "",
        items: [{ name: "", description: "", quantity: 1, unit_price: 0 }],
        milestones: [],
      });
    }
  }, [proposal, form, defaultPropertyId]);

  const watchedItems = form.watch("items");
  const watchedTaxRate = form.watch("tax_rate") || 0;
  
  const subtotal = watchedItems.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  }, 0);
  const taxAmount = subtotal * (watchedTaxRate / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = async (data: FormData) => {
    const validItems = data.items.filter(i => i.name);
    const validMilestones = data.milestones.filter(m => m.name);

    const formData: ProposalFormInput = {
      property_id: data.property_id,
      title: data.title,
      scope_of_work: data.scope_of_work || null,
      payment_terms: data.payment_terms || null,
      deposit_required: data.deposit_required || null,
      deposit_percentage: data.deposit_percentage || null,
      tax_rate: data.tax_rate || null,
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
      milestones: validMilestones.map((m, idx) => ({
        id: m.id,
        name: m.name,
        description: m.description || null,
        percentage: m.percentage || null,
        amount: m.amount || null,
        due_date: m.due_date || null,
        sort_order: idx,
      })),
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
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_name">Client Name</Label>
              <Input
                id="client_name"
                placeholder="Client or Owner name"
                {...form.register("client_name")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_email">Client Email</Label>
              <Input
                id="client_email"
                type="email"
                placeholder="client@example.com"
                {...form.register("client_email")}
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="scope">Scope & Terms</TabsTrigger>
              <TabsTrigger value="milestones">Payment Milestones</TabsTrigger>
            </TabsList>

            {/* Services Tab - Spreadsheet Style */}
            <TabsContent value="services" className="space-y-4 mt-4">
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium text-sm">Service</th>
                      <th className="text-left p-2 font-medium text-sm w-32">Qty</th>
                      <th className="text-left p-2 font-medium text-sm w-32">Price</th>
                      <th className="text-right p-2 font-medium text-sm w-32">Total</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemFields.map((field, index) => {
                      const qty = Number(form.watch(`items.${index}.quantity`)) || 0;
                      const price = Number(form.watch(`items.${index}.unit_price`)) || 0;
                      const lineTotal = qty * price;

                      return (
                        <tr key={field.id} className="border-t">
                          <td className="p-1">
                            <Input
                              placeholder="Service name"
                              className="border-0 shadow-none focus-visible:ring-0"
                              {...form.register(`items.${index}.name`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="border-0 shadow-none focus-visible:ring-0"
                              {...form.register(`items.${index}.quantity`)}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="border-0 shadow-none focus-visible:ring-0"
                              {...form.register(`items.${index}.unit_price`)}
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
                onClick={() => appendItem({ name: "", description: "", quantity: 1, unit_price: 0 })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>

              {/* Totals */}
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Tax Rate (%)</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-24 text-right"
                      {...form.register("tax_rate")}
                    />
                    <span className="font-medium w-24 text-right">{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg">{formatCurrency(total)}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Scope & Terms Tab */}
            <TabsContent value="scope" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="scope_of_work">Scope of Work</Label>
                <Textarea
                  id="scope_of_work"
                  placeholder="Describe the work to be performed in detail..."
                  rows={6}
                  {...form.register("scope_of_work")}
                />
              </div>

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
                      <SelectValue placeholder="Select PM..." />
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
                <Label htmlFor="notes">Internal Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Notes for internal use only..."
                  rows={2}
                  {...form.register("notes")}
                />
              </div>
            </TabsContent>

            {/* Payment Milestones Tab */}
            <TabsContent value="milestones" className="space-y-4 mt-4">
              <div className="space-y-3">
                {milestoneFields.map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 grid grid-cols-4 gap-3">
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Milestone Name</Label>
                            <Input
                              placeholder="e.g., Upon Permit Approval"
                              {...form.register(`milestones.${index}.name`)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Percentage</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="25"
                              {...form.register(`milestones.${index}.percentage`)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Due Date</Label>
                            <Input
                              type="date"
                              {...form.register(`milestones.${index}.due_date`)}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 mt-5"
                          onClick={() => removeMilestone(index)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {milestoneFields.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No payment milestones defined</p>
                    <p className="text-sm">Add milestones to schedule payments</p>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendMilestone({ name: "", percentage: undefined, due_date: "" })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Milestone
                </Button>
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
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Saving..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Save Changes"
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
