import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { triggerBillingNotifications } from "./useBillingRequests";
import { toast } from "@/hooks/use-toast";

export type ExpenseStatus =
  | "pending_approval"
  | "approved"
  | "denied"
  | "on_hold"
  | "pending_billing"
  | "billed"
  | "paid"
  | "non_billable";

export type ApprovalStatus = "not_required" | "pending" | "approved" | "denied";

export interface ProjectExpense {
  id: string;
  company_id: string;
  project_id: string;
  service_id: string | null;
  created_by: string | null;
  description: string;
  vendor: string | null;
  amount: number;
  markup_pct: number;
  billable_amount: number;
  incurred_date: string | null;
  receipt_url: string | null;
  billed_to_contact_id: string | null;
  status: ExpenseStatus;
  hold_reason: string | null;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  denied_reason: string | null;
  billing_request_id: string | null;
  invoice_line_id: string | null;
  qbo_expense_id: string | null;
  qbo_bill_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectExpenseWithRelations extends ProjectExpense {
  projects?: { id: string; name: string | null; project_number: string | null; properties?: { address: string | null } | null } | null;
  created_by_profile?: { id: string; first_name: string | null; last_name: string | null; display_name: string | null } | null;
}

type ExpenseFlow = "ready_to_bill" | "on_hold" | "needs_approval";

export interface CreateExpenseInput {
  project_id: string;
  description: string;
  vendor?: string | null;
  amount: number;
  markup_pct?: number;
  incurred_date?: string | null;
  receipt_url?: string | null;
  billed_to_contact_id?: string | null;
  service_id?: string | null;
  flow: ExpenseFlow;
  hold_reason?: string | null;
}

async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("No company found for user.");
  return { user, profile };
}

async function getCompanyExpenseSettings(companyId: string) {
  const { data } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();
  const s = (data?.settings as any) || {};
  const threshold = Number(s.expense_auto_approve_threshold ?? 250);
  const approverIds: string[] = Array.isArray(s.expense_approver_ids) ? s.expense_approver_ids : [];
  return { threshold, approverIds };
}

export function useProjectExpenses(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-expenses", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_expenses" as any)
        .select(`
          *,
          created_by_profile:profiles!project_expenses_created_by_fkey (id, first_name, last_name, display_name)
        `)
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProjectExpenseWithRelations[];
    },
  });
}

/** All expenses across the company that need approval (admin view). */
export function usePendingExpenseApprovals() {
  return useQuery({
    queryKey: ["pending-expense-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_expenses" as any)
        .select(`
          *,
          projects (id, name, project_number, properties (address)),
          created_by_profile:profiles!project_expenses_created_by_fkey (id, first_name, last_name, display_name)
        `)
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProjectExpenseWithRelations[];
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const { profile } = await getCurrentProfile();
      const settings = await getCompanyExpenseSettings(profile.company_id);

      // Decide flow → status. Auto-approve threshold only matters for needs_approval flow.
      let status: ExpenseStatus;
      let approval_status: ApprovalStatus = "not_required";
      let hold_reason: string | null = null;

      if (input.flow === "ready_to_bill") {
        status = "pending_billing";
      } else if (input.flow === "on_hold") {
        status = "on_hold";
        hold_reason = input.hold_reason || null;
      } else {
        // needs_approval
        if (input.amount < settings.threshold) {
          // auto-approved → goes to on_hold (PM still has to pay & mark paid)
          status = "approved";
          approval_status = "approved";
        } else {
          status = "pending_approval";
          approval_status = "pending";
        }
      }

      const insertRow: any = {
        company_id: profile.company_id,
        project_id: input.project_id,
        service_id: input.service_id || null,
        created_by: profile.id,
        description: input.description,
        vendor: input.vendor || null,
        amount: input.amount,
        markup_pct: input.markup_pct ?? 0,
        incurred_date: input.incurred_date || new Date().toISOString().slice(0, 10),
        receipt_url: input.receipt_url || null,
        billed_to_contact_id: input.billed_to_contact_id || null,
        status,
        approval_status,
        hold_reason,
      };

      const { data: expense, error } = await supabase
        .from("project_expenses" as any)
        .insert(insertRow)
        .select()
        .single();
      if (error) throw error;
      const exp = expense as unknown as ProjectExpense;

      // If pending_billing → DB trigger created billing_request. Fire notifications.
      if (exp.status === "pending_billing" && exp.billing_request_id) {
        await fireBillingNotificationsForExpense(exp.billing_request_id);
      }

      // If pending_approval → notify approvers
      if (exp.approval_status === "pending") {
        await notifyApprovers(exp, settings.approverIds);
      }

      return exp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["pending-expense-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["billing-requests"] });
      queryClient.invalidateQueries({ queryKey: ["billing-pending-count"] });
    },
  });
}

