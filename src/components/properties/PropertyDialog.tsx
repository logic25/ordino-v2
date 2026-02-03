import { useEffect, useState } from "react";
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
import { Loader2, Search } from "lucide-react";
import type { Property, PropertyFormInput } from "@/hooks/useProperties";
import { useNYCPropertyLookup } from "@/hooks/useNYCPropertyLookup";
import { useToast } from "@/hooks/use-toast";

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
  { value: "Manhattan", label: "Manhattan" },
  { value: "Brooklyn", label: "Brooklyn" },
  { value: "Queens", label: "Queens" },
  { value: "Bronx", label: "Bronx" },
  { value: "Staten Island", label: "Staten Island" },
];

export function PropertyDialog({
  open,
  onOpenChange,
  onSubmit,
  property,
  isLoading,
}: PropertyDialogProps) {
  const isEditing = !!property;
  const { lookupByAddress, isLoading: isLookingUp } = useNYCPropertyLookup();
  const { toast } = useToast();
  const [addressToLookup, setAddressToLookup] = useState("");

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
      setAddressToLookup(property.address || "");
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
      setAddressToLookup("");
    }
  }, [property, form]);

  const handleAddressLookup = async () => {
    const address = form.getValues("address");
    if (!address || address.length < 5) {
      toast({
        title: "Enter an address",
        description: "Please enter a valid NYC address to look up.",
        variant: "destructive",
      });
      return;
    }

    const data = await lookupByAddress(address);
    if (data) {
      if (data.borough) form.setValue("borough", data.borough);
      if (data.block) form.setValue("block", data.block);
      if (data.lot) form.setValue("lot", data.lot);
      if (data.bin) form.setValue("bin", data.bin);
      if (data.zip_code) form.setValue("zip_code", data.zip_code);
      if (data.owner_name) form.setValue("owner_name", data.owner_name);
      
      toast({
        title: "Property found",
        description: "Property data has been filled in from NYC Open Data.",
      });
    } else {
      toast({
        title: "No data found",
        description: "Could not find property data for this address. Please enter details manually.",
        variant: "destructive",
      });
    }
  };

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
              : "Enter the address and click lookup to auto-fill NYC property data."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <div className="flex gap-2">
              <Input
                id="address"
                placeholder="350 Fifth Avenue, New York, NY"
                className="flex-1"
                {...form.register("address")}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddressLookup}
                disabled={isLookingUp}
              >
                {isLookingUp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-1" />
                    Lookup
                  </>
                )}
              </Button>
            </div>
            {form.formState.errors.address && (
              <p className="text-sm text-destructive">
                {form.formState.errors.address.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter a NYC address and click Lookup to auto-fill property details from NYC Open Data
            </p>
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
