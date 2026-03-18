import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { BillingRequestService } from "@/hooks/useBillingRequests";

interface ManualServiceEntryProps {
  services: BillingRequestService[];
  onUpdate: (idx: number, field: keyof BillingRequestService, value: string | number) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}

export function ManualServiceEntry({ services, onUpdate, onAdd, onRemove }: ManualServiceEntryProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>Completed Services</Label>
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Service
        </Button>
      </div>

      <div className="space-y-3">
        {services.map((service, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
            <div className="space-y-1">
              {idx === 0 && <Label className="text-xs text-muted-foreground">Service Name</Label>}
              <Input value={service.name} onChange={(e) => onUpdate(idx, "name", e.target.value)} placeholder="Service name" className="h-9" />
            </div>
            <div className="w-16 space-y-1">
              {idx === 0 && <Label className="text-xs text-muted-foreground">Qty</Label>}
              <Input type="number" min={1} value={service.quantity} onChange={(e) => onUpdate(idx, "quantity", Number(e.target.value))} className="h-9" />
            </div>
            <div className="w-24 space-y-1">
              {idx === 0 && <Label className="text-xs text-muted-foreground">Rate</Label>}
              <Input type="number" min={0} step="0.01" value={service.rate} onChange={(e) => onUpdate(idx, "rate", Number(e.target.value))} className="h-9" />
            </div>
            <div className="w-24 space-y-1">
              {idx === 0 && <Label className="text-xs text-muted-foreground">Amount</Label>}
              <Input readOnly value={`$${service.amount.toFixed(2)}`} className="h-9 bg-muted tabular-nums text-sm" />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" disabled={services.length <= 1} onClick={() => onRemove(idx)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
