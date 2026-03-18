import React, { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FEE_TYPES, formatCurrency } from "./proposalSchema";
import type { ServiceCatalogItem, WORK_TYPE_DISCIPLINES } from "@/hooks/useCompanySettings";

// Re-export for convenience — the parent needs the disciplines constant
export { WORK_TYPE_DISCIPLINES } from "@/hooks/useCompanySettings";

interface ServiceLineItemProps {
  index: number;
  form: any;
  lineTotal: number;
  serviceCatalog: ServiceCatalogItem[];
  canRemove: boolean;
  onRemove: () => void;
  autoFocus?: boolean;
  sortableId: string;
  workTypeDisciplines: readonly string[];
}

export function ServiceLineItem({
  index, form, lineTotal, serviceCatalog, canRemove, onRemove, autoFocus, sortableId, workTypeDisciplines,
}: ServiceLineItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortableId });
  const hasDisciplines = Number(form.watch(`items.${index}.discipline_fee`)) > 0 ||
    serviceCatalog.find(s => s.name === (form.watch(`items.${index}.name`) || ""))?.has_discipline_pricing;
  const [expanded, setExpanded] = useState(!!autoFocus || !!hasDisciplines);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const suggestionsRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) {
      setExpanded(true);
      setTimeout(() => nameInputRef.current?.focus(), 80);
    }
  }, [autoFocus]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          nameInputRef.current && !nameInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentName = form.watch(`items.${index}.name`) || "";
  const currentDesc = form.watch(`items.${index}.description`) || "";
  const currentFeeType = form.watch(`items.${index}.fee_type`) || "fixed";
  const currentDiscount = Number(form.watch(`items.${index}.discount_percent`)) || 0;
  const isOptional = form.watch(`items.${index}.is_optional`) || false;

  const filtered = serviceCatalog.filter((s) =>
    s.name.toLowerCase().includes(currentName.toLowerCase())
  );

  const handleSelectService = (service: ServiceCatalogItem) => {
    const opts = { shouldDirty: true, shouldValidate: false };
    form.setValue(`items.${index}.name`, service.name, opts);
    form.setValue(`items.${index}.description`, (service.description || "").replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(), opts);
    form.setValue(`items.${index}.unit_price`, service.default_price || 0, opts);
    form.setValue(`items.${index}.estimated_hours`, service.default_hours || 0, opts);
    form.setValue(`items.${index}.fee_type`, service.default_fee_type || "fixed", opts);
    form.setValue(`items.${index}.needs_dob_filing`, service.needs_dob_filing || false, opts);
    if (service.has_discipline_pricing) {
      form.setValue(`items.${index}.discipline_fee`, service.discipline_fee || 0, opts);
      form.setValue(`items.${index}.disciplines`, [], opts);
      setExpanded(true);
    } else {
      form.setValue(`items.${index}.discipline_fee`, 0, opts);
      form.setValue(`items.${index}.disciplines`, [], opts);
      setExpanded(false);
    }
    setShowSuggestions(false);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("border-b last:border-b-0 transition-colors", expanded && "bg-muted/20", isOptional && "opacity-70 border-l-2 border-l-muted-foreground/30", isDragging && "shadow-lg")}>
      <div className="grid grid-cols-[auto_auto_1fr_80px_70px_90px_80px_auto] items-center gap-1 px-3 py-2 min-h-[44px]">
        <button type="button" {...attributes} {...listeners} className="p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="p-1 rounded hover:bg-muted transition-colors" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        <div className="min-w-0">
          <div className="relative">
            <Input
              ref={nameInputRef}
              placeholder="Type service name…"
              className="h-8 text-sm font-medium border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring px-2 bg-transparent relative z-[1]"
              value={currentName}
              onChange={(e) => {
                form.setValue(`items.${index}.name`, e.target.value);
                setShowSuggestions(e.target.value.length > 0 && serviceCatalog.length > 0);
              }}
              onFocus={() => { if (serviceCatalog.length > 0) setShowSuggestions(true); }}
            />
            {showSuggestions && filtered.length > 0 && (
              <div ref={suggestionsRef} className="absolute left-0 top-full z-[9999] w-[340px] bg-popover border rounded-md shadow-xl mt-1 max-h-[200px] overflow-y-auto">
                {filtered.map((service) => (
                  <button key={service.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex justify-between items-center border-b last:border-0"
                    onMouseDown={(e) => { e.preventDefault(); handleSelectService(service); }}>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{service.name}</div>
                      {service.description && <div className="text-xs text-muted-foreground truncate">{service.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}</div>}
                    </div>
                    {service.default_price ? <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatCurrency(service.default_price)}</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!expanded && (
            <p className="text-xs text-muted-foreground truncate px-2 mt-0.5">
              {isOptional && <span className="text-accent font-medium mr-1">Optional ·</span>}
              {(form.watch(`items.${index}.disciplines`) || []).length > 0 && (
                <span className="font-medium mr-1">{(form.watch(`items.${index}.disciplines`) || []).length} work types ·</span>
              )}
              {currentDesc}
            </p>
          )}
        </div>

        <Select value={currentFeeType} onValueChange={(v) => form.setValue(`items.${index}.fee_type`, v)}>
          <SelectTrigger className="h-8 text-xs border-0 shadow-none focus:ring-1 focus:ring-ring px-1.5 bg-transparent"><SelectValue /></SelectTrigger>
          <SelectContent>{FEE_TYPES.map((ft) => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}</SelectContent>
        </Select>

        <Input type="number" min="0" step="1" className="h-8 text-sm text-center border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring px-1 bg-transparent" placeholder="Qty" {...form.register(`items.${index}.quantity`)} />
        <Input type="number" min="0" step="0.01" className="h-8 text-sm text-right border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring px-1 bg-transparent" placeholder="Price" {...form.register(`items.${index}.unit_price`)} />

        <span className="text-sm font-semibold text-right tabular-nums pr-1">
          {formatCurrency(lineTotal)}
          {currentDiscount > 0 && <span className="text-xs text-accent block">-{currentDiscount}%</span>}
        </span>

        {canRemove ? (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-50 hover:opacity-100" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
        ) : <div className="w-7" />}
      </div>

      {expanded && (
        <div className="border-t bg-muted/30 px-4 py-3 ml-8 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Description / Scope</Label>
            <Textarea placeholder="Describe the scope of this service…" rows={2} className="text-sm" {...form.register(`items.${index}.description`)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs text-muted-foreground mb-1 block">Est. Hours</Label><Input type="number" min="0" step="0.5" className="h-8 text-sm" {...form.register(`items.${index}.estimated_hours`)} /></div>
            <div><Label className="text-xs text-muted-foreground mb-1 block">Discount %</Label><Input type="number" min="0" max="100" step="1" className="h-8 text-sm" {...form.register(`items.${index}.discount_percent`)} /></div>
            <div><Label className="text-xs text-muted-foreground mb-1 block">Line Total</Label><div className="h-8 flex items-center text-sm font-semibold">{formatCurrency(lineTotal)}</div></div>
          </div>

          <WorkTypesSection index={index} form={form} serviceCatalog={serviceCatalog} currentName={currentName} workTypeDisciplines={workTypeDisciplines} />

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <Checkbox
              checked={isOptional}
              onCheckedChange={(checked) => form.setValue(`items.${index}.is_optional`, !!checked)}
              className="h-3.5 w-3.5"
            />
            <span className="text-xs text-muted-foreground">Optional service — shown on proposal but not included in total</span>
          </label>
        </div>
      )}
    </div>
  );
}

function WorkTypesSection({ index, form, serviceCatalog, currentName, workTypeDisciplines }: {
  index: number; form: any; serviceCatalog: ServiceCatalogItem[]; currentName: string; workTypeDisciplines: readonly string[];
}) {
  const disciplineFee = Number(form.watch(`items.${index}.discipline_fee`)) || 0;
  const selectedDisciplines: string[] = form.watch(`items.${index}.disciplines`) || [];
  const catalogMatch = serviceCatalog.find(s => s.name === currentName);
  const hasDisciplinePricing = disciplineFee > 0 || catalogMatch?.has_discipline_pricing;
  const showWorkTypes = catalogMatch?.show_work_types ?? true;

  if (!showWorkTypes && !hasDisciplinePricing) return null;

  const toggleDiscipline = (d: string) => {
    const current = [...selectedDisciplines];
    const idx = current.indexOf(d);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(d);
    form.setValue(`items.${index}.disciplines`, current);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Work Types</Label>
        {selectedDisciplines.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {selectedDisciplines.length} selected{disciplineFee > 0 ? ` · ${formatCurrency(disciplineFee)}/work type` : ""}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {workTypeDisciplines.map((d) => (
          <label key={d} className="flex items-center gap-1.5 cursor-pointer text-xs py-1 px-2 rounded hover:bg-muted/50 transition-colors">
            <Checkbox checked={selectedDisciplines.includes(d)} onCheckedChange={() => toggleDiscipline(d)} className="h-3.5 w-3.5" />
            <span>{d}</span>
          </label>
        ))}
      </div>
      {selectedDisciplines.length > 0 && disciplineFee > 0 && (
        <p className="text-xs text-muted-foreground">
          Base {formatCurrency(Number(form.watch(`items.${index}.unit_price`)) || 0)} + {selectedDisciplines.length} × {formatCurrency(disciplineFee)} = {formatCurrency((Number(form.watch(`items.${index}.unit_price`)) || 0) + selectedDisciplines.length * disciplineFee)}
        </p>
      )}
    </div>
  );
}
