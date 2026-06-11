import { ReactNode } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Maximize2, Minimize2 } from "lucide-react";
import { useDashboardLayout, type WidgetWidth, ROLE_WIDGETS } from "@/hooks/useDashboardLayout";

interface Props {
  role: string;
  editMode?: boolean;
  widgets: Record<string, ReactNode>;
  /** optional override of order / visibility (defaults to per-user prefs) */
  order?: string[];
  onReorder?: (next: string[]) => void;
  isVisible?: (id: string) => boolean;
}

/**
 * Shared resizable dashboard grid used by every role view (Admin, Accounting,
 * Manager, PM). Wraps widgets in a DnD sortable grid with half/full-width toggles.
 */
export function ResizableDashboardGrid({
  role,
  editMode = false,
  widgets,
  order: orderProp,
  onReorder,
  isVisible,
}: Props) {
  const layout = useDashboardLayout(role);
  const effectiveOrder = orderProp ?? layout.order;
  const handleReorder = onReorder ?? layout.setOrder;
  const show = isVisible ?? layout.isVisible;
  const { widthOf, setWidth } = layout;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const widgetDefs = ROLE_WIDGETS[role] || [];
  const visibleOrdered = effectiveOrder.filter((id) => widgets[id] && show(id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = effectiveOrder.indexOf(active.id as string);
    const newIndex = effectiveOrder.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    handleReorder(arrayMove(effectiveOrder, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={visibleOrdered} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleOrdered.map((id) => {
            const def = widgetDefs.find((w) => w.id === id);
            const width = widthOf(id);
            const locked = !!def?.lockedFull;
            return (
              <SortableWidget
                key={id}
                id={id}
                editMode={editMode}
                width={width}
                locked={locked}
                onToggleWidth={() => setWidth(id, width === "full" ? "half" : "full")}
              >
                {widgets[id]}
              </SortableWidget>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableWidget({
  id, editMode, width, locked, onToggleWidth, children,
}: {
  id: string;
  editMode: boolean;
  width: WidgetWidth;
  locked: boolean;
  onToggleWidth: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !editMode });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const spanClass = width === "full" ? "md:col-span-2" : "md:col-span-1";

  return (
    <div ref={setNodeRef} style={style} className={`relative ${spanClass}`}>
      {editMode && (
        <>
          <button
            {...attributes}
            {...listeners}
            className="absolute -left-3 top-3 z-10 h-7 w-7 rounded-md bg-background border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          {!locked && (
            <button
              onClick={onToggleWidth}
              className="absolute -right-3 top-3 z-10 h-7 w-7 rounded-md bg-background border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={width === "full" ? "Make half width" : "Make full width"}
              title={width === "full" ? "Make half width" : "Make full width"}
            >
              {width === "full" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </>
      )}
      <div className={editMode ? "ring-2 ring-primary/20 rounded-lg" : ""}>
        {children}
      </div>
    </div>
  );
}
