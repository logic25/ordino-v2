import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Loader2, Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { ApplicationWithProperty, ApplicationFormInput, APPLICATION_STATUSES } from "@/hooks/useApplications";
import { useProperties } from "@/hooks/useProperties";
import { useAssignableProfiles } from "@/hooks/useProfiles";

const applicationSchema = z.object({
  property_id: z.string().min(1, "Property is required"),
  job_number: z.string().optional(),
  application_type: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  assigned_pm_id: z.string().optional(),
  filed_date: z.string().optional(),
  estimated_value: z.string().optional(),
  notes: z.string().optional(),
  notable: z.boolean().optional(),
});

type FormData = z.infer<typeof applicationSchema>;

const APPLICATION_TYPES = [
  "New Building",
  "Alteration Type 1",
  "Alteration Type 2",
  "Alteration Type 3",
  "Demolition",
  "Construction Equipment",
  "Plumbing",
  "Sprinkler",
  "Standpipe",
  "Fire Alarm",
  "Fire Suppression",
  "Elevator",
  "Boiler",
];

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "filed", label: "Filed" },
  { value: "under_review", label: "Under Review" },
  { value: "objection", label: "Objection" },
  { value: "approved", label: "Approved" },
  { value: "permit_issued", label: "Permit Issued" },
  { value: "inspection", label: "Inspection" },
  { value: "complete", label: "Complete" },
  { value: "closed", label: "Closed" },
];

interface ApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ApplicationFormInput) => Promise<void>;
  application?: ApplicationWithProperty | null;
  isLoading?: boolean;
  defaultPropertyId?: string;
}

export function ApplicationDialog({
  open,
  onOpenChange,
  onSubmit,
  application,
  isLoading,
  defaultPropertyId,
}: ApplicationDialogProps) {
  const isEditing = !!application;
  const { data: properties = [] } = useProperties();
  const { data: profiles = [] } = useAssignableProfiles();

  const form = useForm<FormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      property_id: defaultPropertyId || "",
      job_number: "",
      application_type: "",
      description: "",
      status: "draft",
      assigned_pm_id: "",
      filed_date: "",
      estimated_value: "",
      notes: "",
      notable: false,
    },
  });

  useEffect(() => {
    if (application) {
      form.reset({
        property_id: application.property_id || "",
        job_number: application.job_number || "",
        application_type: application.application_type || "",
        description: application.description || "",
        status: application.status || "draft",
        assigned_pm_id: application.assigned_pm_id || "",
        filed_date: application.filed_date || "",
        estimated_value: application.estimated_value?.toString() || "",
        notes: application.notes || "",
        notable: application.notable ?? false,
      });
    } else {
      form.reset({
        property_id: defaultPropertyId || "",
        job_number: "",
        application_type: "",
        description: "",
        status: "draft",
        assigned_pm_id: "",
        filed_date: "",
        estimated_value: "",
        notes: "",
        notable: false,
      });
    }
  }, [application, form, defaultPropertyId]);

  const handleSubmit = async (data: FormData) => {
    const formData: ApplicationFormInput = {
      property_id: data.property_id,
      job_number: data.job_number || null,
      application_type: data.application_type || null,
      description: data.description || null,
      status: (data.status as ApplicationFormInput["status"]) || "draft",
      assigned_pm_id: data.assigned_pm_id || null,
      filed_date: data.filed_date || null,
      estimated_value: data.estimated_value ? parseFloat(data.estimated_value) : null,
      notes: data.notes || null,
      notable: data.notable ?? false,
    };
    await onSubmit(formData);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Application" : "New DOB Application"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the application details."
              : "Create a new DOB permit application."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="job_number">Job Number</Label>
              <Input
                id="job_number"
                placeholder="421639356"
                {...form.register("job_number")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="application_type">Application Type</Label>
              <Select
                value={form.watch("application_type") || ""}
                onValueChange={(value) => form.setValue("application_type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Brief description of the work"
              {...form.register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.watch("status") || "draft"}
                onValueChange={(value) => form.setValue("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assigned_pm_id">Assigned PM</Label>
              <Select
                value={form.watch("assigned_pm_id") || ""}
                onValueChange={(value) => form.setValue("assigned_pm_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign to..." />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filed_date">Filed Date</Label>
              <Input
                id="filed_date"
                type="date"
                {...form.register("filed_date")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimated_value">Estimated Value ($)</Label>
              <Input
                id="estimated_value"
                type="number"
                placeholder="50000"
                {...form.register("estimated_value")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes..."
              rows={3}
              {...form.register("notes")}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="notable"
              checked={form.watch("notable")}
              onCheckedChange={(checked) => form.setValue("notable", checked === true)}
            />
            <Label htmlFor="notable" className="flex items-center gap-1.5 text-sm font-medium cursor-pointer">
              <Star className="h-4 w-4 text-amber-500" />
              Notable Project — include in RFP Content Library
            </Label>
          </div>

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
                "Create Application"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
