import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import type { LineItem } from "@/hooks/useInvoices";

interface LineItemsEditorProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  readOnly?: boolean;
}

export function LineItemsEditor({ items, onChange, readOnly = false }: LineItemsEditorProps) {
  const addItem = () => {
    onChange([...items, { description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const newItem = { ...item, [field]: value };
      if (field === "quantity" || field === "rate") {
        newItem.amount = Number(newItem.quantity) * Number(newItem.rate);
      }
      return newItem;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
        <span>Description</span>
        <span>Qty</span>
        <span>Rate</span>
        <span>Amount</span>
        <span></span>
      </div>
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-2 items-center">
          <Input
            value={item.description}
            onChange={(e) => updateItem(index, "description", e.target.value)}
            placeholder="Service description"
            disabled={readOnly}
            className="h-9 text-sm"
          />
          <Input
            type="number"
            value={item.quantity}
            onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
            disabled={readOnly}
            className="h-9 text-sm"
            min={1}
          />
          <Input
            type="number"
            value={item.rate}
            onChange={(e) => updateItem(index, "rate", Number(e.target.value))}
            disabled={readOnly}
            className="h-9 text-sm font-mono"
            min={0}
            step={0.01}
          />
          <div className="h-9 flex items-center text-sm font-mono px-2 bg-muted rounded-md">
            ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => removeItem(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={addItem} className="mt-2">
          <Plus className="h-4 w-4 mr-1" /> Add Line Item
        </Button>
      )}
    </div>
  );
}
