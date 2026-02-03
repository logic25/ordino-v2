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
import { Loader2 } from "lucide-react";
import type { Property, PropertyFormInput } from "@/hooks/useProperties";

const propertySchema = z.object({
  address: z.string().min(5, "Address must be at least 5 characters"),
  borough: z.string().optional().transform(v => v || null),
  block: z.string().optional().transform(v => v || null),
  lot: z.string().optional().transform(v => v || null),
  bin: z.string().optional().transform(v => v || null),
  zip_code: z.string().optional().transform(v => v || null),
  owner_name: z.string().optional().transform(v => v || null),
  owner_contact: z.string().optional().transform(v => v || null),
  notes: z.string().optional().transform(v => v || null),
});

export type PropertyFormData = PropertyFormInput;

interface PropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PropertyFormData) => Promise<void>;
  property?: Property | null;
  isLoading?: boolean;
}

const boroughs = [
  { value: "MANHATTAN", label: "Manhattan" },
  { value: "BROOKLYN", label: "Brooklyn" },
  { value: "QUEENS", label: "Queens" },
  { value: "BRONX", label: "Bronx" },
  { value: "STATEN_ISLAND", label: "Staten Island" },
];

export function PropertyDialog({
  open,
  onOpenChange,
  onSubmit,
  property,
  isLoading,
}: PropertyDialogProps) {
  const isEditing = !!property;

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      address: "",
      borough: "",
      block: "",
      lot: "",
      bin: "",
      zip_code: "",
      owner_name: "",
      owner_contact: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (property) {
      form.reset({
        address: property.address || "",
        borough: property.borough || "",
        block: property.block || "",
        lot: property.lot || "",
        bin: property.bin || "",
        zip_code: property.zip_code || "",
        owner_name: property.owner_name || "",
        owner_contact: property.owner_contact || "",
        notes: property.notes || "",
      });
    } else {
      form.reset({
        address: "",
        borough: "",
        block: "",
        lot: "",
        bin: "",
        zip_code: "",
        owner_name: "",
        owner_contact: "",
        notes: "",
      });
    }
  }, [property, form]);

  const handleSubmit = async (data: PropertyFormData) => {
    await onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Property" : "Add New Property"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the property details below."
              : "Enter the property details to add it to your portfolio."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              placeholder="123 Main Street, New York, NY"
              {...form.register("address")}
            />
            {form.formState.errors.address && (
              <p className="text-sm text-destructive">
                {form.formState.errors.address.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="borough">Borough</Label>
              <Select
                value={form.watch("borough") || ""}
                onValueChange={(value) => form.setValue("borough", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select borough" />
                </SelectTrigger>
                <SelectContent>
                  {boroughs.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip_code">Zip Code</Label>
              <Input
                id="zip_code"
                placeholder="10001"
                {...form.register("zip_code")}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="block">Block</Label>
              <Input id="block" placeholder="1234" {...form.register("block")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lot">Lot</Label>
              <Input id="lot" placeholder="56" {...form.register("lot")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bin">BIN</Label>
              <Input
                id="bin"
                placeholder="1234567"
                {...form.register("bin")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="owner_name">Owner Name</Label>
              <Input
                id="owner_name"
                placeholder="John Smith"
                {...form.register("owner_name")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_contact">Owner Contact</Label>
              <Input
                id="owner_contact"
                placeholder="john@example.com"
                {...form.register("owner_contact")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this property..."
              rows={3}
              {...form.register("notes")}
            />
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
                "Add Property"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
