import { useState, useEffect, useMemo } from "react";
import { addDays, addYears, format } from "date-fns";
import type { SignalSubscription } from "@/hooks/useSignalSubscriptions";

export interface EnrollFormState {
  status: string;
  ownerEmail: string;
  ownerPhone: string;
  notes: string;
  isComplimentary: boolean;
  linkedProjectId: string;
  monthlyRate: string;
  billingStartDate: string;
  compReason: string;
}

export function useEnrollFormState(open: boolean, existing?: SignalSubscription | null) {
  const [form, setForm] = useState<EnrollFormState>(() => formDefaults(existing));

  useEffect(() => {
    if (open) setForm(formDefaults(existing));
  }, [open, existing]);

  const update = <K extends keyof EnrollFormState>(key: K, value: EnrollFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const computedExpiresAt = useMemo(() => {
    if (form.status === "trial") {
      return format(addDays(new Date(), 14), "yyyy-MM-dd");
    }
    if (form.isComplimentary && (form.status === "active" || form.status === "trial")) {
      return format(addYears(new Date(), 1), "yyyy-MM-dd");
    }
    return null;
  }, [form.status, form.isComplimentary]);

  return { form, update, computedExpiresAt };
}

function formDefaults(existing?: SignalSubscription | null): EnrollFormState {
  return {
    status: existing?.status || "prospect",
    ownerEmail: existing?.owner_email || "",
    ownerPhone: existing?.owner_phone || "",
    notes: existing?.notes || "",
    isComplimentary: existing?.is_complimentary || false,
    linkedProjectId: existing?.linked_project_id || "",
    monthlyRate: existing?.monthly_rate?.toString() || "",
    billingStartDate: existing?.billing_start_date || "",
    compReason: existing?.comp_reason || "",
  };
}
