import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useProjects, type ProjectWithRelations } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useCreateBillingRequest, type BillingRequestService } from "@/hooks/useBillingRequests";
import { toast } from "@/hooks/use-toast";

interface SendToBillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedProjectId?: string;
}

export function SendToBillingDialog({ open, onOpenChange, preselectedProjectId }: SendToBillingDialogProps) {
  const [projectId, setProjectId] = useState(preselectedProjectId || "");
  const [services, setServices] = useState<BillingRequestService[]>([
    { name: "", description: "", quantity: 1, rate: 0, amount: 0 },
  ]);

  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const createBillingRequest = useCreateBillingRequest();

  useEffect(() => {
    if (preselectedProjectId) setProjectId(preselectedProjectId);
  }, [preselectedProjectId]);

  const selectedProject = projects?.find((p) => p.id === projectId);
  const selectedClient = clients?.find((c) => c.id === selectedProject?.client_id);

  const updateService = (idx: number, field: keyof BillingRequestService, value: string | number) => {
    setServices((prev) => {
      const updated = [...prev];
      (updated[idx] as any)[field] = value;
      if (field === "quantity" || field === "rate") {
        updated[idx].amount = Number(updated[idx].quantity) * Number(updated[idx].rate);
      }
      return updated;
    });
  };

  const addService = () => {
    setServices((prev) => [...prev, { name: "", description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeService = (idx: number) => {
    if (services.length <= 1) return;
    setServices((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalAmount = services.reduce((sum, s) => sum + s.amount, 0);

  const handleSubmit = async () => {
    if (!projectId) {
      toast({ title: "Select a project", variant: "destructive" });
      return;
    }
    if (services.every((s) => !s.name && s.amount === 0)) {
      toast({ title: "Add at least one service", variant: "destructive" });
      return;
    }

    try {
      await createBillingRequest.mutateAsync({
        project_id: projectId,
        client_id: selectedProject?.client_id,
        services: services.filter((s) => s.name || s.amount > 0),
        total_amount: totalAmount,
      });
      toast({ title: "Billing request submitted & invoice created" });
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    if (!preselectedProjectId) setProjectId("");
    setServices([{ name: "", description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send to Billing</DialogTitle>
          <DialogDescription>
            Submit completed services for invoicing. An invoice will be auto-created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {(projects || []).filter((p) => p.status === "open").map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.project_number || "—"} - {p.name || "Untitled"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Input
                readOnly
                value={selectedClient?.name || "Auto-filled from project"}
                className="bg-muted"
              />
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Completed Services</Label>
              <Button variant="ghost" size="sm" onClick={addService}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Service
              </Button>
            </div>

            <div className="space-y-3">
              {services.map((service, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
                  <div className="space-y-1">
                    {idx === 0 && <Label className="text-xs text-muted-foreground">Service Name</Label>}
                    <Input
                      value={service.name}
                      onChange={(e) => updateService(idx, "name", e.target.value)}
                      placeholder="Service name"
                      className="h-9"
                    />
                  </div>
                  <div className="w-16 space-y-1">
                    {idx === 0 && <Label className="text-xs text-muted-foreground">Qty</Label>}
                    <Input
                      type="number"
                      min={1}
                      value={service.quantity}
                      onChange={(e) => updateService(idx, "quantity", Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    {idx === 0 && <Label className="text-xs text-muted-foreground">Rate</Label>}
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={service.rate}
                      onChange={(e) => updateService(idx, "rate", Number(e.target.value))}
                      className="h-9"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    {idx === 0 && <Label className="text-xs text-muted-foreground">Amount</Label>}
                    <Input
                      readOnly
                      value={`$${service.amount.toFixed(2)}`}
                      className="h-9 bg-muted font-mono text-sm"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={services.length <= 1}
                    onClick={() => removeService(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-xl font-bold font-mono">
                ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createBillingRequest.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {createBillingRequest.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit & Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
