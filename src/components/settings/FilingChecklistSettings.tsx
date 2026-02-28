import { useState } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSensors, useSensor, PointerSensor } from "@dnd-kit/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Save, Pencil, Check, X } from "lucide-react";

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

function SortableChecklistItem({
  item,
  editingId,
  editingLabel,
  setEditingId,
  setEditingLabel,
  onSaveEdit,
  onToggleRequired,
  onRemove,
}: {
  item: ChecklistTemplate;
  editingId: string | null;
  editingLabel: string;
  setEditingId: (id: string | null) => void;
  setEditingLabel: (label: string) => void;
  onSaveEdit: (id: string, label: string) => void;
  onToggleRequired: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-2 rounded-md border bg-background group"
    >
      <div className="cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
      </div>
      {editingId === item.id ? (
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={editingLabel}
            onChange={(e) => setEditingLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onSaveEdit(item.id, editingLabel); setEditingId(null); }
              if (e.key === "Escape") setEditingId(null);
            }}
            className="h-7 text-sm"
            autoFocus
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-emerald-600" onClick={() => { onSaveEdit(item.id, editingLabel); setEditingId(null); }}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={() => setEditingId(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <span className="flex-1 text-sm cursor-pointer hover:text-primary transition-colors" onDoubleClick={() => { setEditingId(item.id); setEditingLabel(item.label); }}>
          {item.label}
        </span>
      )}
      {editingId !== item.id && (
        <>
          <button onClick={() => { setEditingId(item.id); setEditingLabel(item.label); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onToggleRequired(item.id)} className="shrink-0">
            <Badge variant={item.required ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 cursor-pointer">
              {item.required ? "Required" : "Optional"}
            </Badge>
          </button>
          <button onClick={() => onRemove(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

export function FilingChecklistSettings() {
  const { toast } = useToast();
  const [items, setItems] = useState<ChecklistTemplate[]>(DEFAULT_ITEMS);
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const addItem = () => {
    if (!newLabel.trim()) return;
    setItems((prev) => [...prev, { id: `custom_${Date.now()}`, label: newLabel.trim(), required: false }]);
    setNewLabel("");
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const toggleRequired = (id: string) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, required: !i.required } : i)));

  const saveEdit = (id: string, label: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, label: label.trim() || i.label } : i)));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item) => (
                <SortableChecklistItem
                  key={item.id}
                  item={item}
                  editingId={editingId}
                  editingLabel={editingLabel}
                  setEditingId={setEditingId}
                  setEditingLabel={setEditingLabel}
                  onSaveEdit={saveEdit}
                  onToggleRequired={toggleRequired}
                  onRemove={removeItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

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
