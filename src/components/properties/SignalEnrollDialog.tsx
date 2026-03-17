import { useState, useEffect, useMemo } from "react";
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
import { addDays, addYears, format } from "date-fns";

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
  const [status, setStatus] = useState(existing?.status || "prospect");
  const [ownerEmail, setOwnerEmail] = useState(existing?.owner_email || "");
  const [ownerPhone, setOwnerPhone] = useState(existing?.owner_phone || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [isComplimentary, setIsComplimentary] = useState(existing?.is_complimentary || false);
  const [linkedProjectId, setLinkedProjectId] = useState(existing?.linked_project_id || "");
  const [monthlyRate, setMonthlyRate] = useState(existing?.monthly_rate?.toString() || "");
  const [billingStartDate, setBillingStartDate] = useState(existing?.billing_start_date || "");
  const [compReason, setCompReason] = useState(existing?.comp_reason || "");

  const enroll = useEnrollProperty();
  const deleteSubscription = useDeleteSignalSubscription();
  const { toast } = useToast();
  const { data: projects = [] } = usePropertyProjects(propertyId);

  const hasActiveProjects = projects.length > 0;

  useEffect(() => {
    if (open) {
      setStatus(existing?.status || "prospect");
      setOwnerEmail(existing?.owner_email || "");
      setOwnerPhone(existing?.owner_phone || "");
      setNotes(existing?.notes || "");
      setIsComplimentary(existing?.is_complimentary || false);
      setLinkedProjectId(existing?.linked_project_id || "");
      setMonthlyRate(existing?.monthly_rate?.toString() || "");
      setBillingStartDate(existing?.billing_start_date || "");
      setCompReason(existing?.comp_reason || "");
    }
  }, [open, existing]);

  const computedExpiresAt = useMemo(() => {
    if (status === "trial") {
      return format(addDays(new Date(), 14), "yyyy-MM-dd");
    }
    if (isComplimentary && (status === "active" || status === "trial")) {
      return format(addYears(new Date(), 1), "yyyy-MM-dd");
    }
    return null;
  }, [status, isComplimentary]);

  const canSubmit = () => {
    return true;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;

    try {
      await enroll.mutateAsync({
        property_id: propertyId,
        status,
        owner_email: ownerEmail || null,
        owner_phone: ownerPhone || null,
        notes: notes || null,
        subscribed_at: status === "active" || status === "trial" ? new Date().toISOString() : null,
        expires_at: computedExpiresAt || (existing?.expires_at ?? null),
        is_complimentary: isComplimentary,
        linked_project_id: isComplimentary ? linkedProjectId || null : null,
        monthly_rate: !isComplimentary && status === "active" ? parseFloat(monthlyRate) || null : null,
        billing_start_date: !isComplimentary && status === "active" ? billingStartDate || null : null,
        comp_reason: isComplimentary ? compReason || null : null,
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Manage CitiSignal Subscription" : "Enroll in CitiSignal"}</DialogTitle>
          <DialogDescription>{propertyAddress}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Enrolled by (read-only on edit) */}
          {existing?.enrolled_by_name && (
            <div className="text-sm text-muted-foreground">
              Enrolled by: <span className="font-medium text-foreground">{existing.enrolled_by_name}</span>
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Trial auto-expiry notice */}
          {status === "trial" && computedExpiresAt && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
              Trial expires: <span className="font-medium">{format(new Date(computedExpiresAt), "MMM d, yyyy")}</span> (14 days)
            </div>
          )}

          {/* Complimentary toggle */}
          {(status === "active" || status === "trial") && (
            <div className="space-y-3 border rounded-md p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Complimentary</Label>
                  <p className="text-xs text-muted-foreground">Bundled with expediting — no charge</p>
                </div>
                <Switch
                  checked={isComplimentary}
                onCheckedChange={setIsComplimentary}
                />
              </div>
              {!hasActiveProjects && (
                <p className="text-xs text-muted-foreground">No projects for this property. You can link one later.</p>
              )}

              {isComplimentary && (
                <>
                  {/* Linked project selector (optional) */}
                  <div className="space-y-2">
                    <Label>Linked Project <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    {projects.length > 0 ? (
                      <Select value={linkedProjectId} onValueChange={setLinkedProjectId}>
                        <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
                        <SelectContent>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.project_number ? `${p.project_number} — ` : ""}{p.name || "Untitled"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">No projects for this property yet. You can link one later.</p>
                    )}
                    <p className="text-xs text-muted-foreground">Link when the property becomes tied to an expediting job.</p>
                  </div>

                  {/* Comp reason */}
                  <div className="space-y-2">
                    <Label>Justification</Label>
                    <Textarea
                      placeholder="Pre-sale monitoring, referral relationship, owner requested early monitoring..."
                      value={compReason}
                      onChange={(e) => setCompReason(e.target.value)}
                      rows={2}
                    />
                  </div>

                  {/* Auto-expiry notice */}
                  {computedExpiresAt && status === "active" && (
                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                      Comp expires: <span className="font-medium">{format(new Date(computedExpiresAt), "MMM d, yyyy")}</span> (1 year — forces review)
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Paid subscription fields */}
          {status === "active" && !isComplimentary && (
            <div className="space-y-3 border rounded-md p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Monthly Rate ($)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={monthlyRate}
                    onChange={(e) => setMonthlyRate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billing Start</Label>
                  <Input
                    type="date"
                    value={billingStartDate}
                    onChange={(e) => setBillingStartDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Owner contact */}
          <div className="space-y-2">
            <Label>Owner Email</Label>
            <Input type="email" placeholder="owner@example.com" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Owner Phone</Label>
            <Input type="tel" placeholder="(555) 555-5555" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea placeholder="Sales notes, outreach status..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
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
            <Button onClick={handleSubmit} disabled={enroll.isPending || !canSubmit()}>
              {enroll.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {existing ? "Update" : "Enroll"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
