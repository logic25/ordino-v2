import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";

interface ChecklistTemplate {
  id: string;
  label: string;
  required: boolean;
}

const DEFAULT_ITEMS: ChecklistTemplate[] = [
  { id: "ins", label: "Insurance certificate on file", required: true },
  { id: "sealed", label: "Sealed plans with job numbers", required: true },
  { id: "owner_auth", label: "Owner authorization letter", required: true },
  { id: "dob_reg", label: "All contacts registered on DOB NOW", required: true },
  { id: "acp5", label: "ACP5 / Asbestos investigation (if applicable)", required: false },
  { id: "dep_cert", label: "DEP Sewer Certification (if applicable)", required: false },
  { id: "cc_info", label: "Credit card info for DOB filing fees", required: true },
  { id: "scope_desc", label: "Scope of work description finalized", required: true },
  { id: "est_cost", label: "Estimated cost confirmed by client", required: false },
  { id: "restrictive", label: "Restrictive declaration (if required)", required: false },
];

export function FilingChecklistSettings() {
  const { toast } = useToast();
  const [items, setItems] = useState<ChecklistTemplate[]>(DEFAULT_ITEMS);
  const [newLabel, setNewLabel] = useState("");

  const addItem = () => {
    if (!newLabel.trim()) return;
    setItems((prev) => [
      ...prev,
      { id: `custom_${Date.now()}`, label: newLabel.trim(), required: false },
    ]);
    setNewLabel("");
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const toggleRequired = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, required: !i.required } : i))
    );
  };

  const handleSave = () => {
    toast({ title: "Checklist saved", description: `${items.length} items saved as company default.` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pre-Filing Checklist Defaults</CardTitle>
        <CardDescription>
          Configure the default checklist items that appear on every DOB NOW Filing Prep sheet. Individual projects can override these.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-3 py-2 rounded-md border bg-background group"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
              <span className="flex-1 text-sm">{item.label}</span>
              <button
                onClick={() => toggleRequired(item.id)}
                className="shrink-0"
              >
                <Badge
                  variant={item.required ? "default" : "secondary"}
                  className="text-[10px] px-1.5 py-0 cursor-pointer"
                >
                  {item.required ? "Required" : "Optional"}
                </Badge>
              </button>
              <button
                onClick={() => removeItem(item.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="New checklist item..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            className="h-9"
          />
          <Button size="sm" variant="outline" onClick={addItem} disabled={!newLabel.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>

        <Button className="gap-1.5" onClick={handleSave}>
          <Save className="h-3.5 w-3.5" /> Save Defaults
        </Button>
      </CardContent>
    </Card>
  );
}
