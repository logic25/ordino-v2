import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import type { Rfp } from "@/hooks/useRfps";

export type BillingCalendarItem = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  event_type: string;
  location: string | null;
  description: string | null;
  is_billing: true;
  billing_type: "invoice_due" | "follow_up" | "installment" | "promise";
  invoice_id?: string;
  client_name?: string;
  amount?: number;
};

export function useBillingCalendarItems(startDate: string, endDate: string, enabled: boolean = true) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["billing-calendar-items", startDate, endDate],
    enabled: !!profile?.company_id && enabled,
    queryFn: async () => {
      const items: BillingCalendarItem[] = [];

      // Invoice due dates
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, due_date, total_due, status, client_id, clients(name)")
        .not("due_date", "is", null)
        .gte("due_date", startDate.split("T")[0])
        .lte("due_date", endDate.split("T")[0])
        .in("status", ["sent", "overdue", "partial"]);

      invoices?.forEach((inv: any) => {
        const dueDate = inv.due_date;
        items.push({
          id: `inv-due-${inv.id}`,
          title: `${inv.invoice_number} due — $${Number(inv.total_due).toLocaleString()}`,
          start_time: `${dueDate}T00:00:00`,
          end_time: `${dueDate}T23:59:59`,
          all_day: true,
          event_type: "invoice_due",
          location: null,
          description: `${inv.clients?.name || "Unknown client"} • ${inv.status}`,
          is_billing: true,
          billing_type: "invoice_due",
          invoice_id: inv.id,
          client_name: inv.clients?.name,
          amount: inv.total_due,
        });
      });

      // Follow-up dates
      const { data: followUps } = await supabase
        .from("invoice_follow_ups")
        .select("id, follow_up_date, notes, invoice_id, invoices(invoice_number, clients(name))")
        .gte("follow_up_date", startDate.split("T")[0])
        .lte("follow_up_date", endDate.split("T")[0]);

      followUps?.forEach((fu: any) => {
        items.push({
          id: `fu-${fu.id}`,
          title: `Follow up: ${fu.invoices?.invoice_number || "Invoice"}`,
          start_time: `${fu.follow_up_date}T09:00:00`,
          end_time: `${fu.follow_up_date}T09:30:00`,
          all_day: false,
          event_type: "follow_up",
          location: null,
          description: fu.notes || `Follow up with ${fu.invoices?.clients?.name || "client"}`,
          is_billing: true,
          billing_type: "follow_up",
          invoice_id: fu.invoice_id,
          client_name: fu.invoices?.clients?.name,
        });
      });

      // Payment plan installments
      const { data: installments } = await supabase
        .from("payment_plan_installments")
        .select("id, due_date, amount, status, installment_number, plan_id, payment_plans(invoice_id, invoices(invoice_number, clients(name)))")
        .gte("due_date", startDate.split("T")[0])
        .lte("due_date", endDate.split("T")[0])
        .in("status", ["pending", "overdue"]);

      installments?.forEach((inst: any) => {
        const inv = inst.payment_plans?.invoices;
        items.push({
          id: `inst-${inst.id}`,
          title: `Installment #${inst.installment_number} — $${Number(inst.amount).toLocaleString()}`,
          start_time: `${inst.due_date}T00:00:00`,
          end_time: `${inst.due_date}T23:59:59`,
          all_day: true,
          event_type: "installment",
          location: null,
          description: `${inv?.invoice_number || "Plan"} • ${inv?.clients?.name || ""}`,
          is_billing: true,
          billing_type: "installment",
          invoice_id: inst.payment_plans?.invoice_id,
          client_name: inv?.clients?.name,
          amount: inst.amount,
        });
      });

      // Payment promises
      const { data: promises } = await supabase
        .from("payment_promises")
        .select("id, promised_date, promised_amount, status, invoice_id, invoices(invoice_number), clients(name)")
        .gte("promised_date", startDate.split("T")[0])
        .lte("promised_date", endDate.split("T")[0])
        .in("status", ["pending"]);

      promises?.forEach((p: any) => {
        items.push({
          id: `promise-${p.id}`,
          title: `Promise: $${Number(p.promised_amount).toLocaleString()}`,
          start_time: `${p.promised_date}T00:00:00`,
          end_time: `${p.promised_date}T23:59:59`,
          all_day: true,
          event_type: "promise",
          location: null,
          description: `${p.invoices?.invoice_number || ""} • ${p.clients?.name || ""}`,
          is_billing: true,
          billing_type: "promise",
          invoice_id: p.invoice_id,
          client_name: p.clients?.name,
          amount: p.promised_amount,
        });
      });

      // RFP due dates
      const { data: rfps } = await supabase
        .from("rfps")
        .select("id, title, rfp_number, agency, due_date, status, contract_value")
        .not("due_date", "is", null)
        .gte("due_date", startDate.split("T")[0])
        .lte("due_date", endDate.split("T")[0])
        .not("status", "in", '("won","lost")');

      rfps?.forEach((rfp: any) => {
        const dueDate = typeof rfp.due_date === "string" && rfp.due_date.length === 10
          ? rfp.due_date
          : rfp.due_date?.split("T")[0];
        if (!dueDate) return;
        items.push({
          id: `rfp-due-${rfp.id}`,
          title: `📋 RFP Due: ${rfp.title}`,
          start_time: `${dueDate}T00:00:00`,
          end_time: `${dueDate}T23:59:59`,
          all_day: true,
          event_type: "rfp_deadline",
          location: null,
          description: `${rfp.agency || "Unknown agency"} • ${rfp.rfp_number || ""} • ${rfp.status}${rfp.contract_value ? ` • $${Number(rfp.contract_value).toLocaleString()}` : ""}`,
          is_billing: true,
          billing_type: "invoice_due" as any,
          client_name: rfp.agency,
          amount: rfp.contract_value,
        });
      });

      return items;
    },
  });
}
