import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2, AlertTriangle, Info, DollarSign, Percent, Check, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useClients, useClientContacts } from "@/hooks/useClients";
import { useCreateBillingRequest, type BillingRequestService } from "@/hooks/useBillingRequests";
import { useClientBillingRulesByClient } from "@/hooks/useClientBillingRules";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SendToBillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedProjectId?: string;
  preselectedServiceIds?: Set<string>;
}

interface ProjectService {
  id: string;
  name: string;
  description: string | null;
  total_amount: number | null;
  fixed_price: number | null;
  billing_type: string | null;
  status: string | null;
}

interface SelectedService {
  serviceId: string;
  name: string;
  contractAmount: number;
  previouslyBilled: number;
  remaining: number;
  billingMode: "amount" | "percent";
  inputValue: number;
  billedAmount: number;
}

/** Fetch services linked to a project */
function useProjectServices(projectId: string | null) {
  return useQuery({
    queryKey: ["project-services", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, description, total_amount, fixed_price, billing_type, status")
        .eq("project_id", projectId!);
      if (error) throw error;
      return (data || []) as ProjectService[];
    },
  });
}

/** Fetch previously billed amounts per service for a project */
function usePreviouslyBilled(projectId: string | null) {
  return useQuery({
    queryKey: ["previously-billed", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_requests")
        .select("services, created_at, created_by, billed_to_contact_id")
        .eq("project_id", projectId!)
        .neq("status", "cancelled");
      if (error) throw error;

      // Sum billed amounts by service name + build detailed history
      const billedMap: Record<string, number> = {};
      const historyMap: Record<string, BillingHistoryEntry[]> = {};

      for (const req of data || []) {
        const items = (req.services as any[]) || [];
        for (const item of items) {
          const key = item.name || "";
          billedMap[key] = (billedMap[key] || 0) + (item.amount || item.billed_amount || 0);
          if (!historyMap[key]) historyMap[key] = [];
          historyMap[key].push({
            amount: item.amount || item.billed_amount || 0,
            billingMethod: item.billing_method || "full",
            billingValue: item.billing_value,
            date: req.created_at,
            createdBy: req.created_by,
            billedToContactId: req.billed_to_contact_id,
          });
        }
      }
      return { billedMap, historyMap };
    },
  });
}

interface BillingHistoryEntry {
  amount: number;
  billingMethod: string;
  billingValue?: number;
  date: string;
  createdBy: string | null;
  billedToContactId: string | null;
}

