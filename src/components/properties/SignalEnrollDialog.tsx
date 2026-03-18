import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEnrollFormState } from "./signal-enroll/useEnrollFormState";
import { CompSection } from "./signal-enroll/CompSection";
import { PaidSection } from "./signal-enroll/PaidSection";
import { OwnerContactSection } from "./signal-enroll/OwnerContactSection";

interface SignalEnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyAddress: string;
  existing?: SignalSubscription | null;
}

function usePropertyProjects(propertyId: string) {
  return useQuery({
    queryKey: ["property-projects", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, project_number, phase, status")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId,
  });
}

export function SignalEnrollDialog({
  open,
  onOpenChange,
  propertyId,
  propertyAddress,
  existing,
}: SignalEnrollDialogProps) {
  const { form, update, computedExpiresAt } = useEnrollFormState(open, existing);
  const enroll = useEnrollProperty();
  const deleteSubscription = useDeleteSignalSubscription();
  const { toast } = useToast();
  const { data: projects = [] } = usePropertyProjects(propertyId);
  const hasActiveProjects = projects.length > 0;

  const handleSubmit = async () => {
    try {
      await enroll.mutateAsync({
        property_id: propertyId,
        status: form.status,
        owner_email: form.ownerEmail || null,
        owner_phone: form.ownerPhone || null,
        notes: form.notes || null,
        subscribed_at: form.status === "active" || form.status === "trial" ? new Date().toISOString() : null,
        expires_at: computedExpiresAt || (existing?.expires_at ?? null),
        is_complimentary: form.isComplimentary,
        linked_project_id: form.isComplimentary ? form.linkedProjectId || null : null,
        monthly_rate: !form.isComplimentary && form.status === "active" ? parseFloat(form.monthlyRate) || null : null,
        billing_start_date: !form.isComplimentary && form.status === "active" ? form.billingStartDate || null : null,
        comp_reason: form.isComplimentary ? form.compReason || null : null,
      });
      toast({
        title: existing ? "CitiSignal subscription updated" : "Property enrolled in CitiSignal",
        description: `${propertyAddress} is now set to "${form.status}".`,
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Something went wrong.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Manage CitiSignal Subscription" : "Enroll in CitiSignal"}</DialogTitle>
          <DialogDescription>{propertyAddress}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {existing?.enrolled_by_name && (
            <div className="text-sm text-muted-foreground">
              Enrolled by: <span className="font-medium text-foreground">{existing.enrolled_by_name}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.status === "trial" && computedExpiresAt && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
              Trial expires: <span className="font-medium">{format(new Date(computedExpiresAt), "MMM d, yyyy")}</span> (14 days)
            </div>
          )}

          {(form.status === "active" || form.status === "trial") && (
            <div className="space-y-3 border rounded-md p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Complimentary</Label>
                  <p className="text-xs text-muted-foreground">Bundled with expediting — no charge</p>
                </div>
                <Switch checked={form.isComplimentary} onCheckedChange={(v) => update("isComplimentary", v)} />
              </div>
              {!hasActiveProjects && (
                <p className="text-xs text-muted-foreground">No projects for this property. You can link one later.</p>
              )}
              {form.isComplimentary && (
                <CompSection
                  linkedProjectId={form.linkedProjectId}
                  onLinkedProjectIdChange={(v) => update("linkedProjectId", v)}
                  compReason={form.compReason}
                  onCompReasonChange={(v) => update("compReason", v)}
                  projects={projects}
                  computedExpiresAt={computedExpiresAt}
                  status={form.status}
                />
              )}
            </div>
          )}

          {form.status === "active" && !form.isComplimentary && (
            <PaidSection
              monthlyRate={form.monthlyRate}
              onMonthlyRateChange={(v) => update("monthlyRate", v)}
              billingStartDate={form.billingStartDate}
              onBillingStartDateChange={(v) => update("billingStartDate", v)}
            />
          )}

          <OwnerContactSection
            ownerEmail={form.ownerEmail}
            onOwnerEmailChange={(v) => update("ownerEmail", v)}
            ownerPhone={form.ownerPhone}
            onOwnerPhoneChange={(v) => update("ownerPhone", v)}
            notes={form.notes}
            onNotesChange={(v) => update("notes", v)}
          />
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
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={async () => {
                      try {
                        await deleteSubscription.mutateAsync(existing.id);
                        toast({ title: "Subscription cancelled", description: `CitiSignal monitoring removed for ${propertyAddress}.` });
                        onOpenChange(false);
                      } catch (error: any) {
                        toast({ title: "Error", description: error.message || "Failed to cancel subscription.", variant: "destructive" });
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
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
