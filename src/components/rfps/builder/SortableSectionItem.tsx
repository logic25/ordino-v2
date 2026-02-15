import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";

interface SortableSectionItemProps {
  id: string;
  label: string;
  icon: React.ElementType;
  count: number;
  isSelected: boolean;
  onToggle: () => void;
}

export function SortableSectionItem({ id, label, icon: Icon, count, isSelected, onToggle }: SortableSectionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isSelected ? 1 : 0.5,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`${isDragging ? "shadow-lg ring-2 ring-accent" : ""}`}>
        <CardContent className="py-3 flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <Checkbox checked={isSelected} onCheckedChange={onToggle} />
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm flex-1">{label}</span>
          <Badge variant={count > 0 ? "secondary" : "outline"} className="text-xs">
            {count} {count === 1 ? "item" : "items"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
