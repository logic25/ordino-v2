import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, GitBranch } from "lucide-react";
import type { ChangeOrder, ChangeOrderFormInput } from "@/hooks/useChangeOrders";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  reason: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  requested_by: z.string().optional(),
  linked_service_names: z.string().optional(), // comma-separated
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ChangeOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ChangeOrderFormInput, asDraft: boolean) => Promise<void>;
  isLoading?: boolean;
  existingCO?: ChangeOrder | null;
  serviceNames?: string[];
}

export function ChangeOrderDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  existingCO,
  serviceNames = [],
}: ChangeOrderDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      reason: "",
      amount: "",
      requested_by: "",
      linked_service_names: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (existingCO) {
        form.reset({
          title: existingCO.title,
          description: existingCO.description ?? "",
          reason: existingCO.reason ?? "",
          amount: String(existingCO.amount),
          requested_by: existingCO.requested_by ?? "",
          linked_service_names: (existingCO.linked_service_names ?? []).join(", "),
          notes: existingCO.notes ?? "",
        });
      } else {
        form.reset({
          title: "",
          description: "",
          reason: "",
          amount: "",
          requested_by: "",
          linked_service_names: "",
          notes: "",
        });
      }
    }
  }, [open, existingCO]);

  const handleSubmit = async (values: FormValues, asDraft: boolean) => {
    const amountNum = parseFloat(values.amount.replace(/[^0-9.-]/g, ""));
    const linkedServices = values.linked_service_names
      ? values.linked_service_names.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    await onSubmit({
      title: values.title,
      description: values.description || undefined,
      reason: values.reason || undefined,
      amount: isNaN(amountNum) ? 0 : amountNum,
      requested_by: values.requested_by || undefined,
      linked_service_names: linkedServices,
      notes: values.notes || undefined,
    }, asDraft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            {existingCO ? `Edit ${existingCO.co_number}` : "Create Change Order"}
          </DialogTitle>
          <DialogDescription>
            {existingCO
              ? "Update the details for this change order."
              : "Document a scope change. The CO number is assigned automatically."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="co-title">Title *</Label>
            <Input
              id="co-title"
              placeholder="e.g. PAA to address Schedule B"
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="co-description">Scope / Description</Label>
            <Textarea
              id="co-description"
              placeholder="What work is being added or changed?"
              className="min-h-[80px] text-sm"
              {...form.register("description")}
            />
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="co-reason">Reason</Label>
            <Textarea
              id="co-reason"
              placeholder="Why is this change order being issued?"
              className="min-h-[60px] text-sm"
              {...form.register("reason")}
            />
          </div>

          {/* Amount + Requested By (side by side) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="co-amount">Amount * (use negative for credits)</Label>
              <Input
                id="co-amount"
                placeholder="e.g. 1500 or -500"
                {...form.register("amount")}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-requested-by">Requested By</Label>
              <Select
                value={form.watch("requested_by") || ""}
                onValueChange={(v) => form.setValue("requested_by", v)}
              >
                <SelectTrigger id="co-requested-by">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Client">Client</SelectItem>
                  <SelectItem value="Internal">Internal</SelectItem>
                  <SelectItem value="GC">General Contractor</SelectItem>
                  <SelectItem value="Architect">Architect</SelectItem>
                  <SelectItem value="Engineer">Engineer</SelectItem>
                  <SelectItem value="DOB">DOB / Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linked Services */}
          <div className="space-y-1.5">
            <Label htmlFor="co-services">Linked Services</Label>
            {serviceNames.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {serviceNames.map((sn) => {
                  const current = (form.watch("linked_service_names") || "").split(",").map(s => s.trim()).filter(Boolean);
                  const isSelected = current.includes(sn);
                  return (
                    <button
                      key={sn}
                      type="button"
                      onClick={() => {
                        const next = isSelected
                          ? current.filter(s => s !== sn)
                          : [...current, sn];
                        form.setValue("linked_service_names", next.join(", "));
                      }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted hover:bg-muted/80 border-border text-muted-foreground"
                      }`}
                    >
                      {sn}
                    </button>
                  );
                })}
              </div>
            ) : (
              <Input
                id="co-services"
                placeholder="e.g. ALT2 GC, Work Permit (comma-separated)"
                {...form.register("linked_service_names")}
              />
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="co-notes">Internal Notes</Label>
            <Textarea
              id="co-notes"
              placeholder="Any internal notes for this CO..."
              className="min-h-[56px] text-sm"
              {...form.register("notes")}
            />
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={form.handleSubmit((v) => handleSubmit(v, true))}
          >
            Save as Draft
          </Button>
          <Button
            type="button"
            disabled={isLoading}
            onClick={form.handleSubmit((v) => handleSubmit(v, false))}
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : existingCO ? "Save Changes" : "Create CO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
