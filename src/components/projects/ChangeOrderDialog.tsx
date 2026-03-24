import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, GitBranch, Search, X, Plus } from "lucide-react";
import type { ChangeOrder, ChangeOrderFormInput } from "@/hooks/useChangeOrders";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useCompanySettings, WORK_TYPE_DISCIPLINES, type ServiceCatalogItem } from "@/hooks/useCompanySettings";
import { formatCurrency } from "@/lib/utils";

interface COServiceLine {
  id: string;
  name: string;
  baseAmount: number;
  amount: number;
  description?: string;
  work_types?: string[];
  showWorkTypes?: boolean;
  disciplineFee?: number;
  hasDisciplinePricing?: boolean;
}

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  reason: z.string().optional(),
  requested_by: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ChangeOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ChangeOrderFormInput, asDraft: boolean) => Promise<void>;
  isLoading?: boolean;
  existingCO?: ChangeOrder | null;
  serviceNames?: string[];
}

export function ChangeOrderDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  existingCO,
}: ChangeOrderDialogProps) {
  const { track } = useTelemetry();
  const { data: companySettings } = useCompanySettings();
  const catalog: ServiceCatalogItem[] = companySettings?.settings?.service_catalog || [];
  const customWorkTypes: string[] = companySettings?.settings?.custom_work_types || [];
  const allDisciplines = useMemo(() => {
    const base = [...WORK_TYPE_DISCIPLINES] as string[];
    for (const cw of customWorkTypes) {
      if (!base.includes(cw)) base.push(cw);
    }
    return base;
  }, [customWorkTypes]);

  const [serviceLines, setServiceLines] = useState<COServiceLine[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [depositPct, setDepositPct] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", reason: "", requested_by: "", notes: "" },
  });

  useEffect(() => {
    if (open) {
      if (existingCO) {
        form.reset({
          title: existingCO.title,
          reason: existingCO.reason ?? "",
          requested_by: existingCO.requested_by ?? "",
          notes: existingCO.notes ?? "",
        });
        const storedItems = (existingCO as any).line_items;
        if (Array.isArray(storedItems) && storedItems.length > 0) {
          setServiceLines(storedItems.map((item: any, i: number) => {
            const catalogMatch = catalog.find(c => c.name === item.name);
            const dFee = catalogMatch?.discipline_fee || 0;
            const wt = item.work_types || [];
            const base = item.amount - (dFee * wt.length);
            return {
              id: `existing-${i}`,
              name: item.name,
              baseAmount: base > 0 ? base : item.amount || 0,
              amount: item.amount || 0,
              description: item.description || "",
              work_types: wt,
              showWorkTypes: catalogMatch?.show_work_types !== false,
              disciplineFee: dFee,
              hasDisciplinePricing: catalogMatch?.has_discipline_pricing || false,
            };
          }));
        } else {
          const names = existingCO.linked_service_names || [];
          if (names.length > 0) {
            const perService = existingCO.amount / names.length;
            setServiceLines(names.map((n, i) => {
              const catalogMatch = catalog.find(c => c.name === n);
              return { id: `existing-${i}`, name: n, baseAmount: perService, amount: perService, description: "", work_types: [], showWorkTypes: catalogMatch?.show_work_types !== false, disciplineFee: catalogMatch?.discipline_fee || 0, hasDisciplinePricing: catalogMatch?.has_discipline_pricing || false };
            }));
          } else {
            setServiceLines(existingCO.amount !== 0
              ? [{ id: "existing-0", name: existingCO.description || "Service", baseAmount: existingCO.amount, amount: existingCO.amount, showWorkTypes: false, disciplineFee: 0, hasDisciplinePricing: false }]
              : []);
          }
        }
        setDepositPct((existingCO as any).deposit_percentage || 0);
      } else {
        form.reset({ title: "", reason: "", requested_by: "", notes: "" });
        setServiceLines([]);
        setDepositPct(0);
      }
      setSearchTerm("");
    }
  }, [open, existingCO]);

  const requestedBy = form.watch("requested_by");
  const [searchFocused, setSearchFocused] = useState(true);
  const rawTotal = serviceLines.reduce((s, l) => s + Math.abs(l.amount), 0);
  const totalAmount = requestedBy === "Internal" ? -rawTotal : rawTotal;

  const filteredCatalog = useMemo(() => {
    if (!searchTerm.trim()) return catalog.slice(0, 20);
    const term = searchTerm.toLowerCase();
    return catalog.filter(s => s.name.toLowerCase().includes(term) || (s.description || "").toLowerCase().includes(term)).slice(0, 20);
  }, [catalog, searchTerm]);

  const addServiceFromCatalog = (svc: ServiceCatalogItem) => {
    const base = svc.default_price || 0;
    setServiceLines(prev => [...prev, {
      id: svc.id,
      name: svc.name,
      baseAmount: base,
      amount: base,
      description: svc.description,
      work_types: [],
      showWorkTypes: svc.show_work_types !== false,
      disciplineFee: svc.discipline_fee || 0,
      hasDisciplinePricing: svc.has_discipline_pricing || false,
    }]);
    setSearchTerm("");
  };

  const addCustomService = () => {
    setServiceLines(prev => [...prev, {
      id: `custom-${Date.now()}`,
      name: searchTerm.trim() || "Custom Service",
      baseAmount: 0,
      amount: 0,
      work_types: [],
      showWorkTypes: false,
      disciplineFee: 0,
      hasDisciplinePricing: false,
    }]);
    setSearchTerm("");
  };

  const removeService = (id: string) => {
    setServiceLines(prev => prev.filter(l => l.id !== id));
  };

  const updateServiceAmount = (id: string, val: string) => {
    const num = parseFloat(val.replace(/[^0-9.-]/g, "")) || 0;
    setServiceLines(prev => prev.map(l => l.id === id ? { ...l, amount: num } : l));
  };

  const updateServiceDescription = (id: string, val: string) => {
    setServiceLines(prev => prev.map(l => l.id === id ? { ...l, description: val } : l));
  };

  const toggleWorkType = (lineId: string, discipline: string) => {
    setServiceLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const current = l.work_types || [];
      const next = current.includes(discipline)
        ? current.filter(d => d !== discipline)
        : [...current, discipline];
      return { ...l, work_types: next };
    }));
  };

  const handleSubmit = async (values: FormValues, asDraft: boolean) => {
    track("projects", "co_create_completed", { as_draft: asDraft, is_edit: !!existingCO });

    await onSubmit({
      title: values.title.trim(),
      description: serviceLines.map(s => s.name).join(", "),
      reason: values.reason?.trim() || undefined,
      amount: totalAmount,
      requested_by: values.requested_by || undefined,
      linked_service_names: serviceLines.map(s => s.name),
      line_items: serviceLines.map(s => ({
        name: s.name,
        amount: s.amount,
        description: s.description,
        work_types: s.work_types?.length ? s.work_types : undefined,
      })),
      notes: values.notes || undefined,
      deposit_percentage: depositPct,
    }, asDraft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            {existingCO ? `Edit ${existingCO.co_number}` : "Create Change Order"}
          </DialogTitle>
          <DialogDescription>
            {existingCO
              ? "Update the details for this change order."
              : "Document a scope change. The CO number is assigned automatically."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="co-title">Title *</Label>
            <Input
              id="co-title"
              placeholder="e.g. Additional Filing Services"
              className="text-sm"
              {...form.register("title")}
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Reason for Change */}
          <div className="space-y-1.5">
            <Label htmlFor="co-reason">Reason for Change</Label>
            <Textarea
              id="co-reason"
              placeholder="e.g. PAA to address Schedule B — additional engineering review required"
              className="min-h-[60px] text-sm"
              {...form.register("reason")}
            />
          </div>

          {/* Services Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Services *</Label>
              <span className={`text-sm font-semibold tabular-nums ${totalAmount < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                Total: {totalAmount < 0 ? `-${formatCurrency(Math.abs(totalAmount))}` : formatCurrency(totalAmount)}
                {requestedBy === "Internal" && rawTotal > 0 && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">(credit)</span>
                )}
              </span>
            </div>

            {/* Added services */}
            {serviceLines.length > 0 && (
              <div className="space-y-2">
                {serviceLines.map((line) => (
                  <div key={line.id} className="flex flex-col gap-1.5 p-2.5 rounded-lg border bg-muted/20">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{line.name}</div>
                      </div>
                      <div className="w-28 shrink-0">
                        <Input
                          className="text-right text-sm h-8"
                          placeholder="$0"
                          value={line.amount !== 0 ? line.amount.toLocaleString("en-US") : ""}
                          onChange={(e) => updateServiceAmount(line.id, e.target.value)}
                        />
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => removeService(line.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      className="text-xs min-h-[28px] resize-none"
                      rows={2}
                      placeholder="Description (optional — does not alter master record)"
                      value={line.description || ""}
                      onChange={(e) => updateServiceDescription(line.id, e.target.value)}
                    />
                    {/* Work Type Picker */}
                    {line.showWorkTypes && (
                      <div className="pt-1">
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Work Types</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {allDisciplines.map((d) => {
                            const selected = (line.work_types || []).includes(d);
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => toggleWorkType(line.id, d)}
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                                  selected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                                }`}
                              >
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Always-visible service search */}
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Search service catalog or type custom name..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                />
                {searchTerm && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSearchTerm("")}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {(searchFocused || searchTerm) && (
                <div className="max-h-48 overflow-y-auto divide-y">
                  {filteredCatalog.map((svc) => (
                    <button
                      key={svc.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                      onClick={() => addServiceFromCatalog(svc)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{svc.name}</span>
                        {svc.default_price != null && (
                          <span className="text-xs text-muted-foreground">{formatCurrency(svc.default_price)}</span>
                        )}
                      </div>
                      {svc.description && (
                        <div className="text-xs text-muted-foreground truncate">{svc.description}</div>
                      )}
                    </button>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <div className="px-3 py-3 text-center text-sm text-muted-foreground">No matching services</div>
                  )}
                  {searchTerm.trim() && (
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm text-primary flex items-center gap-1.5"
                      onClick={addCustomService}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add "{searchTerm.trim()}" as custom service
                    </button>
                  )}
                </div>
              )}
            </div>

            {serviceLines.length === 0 && (
              <p className="text-xs text-muted-foreground">Add at least one service to define the CO scope and amount.</p>
            )}
          </div>

          {/* Requested By */}
          <div className="space-y-1.5">
            <Label htmlFor="co-requested-by">Requested By</Label>
            <Select
              value={form.watch("requested_by") || ""}
              onValueChange={(v) => form.setValue("requested_by", v)}
            >
              <SelectTrigger id="co-requested-by">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Client">Client</SelectItem>
                <SelectItem value="Internal">Internal</SelectItem>
                <SelectItem value="GC">General Contractor</SelectItem>
                <SelectItem value="Architect">Architect</SelectItem>
                <SelectItem value="Engineer">Engineer</SelectItem>
                <SelectItem value="DOB">DOB / Agency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Deposit */}
          <div className="space-y-1.5">
            <Label htmlFor="co-deposit">Deposit Required (%)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="co-deposit"
                type="number"
                min={0}
                max={100}
                className="w-28 text-sm"
                placeholder="0"
                value={depositPct || ""}
                onChange={(e) => setDepositPct(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
              />
              {depositPct > 0 && rawTotal > 0 && (
                <span className="text-sm text-muted-foreground">
                  Deposit: {formatCurrency(Math.abs(totalAmount) * depositPct / 100)} of {formatCurrency(Math.abs(totalAmount))}
                </span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="co-notes">Internal Notes</Label>
            <Textarea
              id="co-notes"
              placeholder="Any internal notes for this CO..."
              className="min-h-[56px] text-sm"
              {...form.register("notes")}
            />
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={form.handleSubmit((v) => handleSubmit(v, true))}
          >
            Save as Draft
          </Button>
          <Button
            type="button"
            disabled={isLoading || serviceLines.length === 0}
            onClick={form.handleSubmit((v) => handleSubmit(v, false))}
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : existingCO ? "Save Changes" : "Create CO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
