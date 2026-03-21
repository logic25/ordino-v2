import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "@/hooks/useProjects";
import { useClients, useClientContacts } from "@/hooks/useClients";
import { useCreateBillingRequest, type BillingRequestService } from "@/hooks/useBillingRequests";
import { useClientBillingRulesByClient } from "@/hooks/useClientBillingRules";
import { toast } from "@/hooks/use-toast";
import type { SelectedService, BillingHistoryEntry } from "./ServiceSelectionList";

interface ProjectService {
  id: string;
  name: string;
  description: string | null;
  total_amount: number | null;
  fixed_price: number | null;
  billing_type: string | null;
  status: string | null;
}

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

interface UseSendToBillingOptions {
  open: boolean;
  preselectedProjectId?: string;
  preselectedServiceIds?: Set<string>;
  onOpenChange: (open: boolean) => void;
}

export function useSendToBilling({ open, preselectedProjectId, preselectedServiceIds, onOpenChange }: UseSendToBillingOptions) {
  const [projectId, setProjectId] = useState(preselectedProjectId || "");
  const [billedToContactId, setBilledToContactId] = useState("");
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
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

  useEffect(() => { if (preselectedProjectId) setProjectId(preselectedProjectId); }, [preselectedProjectId]);
  useEffect(() => { setBilledToContactId(""); setSelectedServices([]); }, [projectId]);
  useEffect(() => {
    if (contacts && contacts.length > 0 && !billedToContactId) {
      const primary = contacts.find((c) => c.is_primary);
      setBilledToContactId(primary?.id || contacts[0].id);
    }
  }, [contacts]);

  useEffect(() => {
    if (!open || !hasProjectServices || selectedServices.length > 0) return;
    const toAutoSelect = preselectedServiceIds && preselectedServiceIds.size > 0
      ? projectServices.filter(s => preselectedServiceIds.has(s.id))
      : projectServices.length === 1 ? [projectServices[0]] : [];
    if (toAutoSelect.length > 0) {
      setSelectedServices(toAutoSelect.map(svc => {
        const contractAmount = svc.total_amount || svc.fixed_price || 0;
        const prevBilled = previouslyBilled[svc.name] || 0;
        const remaining = Math.max(0, contractAmount - prevBilled);
        return { serviceId: svc.id, name: svc.name, contractAmount, previouslyBilled: prevBilled, remaining, billingMode: "amount" as const, inputValue: remaining, billedAmount: remaining };
      }));
    }
  }, [open, projectServices, preselectedServiceIds, previouslyBilled]);

  const selectedContact = contacts?.find((c) => c.id === billedToContactId);

  const toggleService = (svc: ProjectService) => {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.serviceId === svc.id);
      if (exists) return prev.filter((s) => s.serviceId !== svc.id);
      const contractAmount = svc.total_amount || svc.fixed_price || 0;
      const prevBilled = previouslyBilled[svc.name] || 0;
      const remaining = Math.max(0, contractAmount - prevBilled);
      return [...prev, { serviceId: svc.id, name: svc.name, contractAmount, previouslyBilled: prevBilled, remaining, billingMode: "amount", inputValue: remaining, billedAmount: remaining }];
    });
  };

  const updateSelectedService = (serviceId: string, field: "billingMode" | "inputValue", value: any) => {
    setSelectedServices((prev) =>
      prev.map((s) => {
        if (s.serviceId !== serviceId) return s;
        const updated = { ...s, [field]: value };
        if (updated.billingMode === "percent") {
          const pct = Math.min(100, Math.max(0, Number(updated.inputValue) || 0));
          updated.billedAmount = +(s.contractAmount * (pct / 100)).toFixed(2);
        } else {
          updated.billedAmount = Math.min(s.remaining, Math.max(0, Number(updated.inputValue) || 0));
        }
        return updated;
      })
    );
  };

  const updateManualService = (idx: number, field: keyof BillingRequestService, value: string | number) => {
    setManualServices((prev) => {
      const updated = [...prev];
      (updated[idx] as any)[field] = value;
      if (field === "quantity" || field === "rate") updated[idx].amount = Number(updated[idx].quantity) * Number(updated[idx].rate);
      return updated;
    });
  };

  const subtotal = hasProjectServices
    ? selectedServices.reduce((sum, s) => sum + s.billedAmount, 0)
    : manualServices.reduce((sum, s) => sum + s.amount, 0);

  const fees = useMemo(() => {
    const f: Record<string, number> = {};
    if (activeRule?.wire_fee && activeRule.wire_fee > 0) f["Wire Fee"] = activeRule.wire_fee;
    if (activeRule?.cc_markup && activeRule.cc_markup > 0) f["CC Processing Fee"] = +(subtotal * (activeRule.cc_markup / 100)).toFixed(2);
    return f;
  }, [activeRule, subtotal]);

  const totalFees = Object.values(fees).reduce((s, v) => s + v, 0);
  const totalAmount = subtotal + totalFees;

  const handleBillAgain = (svc: ProjectService, entry: BillingHistoryEntry) => {
    const contractAmount = svc.total_amount || svc.fixed_price || 0;
    const prevBilled = previouslyBilled[svc.name] || 0;
    const remaining = Math.max(0, contractAmount - prevBilled);
    const mode = entry.billingMethod === "percentage" ? "percent" : "amount";
    const billedAmt = mode === "percent" ? +(contractAmount * ((entry.billingValue || 100) / 100)).toFixed(2) : Math.min(remaining, entry.amount);
    setSelectedServices((prev) => [
      ...prev.filter((s) => s.serviceId !== svc.id),
      { serviceId: svc.id, name: svc.name, contractAmount, previouslyBilled: prevBilled, remaining, billingMode: mode as "amount" | "percent", inputValue: mode === "percent" ? (entry.billingValue || 100) : Math.min(remaining, entry.amount), billedAmount: Math.min(remaining, billedAmt) },
    ]);
    if (entry.billedToContactId) setBilledToContactId(entry.billedToContactId);
  };

  const resetForm = () => {
    if (!preselectedProjectId) setProjectId("");
    setBilledToContactId(""); setSelectedServices([]);
    setManualServices([{ name: "", description: "", quantity: 1, rate: 0, amount: 0 }]);
  };

  const handleSubmit = async () => {
    if (!projectId) { toast({ title: "Select a project", variant: "destructive" }); return; }
    const serviceLines: BillingRequestService[] = hasProjectServices
      ? selectedServices.map((s) => ({
          name: s.name,
          description: s.billingMode === "percent" ? `${s.inputValue}% of $${s.contractAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "",
          quantity: 1, rate: s.billedAmount, amount: s.billedAmount,
          billing_method: s.billingMode === "percent" ? "percentage" : "amount",
          billing_value: s.inputValue, billed_amount: s.billedAmount,
          previously_billed: s.previouslyBilled, remaining_after: Math.max(0, s.remaining - s.billedAmount),
        } as any))
      : manualServices.filter((s) => s.name || s.amount > 0);

    if (serviceLines.length === 0) { toast({ title: "Select at least one service to bill", variant: "destructive" }); return; }

    try {
      await createBillingRequest.mutateAsync({
        project_id: projectId, client_id: selectedProject?.client_id,
        services: serviceLines, total_amount: totalAmount,
        billed_to_contact_id: billedToContactId || null,
        fees: Object.keys(fees).length > 0 ? fees : undefined,
        special_instructions: activeRule?.special_instructions || null,
      });
      for (const s of selectedServices) {
        const totalBilledAfter = s.previouslyBilled + s.billedAmount;
        if (s.contractAmount > 0 && totalBilledAfter >= s.contractAmount) {
          await supabase.from("services").update({ status: "billed", billed_at: new Date().toISOString() }).eq("id", s.serviceId);
        }
      }
      toast({ title: "Billing request submitted & invoice created" });
      onOpenChange(false); resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return {
    projectId, setProjectId,
    billedToContactId, setBilledToContactId,
    selectedServices, manualServices,
    projects, selectedProject, selectedClient, selectedContact,
    contacts, activeRule, hasProjectServices, projectServices,
    previouslyBilled, billingHistory,
    toggleService, updateSelectedService, updateManualService,
    handleBillAgain, handleSubmit,
    subtotal, fees, totalFees, totalAmount,
    isSubmitting: createBillingRequest.isPending,
    setManualServices,
  };
}

export type { ProjectService };
