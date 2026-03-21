import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { SensorDescriptor, SensorOptions } from "@dnd-kit/core";
import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import { ServiceLineItem } from "./ServiceLineItem";
import { calculateLineTotal, type ProposalFormData } from "./proposalSchema";

interface ServicesStepProps {
  form: UseFormReturn<ProposalFormData>;
  itemFields: UseFieldArrayReturn<ProposalFormData, "items">["fields"];
  removeItem: (index: number) => void;
  watchedItems: ProposalFormData["items"];
  dndSensors: ReturnType<typeof import("@dnd-kit/core").useSensors>;
  handleDragEnd: (event: DragEndEvent) => void;
  serviceCatalog: any[];
  lastAddedIndex: number | null;
  workTypeDisciplines: readonly string[];
}

export function ServicesStep({
  form, itemFields, removeItem, watchedItems,
  dndSensors, handleDragEnd, serviceCatalog, lastAddedIndex,
  workTypeDisciplines,
}: ServicesStepProps) {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="grid grid-cols-[auto_auto_1fr_80px_70px_90px_80px_auto] items-center gap-1 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
        <div className="w-7" /><div className="w-7" />
        <div className="px-2">Service</div>
        <div>Type</div>
        <div className="text-center">Qty</div>
        <div className="text-right">Price</div>
        <div className="text-right pr-1">Total</div>
        <div className="w-7" />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={itemFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="border rounded-b-lg mx-4 mb-3">
              {itemFields.map((field, index) => (
                <ServiceLineItem
                  key={field.id} sortableId={field.id} index={index} form={form}
                  lineTotal={calculateLineTotal(watchedItems[index] || {})}
                  serviceCatalog={serviceCatalog}
                  canRemove={itemFields.length > 1} onRemove={() => removeItem(index)}
                  autoFocus={lastAddedIndex === index}
                  workTypeDisciplines={workTypeDisciplines}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
