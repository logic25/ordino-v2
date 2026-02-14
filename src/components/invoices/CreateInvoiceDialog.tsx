import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { LineItemsEditor } from "./LineItemsEditor";
import { useCreateInvoice, type LineItem } from "@/hooks/useInvoices";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInvoiceDialog({ open, onOpenChange }: CreateInvoiceDialogProps) {
  const [projectId, setProjectId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [dueDate, setDueDate] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, rate: 0, amount: 0 },
  ]);

  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const createInvoice = useCreateInvoice();

  // Auto-fill client when project is selected
  useEffect(() => {
    if (projectId && projects) {
      const project = projects.find((p) => p.id === projectId);
      if (project?.client_id) {
        setClientId(project.client_id);
      }
    }
  }, [projectId, projects]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const totalDue = subtotal;

  const handleSubmit = async (status: "draft" | "ready_to_send") => {
    if (lineItems.every((i) => !i.description && i.amount === 0)) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }

    try {
      await createInvoice.mutateAsync({
        project_id: projectId || null,
        client_id: clientId || null,
        line_items: lineItems.filter((i) => i.description || i.amount > 0),
        subtotal,
        total_due: totalDue,
        status,
        payment_terms: paymentTerms,
        due_date: dueDate || null,
        special_instructions: specialInstructions || null,
      });
      toast({ title: `Invoice ${status === "draft" ? "saved as draft" : "marked ready to send"}` });
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Error creating invoice", description: err.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setProjectId("");
    setClientId("");
    setPaymentTerms("Net 30");
    setDueDate("");
    setSpecialInstructions("");
    setLineItems([{ description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>Create a new invoice for a project or client</DialogDescription>
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
                  {(projects || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.project_number || "—"} - {p.name || "Untitled"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {(clients || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div>
            <Label className="mb-2 block">Line Items</Label>
            <LineItemsEditor items={lineItems} onChange={setLineItems} />
          </div>

          <Separator />

          <div className="flex justify-end">
            <div className="text-right space-y-1">
              <div className="text-sm text-muted-foreground">
                Subtotal: <span className="font-mono font-medium text-foreground">${subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="text-lg font-bold">
                Total Due: <span className="font-mono">${totalDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Terms</Label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                  <SelectItem value="Net 15">Net 15</SelectItem>
                  <SelectItem value="Net 30">Net 30</SelectItem>
                  <SelectItem value="Net 60">Net 60</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Special Instructions</Label>
            <Textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Any special instructions for this invoice..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit("draft")}
            disabled={createInvoice.isPending}
          >
            {createInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Draft
          </Button>
          <Button
            onClick={() => handleSubmit("ready_to_send")}
            disabled={createInvoice.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {createInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Ready to Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
