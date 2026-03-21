import { Button } from "@/components/ui/button";
import { Edit2, Save, X } from "lucide-react";
import { LineItemsEditor } from "../LineItemsEditor";
import type { LineItem } from "@/hooks/useInvoices";

interface LineItemsSectionProps {
  lineItems: LineItem[];
  editing: boolean;
  editItems: LineItem[];
  onEditItemsChange: (items: LineItem[]) => void;
  canEdit: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  saving: boolean;
}

export function LineItemsSection({
  lineItems, editing, editItems, onEditItemsChange,
  canEdit, onStartEdit, onCancelEdit, onSaveEdit, saving,
}: LineItemsSectionProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-muted-foreground">Line Items</h4>
        {!editing && canEdit && (
          <Button variant="ghost" size="sm" onClick={onStartEdit}>
            <Edit2 className="h-3 w-3 mr-1" /> Edit
          </Button>
        )}
        {editing && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onCancelEdit}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={onSaveEdit} disabled={saving}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        )}
      </div>
      <LineItemsEditor items={editing ? editItems : lineItems} onChange={onEditItemsChange} readOnly={!editing} />
    </section>
  );
}
