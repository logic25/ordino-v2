import { useState, useEffect } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useEnrollProperty, useDeleteSignalSubscription, type SignalSubscription } from "@/hooks/useSignalSubscriptions";
import { useToast } from "@/hooks/use-toast";

interface SignalEnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyAddress: string;
  existing?: SignalSubscription | null;
}

export function SignalEnrollDialog({
  open,
  onOpenChange,
  propertyId,
  propertyAddress,
  existing,
}: SignalEnrollDialogProps) {
  const [status, setStatus] = useState(existing?.status || "prospect");
  const [ownerEmail, setOwnerEmail] = useState(existing?.owner_email || "");
  const [ownerPhone, setOwnerPhone] = useState(existing?.owner_phone || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const enroll = useEnrollProperty();
  const deleteSubscription = useDeleteSignalSubscription();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setStatus(existing?.status || "prospect");
      setOwnerEmail(existing?.owner_email || "");
      setOwnerPhone(existing?.owner_phone || "");
      setNotes(existing?.notes || "");
    }
  }, [open, existing]);

  const handleSubmit = async () => {
    try {
      await enroll.mutateAsync({
        property_id: propertyId,
        status,
        owner_email: ownerEmail || null,
        owner_phone: ownerPhone || null,
        notes: notes || null,
        subscribed_at: status === "active" || status === "trial" ? new Date().toISOString() : null,
      });
      toast({
        title: existing ? "CitiSignal subscription updated" : "Property enrolled in CitiSignal",
        description: `${propertyAddress} is now set to "${status}".`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Manage CitiSignal Subscription" : "Enroll in CitiSignal"}</DialogTitle>
          <DialogDescription>
            {propertyAddress}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Owner Email</Label>
            <Input
              type="email"
              placeholder="owner@example.com"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Owner Phone</Label>
            <Input
              type="tel"
              placeholder="(555) 555-5555"
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Sales notes, outreach status..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          {existing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deleteSubscription.isPending}>
                  {deleteSubscription.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Cancel Subscription
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel CitiSignal Subscription?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove CitiSignal monitoring for {propertyAddress}. 
                    You will lose access to real-time DOB tracking, violation alerts, and CO progress monitoring for this property.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      try {
                        await deleteSubscription.mutateAsync(existing.id);
                        toast({
                          title: "Subscription cancelled",
                          description: `CitiSignal monitoring removed for ${propertyAddress}.`,
                        });
                        onOpenChange(false);
                      } catch (error: any) {
                        toast({
                          title: "Error",
                          description: error.message || "Failed to cancel subscription.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    Cancel Subscription
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleSubmit} disabled={enroll.isPending}>
              {enroll.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {existing ? "Update" : "Enroll"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
