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
import { Loader2 } from "lucide-react";
import type { Client, ClientFormInput } from "@/hooks/useClients";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof clientSchema>;

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ClientFormInput) => Promise<void>;
  client?: Client | null;
  isLoading?: boolean;
}

export function ClientDialog({
  open,
  onOpenChange,
  onSubmit,
  client,
  isLoading,
}: ClientDialogProps) {
  const isEditing = !!client;

  const form = useForm<FormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        notes: client.notes || "",
      });
    } else {
      form.reset({
        name: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      });
    }
  }, [client, form]);

  const handleSubmit = async (data: FormData) => {
    await onSubmit({
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      notes: data.notes || null,
    });
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Client" : "New Client"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the client's information."
              : "Add a new client to your contact list."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Client or company name"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="client@example.com"
                {...form.register("email")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="(555) 123-4567"
                {...form.register("phone")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="Client address"
              {...form.register("address")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
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
              disabled={isLoading}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Update Client"
              ) : (
                "Create Client"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