export function useApproveExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ expenseId }: { expenseId: string }) => {
      const { profile } = await getCurrentProfile();
      // Auto-flow: approve → pending_billing in one step. The DB trigger
      // (expense_create_billing_request) creates a billing_requests row so Sai
      // sees it in the Billing inbox without the PM needing a second click.
      const { data, error } = await supabase
        .from("project_expenses" as any)
        .update({
          approval_status: "approved",
          status: "pending_billing",
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
        } as any)
        .eq("id", expenseId)
        .select()
        .single();
      if (error) throw error;
      const exp = data as unknown as ProjectExpense;

      // Fire the Sai-facing billing notification (best-effort)
      if (exp.billing_request_id) {
        await fireBillingNotificationsForExpense(exp.billing_request_id);
      }

      // Notify the PM who submitted the expense
      if (exp.created_by) {
        const userId = (await supabase.from("profiles").select("user_id").eq("id", exp.created_by).maybeSingle()).data?.user_id;
        if (userId) {
          await supabase.from("notifications").insert({
            company_id: exp.company_id,
            user_id: userId,
            type: "expense_approved",
            title: "Expense Approved",
            body: `Your $${exp.amount} expense (${exp.description}) was approved and sent to accounting for billing — nothing more for you to do.`,
            link: `/projects/${exp.project_id}`,
            project_id: exp.project_id,
          } as any);
        }
      }
      return exp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["pending-expense-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["billing-requests"] });
      queryClient.invalidateQueries({ queryKey: ["billing-pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}


export function useDenyExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ expenseId, reason }: { expenseId: string; reason: string }) => {
      const { profile } = await getCurrentProfile();
      const { data, error } = await supabase
        .from("project_expenses" as any)
        .update({
          approval_status: "denied",
          status: "denied",
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
          denied_reason: reason,
        } as any)
        .eq("id", expenseId)
        .select()
        .single();
      if (error) throw error;
      const exp = data as unknown as ProjectExpense;
      if (exp.created_by) {
        const userId = (await supabase.from("profiles").select("user_id").eq("id", exp.created_by).maybeSingle()).data?.user_id;
        if (userId) {
          await supabase.from("notifications").insert({
            company_id: exp.company_id,
            user_id: userId,
            type: "expense_denied",
            title: "Expense Denied",
            body: `Your $${exp.amount} expense (${exp.description}) was denied. Reason: ${reason}`,
            link: `/projects/${exp.project_id}`,
            project_id: exp.project_id,
          } as any);
        }
      }
      return exp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["pending-expense-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useReleaseExpenseToBilling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ expenseId, receipt_url }: { expenseId: string; receipt_url?: string | null }) => {
      const patch: any = { status: "pending_billing" };
      if (receipt_url) patch.receipt_url = receipt_url;
      const { data, error } = await supabase
        .from("project_expenses" as any)
        .update(patch)
        .eq("id", expenseId)
        .select()
        .single();
      if (error) throw error;
      const exp = data as unknown as ProjectExpense;
      if (exp.billing_request_id) {
        await fireBillingNotificationsForExpense(exp.billing_request_id);
      }
      return exp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["billing-requests"] });
      queryClient.invalidateQueries({ queryKey: ["billing-pending-count"] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase.from("project_expenses" as any).delete().eq("id", expenseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["pending-expense-approvals"] });
    },
  });
}

/** Upload receipt to private bucket. Returns the storage path. */
export async function uploadExpenseReceipt(file: File): Promise<string> {
  const { profile } = await getCurrentProfile();
  const ext = file.name.split(".").pop() || "bin";
  const path = `${profile.company_id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("expense-receipts").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function getReceiptSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("expense-receipts")
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

// ---- Internal helpers ----

async function fireBillingNotificationsForExpense(billingRequestId: string) {
  try {
    const { data: br } = await supabase
      .from("billing_requests")
      .select("*")
      .eq("id", billingRequestId)
      .maybeSingle();
    if (br) await triggerBillingNotifications(br);
  } catch (err) {
    console.error("Failed to fire billing notifications for expense:", err);
  }
}

async function notifyApprovers(exp: ProjectExpense, configuredApproverIds: string[]) {
  try {
    // Resolve approver profile IDs → user_ids. If none configured, fall back to all active admins.
    let approverProfileIds = configuredApproverIds;
    if (approverProfileIds.length === 0) {
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_id", exp.company_id)
        .eq("role", "admin")
        .eq("is_active", true);
      approverProfileIds = (admins || []).map((a: any) => a.id);
    }

    if (approverProfileIds.length === 0) return;

    const { data: approverProfiles } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, first_name, last_name")
      .in("id", approverProfileIds);

    // In-app notifications
    const notifRows = (approverProfiles || [])
      .filter((p: any) => p.user_id)
      .map((p: any) => ({
        company_id: exp.company_id,
        user_id: p.user_id,
        type: "expense_approval_requested",
        title: "Expense Approval Needed",
        body: `$${exp.amount} expense: ${exp.description}${exp.vendor ? ` (${exp.vendor})` : ""}`,
        link: `/projects/${exp.project_id}`,
        project_id: exp.project_id,
      }));
    if (notifRows.length > 0) {
      await supabase.from("notifications").insert(notifRows as any);
    }

    // Fire the email edge function (best-effort, don't block save)
    supabase.functions.invoke("send-expense-approval-request", {
      body: { expense_id: exp.id, approver_profile_ids: approverProfileIds },
    }).catch((err) => console.error("send-expense-approval-request failed:", err));
  } catch (err) {
    console.error("notifyApprovers failed:", err);
  }
}