export function SendToBillingDialog({ open, onOpenChange, preselectedProjectId, preselectedServiceIds }: SendToBillingDialogProps) {
  const [projectId, setProjectId] = useState(preselectedProjectId || "");
  const [billedToContactId, setBilledToContactId] = useState("");
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  // Legacy manual lines for projects without services
  const [manualServices, setManualServices] = useState<BillingRequestService[]>([
    { name: "", description: "", quantity: 1, rate: 0, amount: 0 },
  ]);

  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const createBillingRequest = useCreateBillingRequest();
  const { data: projectServices = [] } = useProjectServices(projectId || null);
  const { data: prevBilledData } = usePreviouslyBilled(projectId || null);
  const previouslyBilled = prevBilledData?.billedMap || {};
  const billingHistory = prevBilledData?.historyMap || {};

  const selectedProject = projects?.find((p) => p.id === projectId);
  const selectedClient = clients?.find((c) => c.id === selectedProject?.client_id);

  const { data: contacts } = useClientContacts(selectedProject?.client_id);
  const { data: billingRules } = useClientBillingRulesByClient(selectedProject?.client_id);
  const activeRule = billingRules?.[0];

  const hasProjectServices = projectServices.length > 0;

  useEffect(() => {
    if (preselectedProjectId) setProjectId(preselectedProjectId);
  }, [preselectedProjectId]);

  // Reset selections when project changes
  useEffect(() => {
    setBilledToContactId("");
    setSelectedServices([]);
  }, [projectId]);

  // Auto-select primary contact when contacts load
  useEffect(() => {
    if (contacts && contacts.length > 0 && !billedToContactId) {
      const primary = contacts.find((c) => c.is_primary);
      setBilledToContactId(primary?.id || contacts[0].id);
    }
  }, [contacts]);

  // Auto-select services: if preselectedServiceIds provided, select those; otherwise if only 1 service, auto-select it
  useEffect(() => {
    if (!open || !hasProjectServices || selectedServices.length > 0) return;

    const toAutoSelect = preselectedServiceIds && preselectedServiceIds.size > 0
      ? projectServices.filter(s => preselectedServiceIds.has(s.id))
      : projectServices.length === 1
        ? [projectServices[0]]
        : [];

    if (toAutoSelect.length > 0) {
      setSelectedServices(toAutoSelect.map(svc => {
        const contractAmount = svc.total_amount || svc.fixed_price || 0;
        const prevBilled = previouslyBilled[svc.name] || 0;
        const remaining = Math.max(0, contractAmount - prevBilled);
        return {
          serviceId: svc.id,
          name: svc.name,
          contractAmount,
          previouslyBilled: prevBilled,
          remaining,
          billingMode: "amount" as const,
          inputValue: remaining,
          billedAmount: remaining,
        };
      }));
    }
  }, [open, projectServices, preselectedServiceIds, previouslyBilled]);

  const selectedContact = contacts?.find((c) => c.id === billedToContactId);

  // Toggle a project service selection
  const toggleService = (svc: ProjectService) => {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.serviceId === svc.id);
      if (exists) return prev.filter((s) => s.serviceId !== svc.id);

      const contractAmount = svc.total_amount || svc.fixed_price || 0;
      const prevBilled = previouslyBilled[svc.name] || 0;
      const remaining = Math.max(0, contractAmount - prevBilled);

      return [...prev, {
        serviceId: svc.id,
        name: svc.name,
        contractAmount,
        previouslyBilled: prevBilled,
        remaining,
        billingMode: "amount",
        inputValue: remaining,
        billedAmount: remaining,
      }];
    });
  };

  const updateSelectedService = (serviceId: string, field: "billingMode" | "inputValue", value: any) => {
    setSelectedServices((prev) =>
      prev.map((s) => {
        if (s.serviceId !== serviceId) return s;
        const updated = { ...s, [field]: value };
        if (field === "billingMode" || field === "inputValue") {
          if (updated.billingMode === "percent") {
            const pct = Math.min(100, Math.max(0, Number(updated.inputValue) || 0));
            updated.billedAmount = +(s.contractAmount * (pct / 100)).toFixed(2);
          } else {
            updated.billedAmount = Math.min(s.remaining, Math.max(0, Number(updated.inputValue) || 0));
          }
        }
        return updated;
      })
    );
  };

  // Manual service helpers (fallback when no project services exist)
  const updateManualService = (idx: number, field: keyof BillingRequestService, value: string | number) => {
    setManualServices((prev) => {
      const updated = [...prev];
      (updated[idx] as any)[field] = value;
      if (field === "quantity" || field === "rate") {
        updated[idx].amount = Number(updated[idx].quantity) * Number(updated[idx].rate);
      }
      return updated;
    });
  };

  const addManualService = () => {
    setManualServices((prev) => [...prev, { name: "", description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeManualService = (idx: number) => {
    if (manualServices.length <= 1) return;
    setManualServices((prev) => prev.filter((_, i) => i !== idx));
  };

  const subtotal = hasProjectServices
    ? selectedServices.reduce((sum, s) => sum + s.billedAmount, 0)
    : manualServices.reduce((sum, s) => sum + s.amount, 0);

  const fees = useMemo(() => {
    const f: Record<string, number> = {};
    if (activeRule?.wire_fee && activeRule.wire_fee > 0) {
      f["Wire Fee"] = activeRule.wire_fee;
    }
    if (activeRule?.cc_markup && activeRule.cc_markup > 0) {
      f["CC Processing Fee"] = +(subtotal * (activeRule.cc_markup / 100)).toFixed(2);
    }
    return f;
  }, [activeRule, subtotal]);

  const totalFees = Object.values(fees).reduce((s, v) => s + v, 0);
  const totalAmount = subtotal + totalFees;

  const handleSubmit = async () => {
    if (!projectId) {
      toast({ title: "Select a project", variant: "destructive" });
      return;
    }

    const serviceLines: BillingRequestService[] = hasProjectServices
      ? selectedServices.map((s) => ({
          name: s.name,
          description: s.billingMode === "percent"
            ? `${s.inputValue}% of $${s.contractAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
            : "",
          quantity: 1,
          rate: s.billedAmount,
          amount: s.billedAmount,
          billing_method: s.billingMode === "percent" ? "percentage" : "amount",
          billing_value: s.inputValue,
          billed_amount: s.billedAmount,
          previously_billed: s.previouslyBilled,
          remaining_after: Math.max(0, s.remaining - s.billedAmount),
        } as any))
      : manualServices.filter((s) => s.name || s.amount > 0);

    if (serviceLines.length === 0) {
      toast({ title: "Select at least one service to bill", variant: "destructive" });
      return;
    }

    try {
      await createBillingRequest.mutateAsync({
        project_id: projectId,
        client_id: selectedProject?.client_id,
        services: serviceLines,
        total_amount: totalAmount,
        billed_to_contact_id: billedToContactId || null,
        fees: Object.keys(fees).length > 0 ? fees : undefined,
        special_instructions: activeRule?.special_instructions || null,
      });
      toast({ title: "Billing request submitted & invoice created" });
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    if (!preselectedProjectId) setProjectId("");
    setBilledToContactId("");
    setSelectedServices([]);
    setManualServices([{ name: "", description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send to Billing</DialogTitle>
          <DialogDescription>
            Submit completed services for invoicing. An invoice will be auto-created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {(projects || []).filter((p) => p.status === "open").map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.project_number || "—"} - {p.name || "Untitled"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Input
                readOnly
                value={selectedClient?.name || "Auto-filled from project"}
                className="bg-muted"
              />
            </div>
          </div>

          {/* Billing Contact Selector */}
          <div className="space-y-2">
            <Label>Bill To (Contact)</Label>
            <Select value={billedToContactId} onValueChange={setBilledToContactId}>
              <SelectTrigger>
                <SelectValue placeholder={contacts?.length ? "Select billing contact" : "Select a project first"} />
              </SelectTrigger>
              <SelectContent>
                {(contacts || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.title ? ` — ${c.title}` : ""}{c.is_primary ? " (Primary)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedContact && (
              <p className="text-xs text-muted-foreground">
                {selectedContact.email || "No email"}{selectedContact.phone ? ` · ${selectedContact.phone}` : ""}
              </p>
            )}
          </div>

          {/* Client Billing Rules Alert */}
          {activeRule && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Client Billing Rules Applied</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeRule.require_waiver && (
                  <Badge variant="outline" className="text-[10px]">Waiver Required</Badge>
                )}
                {activeRule.require_pay_app && (
                  <Badge variant="outline" className="text-[10px]">Pay App Required</Badge>
                )}
                {activeRule.special_portal_required && (
                  <Badge variant="outline" className="text-[10px]">Portal Upload Required</Badge>
                )}
                {activeRule.wire_fee && activeRule.wire_fee > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Wire Fee: ${activeRule.wire_fee}</Badge>
                )}
                {activeRule.cc_markup && activeRule.cc_markup > 0 && (
                  <Badge variant="secondary" className="text-[10px]">CC Markup: {activeRule.cc_markup}%</Badge>
                )}
                {activeRule.vendor_id && (
                  <Badge variant="outline" className="text-[10px]">Vendor ID: {activeRule.vendor_id}</Badge>
                )}
              </div>
              {activeRule.special_instructions && (
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 text-warning shrink-0" />
                  {activeRule.special_instructions}
                </p>
              )}
            </div>
          )}

          <Separator />

          {/* Service Selection — from project services */}
          {hasProjectServices ? (
            <div className="space-y-3">
              <Label>Select Services to Bill</Label>
              <div className="space-y-2">
                {projectServices.map((svc) => {
                  const selected = selectedServices.find((s) => s.serviceId === svc.id);
                  const contractAmt = svc.total_amount || svc.fixed_price || 0;
                  const prevBilled = previouslyBilled[svc.name] || 0;
                  const remaining = Math.max(0, contractAmt - prevBilled);
                  const fullyBilled = contractAmt > 0 && remaining <= 0;

                  return (
                    <div
                      key={svc.id}
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        selected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30",
                        fullyBilled && "opacity-50"
                      )}
                    >
                      {/* Top row: checkbox + name + contract info */}
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={!!selected}
                          disabled={fullyBilled}
                          onCheckedChange={() => toggleService(svc)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{svc.name}</span>
                            {svc.status && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {svc.status.replace(/_/g, " ")}
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span>Contract: ${contractAmt.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                            {prevBilled > 0 && (
                              <span>Billed: ${prevBilled.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                            )}
                            <span className={cn(fullyBilled ? "text-destructive" : "text-foreground font-medium")}>
                              {fullyBilled ? "Fully billed" : `Remaining: $${remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                            </span>
                          </div>
                          </div>
                        </div>

                        {/* Billing history */}
                        {(billingHistory[svc.name] || []).length > 0 && !selected && (
                          <BillingHistorySection
                            history={billingHistory[svc.name]}
                            onBillAgain={(entry) => {
                              // Pre-fill with last billing details
                              const contractAmount = contractAmt;
                              const mode = entry.billingMethod === "percentage" ? "percent" : "amount";
                              const val = entry.billingValue || entry.amount;
                              const billedAmt = mode === "percent"
                                ? +(contractAmount * ((entry.billingValue || 100) / 100)).toFixed(2)
                                : Math.min(remaining, entry.amount);
                              setSelectedServices((prev) => [
                                ...prev.filter((s) => s.serviceId !== svc.id),
                                {
                                  serviceId: svc.id,
                                  name: svc.name,
                                  contractAmount,
                                  previouslyBilled: prevBilled,
                                  remaining,
                                  billingMode: mode as "amount" | "percent",
                                  inputValue: mode === "percent" ? (entry.billingValue || 100) : Math.min(remaining, entry.amount),
                                  billedAmount: Math.min(remaining, billedAmt),
                                },
                              ]);
                              if (entry.billedToContactId) setBilledToContactId(entry.billedToContactId);
                            }}
                            fullyBilled={fullyBilled}
                          />
                        )}
                      {/* Amount / % input — shown when selected */}
                      {selected && (
                        <div className="mt-3 ml-8 flex items-center gap-2">
                          {/* Mode toggle */}
                          <div className="flex rounded-md border overflow-hidden shrink-0">
                            <button
                              type="button"
                              onClick={() => updateSelectedService(svc.id, "billingMode", "amount")}
                              className={cn(
                                "px-2 py-1 text-xs transition-colors",
                                selected.billingMode === "amount"
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-muted"
                              )}
                            >
                              <DollarSign className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateSelectedService(svc.id, "billingMode", "percent");
                                // Default to 100% when switching
                                if (selected.billingMode !== "percent") {
                                  updateSelectedService(svc.id, "inputValue", 100);
                                }
                              }}
                              className={cn(
                                "px-2 py-1 text-xs transition-colors",
                                selected.billingMode === "percent"
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-muted"
                              )}
                            >
                              <Percent className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Value input */}
                          <div className="relative w-32">
                            {selected.billingMode === "amount" && (
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            )}
                            <Input
                              type="number"
                              min={0}
                              max={selected.billingMode === "percent" ? 100 : selected.remaining}
                              step={selected.billingMode === "percent" ? 1 : 0.01}
                              value={selected.inputValue}
                              onChange={(e) => updateSelectedService(svc.id, "inputValue", Number(e.target.value))}
                              className={cn("h-8 text-sm tabular-nums", selected.billingMode === "amount" ? "pl-6" : "")}
                            />
                            {selected.billingMode === "percent" && (
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                            )}
                          </div>

                          {/* Computed amount + remaining balance */}
                          <div className="ml-auto text-right">
                            <span className="text-sm font-medium tabular-nums">
                              ${selected.billedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                            {selected.billedAmount < selected.remaining && selected.contractAmount > 0 && (
                              <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                                Bal: ${(selected.remaining - selected.billedAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                {" "}({Math.round(((selected.remaining - selected.billedAmount) / selected.contractAmount) * 100)}%)
                              </div>
                            )}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Fallback: manual service entry for projects without services */
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Completed Services</Label>
                <Button variant="ghost" size="sm" onClick={addManualService}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Service
                </Button>
              </div>

              <div className="space-y-3">
                {manualServices.map((service, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
                    <div className="space-y-1">
                      {idx === 0 && <Label className="text-xs text-muted-foreground">Service Name</Label>}
                      <Input
                        value={service.name}
                        onChange={(e) => updateManualService(idx, "name", e.target.value)}
                        placeholder="Service name"
                        className="h-9"
                      />
                    </div>
                    <div className="w-16 space-y-1">
                      {idx === 0 && <Label className="text-xs text-muted-foreground">Qty</Label>}
                      <Input
                        type="number"
                        min={1}
                        value={service.quantity}
                        onChange={(e) => updateManualService(idx, "quantity", Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      {idx === 0 && <Label className="text-xs text-muted-foreground">Rate</Label>}
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={service.rate}
                        onChange={(e) => updateManualService(idx, "rate", Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      {idx === 0 && <Label className="text-xs text-muted-foreground">Amount</Label>}
                      <Input
                        readOnly
                        value={`$${service.amount.toFixed(2)}`}
                        className="h-9 bg-muted tabular-nums text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      disabled={manualServices.length <= 1}
                      onClick={() => removeManualService(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div className="flex justify-end">
            <div className="text-right space-y-1">
              <div className="flex justify-between gap-8 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">${subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              {Object.entries(fees).map(([label, amount]) => (
                <div key={label} className="flex justify-between gap-8 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="tabular-nums">${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              {totalFees > 0 && <Separator className="my-1" />}
              <div className="flex justify-between gap-8">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold tabular-nums">
                  ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createBillingRequest.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {createBillingRequest.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillingHistorySection({
  history,
  onBillAgain,
  fullyBilled,
}: {
  history: BillingHistoryEntry[];
  onBillAgain: (entry: BillingHistoryEntry) => void;
  fullyBilled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (history.length === 0) return null;

  return (
    <div className="mt-2 ml-8">
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {history.length} previous billing{history.length > 1 ? "s" : ""}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1 text-xs text-muted-foreground border-l-2 border-muted pl-3">
          {history.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="tabular-nums font-medium text-foreground">
                ${entry.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
              {entry.billingMethod === "percentage" && entry.billingValue && (
                <span>({entry.billingValue}%)</span>
              )}
              <span>on {new Date(entry.date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}</span>
              {!fullyBilled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] gap-0.5"
                  onClick={() => onBillAgain(entry)}
                >
                  <RotateCcw className="h-2.5 w-2.5" /> Bill Again
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
