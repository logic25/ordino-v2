import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useCreateBillingSchedule } from "@/hooks/useBillingSchedules";
import { useClientContacts } from "@/hooks/useClients";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface BillingScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function useProjectServices(projectId: string | null) {
  return useQuery({
    queryKey: ["project-services", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, total_amount, fixed_price")
        .eq("project_id", projectId!);
      if (error) throw error;
      return data || [];
    },
  });
}

export function BillingScheduleDialog({ open, onOpenChange }: BillingScheduleDialogProps) {
  const [projectId, setProjectId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [billingMethod, setBillingMethod] = useState("amount");
  const [billingValue, setBillingValue] = useState(0);
  const [frequency, setFrequency] = useState("monthly");
  const [nextBillDate, setNextBillDate] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [contactId, setContactId] = useState("");

  const { data: projects } = useProjects();
  const { data: services = [] } = useProjectServices(projectId || null);
  const selectedProject = projects?.find((p) => p.id === projectId);
  const { data: contacts } = useClientContacts(selectedProject?.client_id);
  const createSchedule = useCreateBillingSchedule();

  useEffect(() => {
    setServiceId("");
    setServiceName("");
    setContactId("");
  }, [projectId]);

  useEffect(() => {
    const svc = services.find((s: any) => s.id === serviceId);
    if (svc) setServiceName((svc as any).name);
  }, [serviceId, services]);

  const handleSubmit = async () => {
    if (!projectId || !serviceName || !nextBillDate || billingValue <= 0) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    try {
      await createSchedule.mutateAsync({
        project_id: projectId,
        service_id: serviceId || null,
        service_name: serviceName,
        billing_method: billingMethod,
        billing_value: billingValue,
        billed_to_contact_id: contactId || null,
        frequency,
        next_bill_date: nextBillDate,
        auto_approve: autoApprove,
      });
      toast({ title: "Billing schedule created" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Recurring Billing Schedule</DialogTitle>
          <DialogDescription>Set up automatic recurring billing for a service</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {(projects || []).filter((p) => p.status === "open").map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.project_number || "—"} – {p.name || "Untitled"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Service</Label>
            {services.length > 0 ? (
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {services.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="Service name" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Billing Method</Label>
              <Select value={billingMethod} onValueChange={setBillingMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Fixed Amount ($)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{billingMethod === "percentage" ? "Percentage" : "Amount"}</Label>
              <Input type="number" min={0} step={billingMethod === "percentage" ? 1 : 0.01} value={billingValue} onChange={(e) => setBillingValue(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>First Bill Date</Label>
              <Input type="date" value={nextBillDate} onChange={(e) => setNextBillDate(e.target.value)} />
            </div>
          </div>

          {contacts && contacts.length > 0 && (
            <div className="space-y-2">
              <Label>Bill To Contact</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.is_primary ? " (Primary)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Auto-approve</Label>
              <p className="text-xs text-muted-foreground">Skip review — auto-create invoice as "ready to send"</p>
            </div>
            <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createSchedule.isPending}>
            {createSchedule.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
