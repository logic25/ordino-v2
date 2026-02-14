import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AutomationRule {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  rule_type: string;
  trigger_type: string;
  trigger_value: number;
  action_type: string;
  action_config: Record<string, any>;
  conditions: Record<string, any>;
  is_enabled: boolean;
  priority: number;
  max_executions: number | null;
  cooldown_hours: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  company_id: string;
  rule_id: string;
  invoice_id: string;
  client_id: string | null;
  action_taken: string;
  result: string;
  generated_message: string | null;
  escalated_to: string | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  // joined
  rule?: { name: string } | null;
  invoice?: { invoice_number: string } | null;
  client?: { name: string } | null;
  escalated_to_profile?: { first_name: string | null; last_name: string | null } | null;
  approved_by_profile?: { first_name: string | null; last_name: string | null } | null;
}

export interface AutomationRuleInput {
  name: string;
  description?: string | null;
  rule_type: string;
  trigger_type: string;
  trigger_value: number;
  action_type: string;
  action_config?: Record<string, any>;
  conditions?: Record<string, any>;
  is_enabled?: boolean;
  priority?: number;
  max_executions?: number | null;
  cooldown_hours?: number;
}

export function useAutomationRules() {
  return useQuery({
    queryKey: ["automation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as unknown as AutomationRule[];
    },
  });
}

export function useAutomationLogs(limit = 50) {
  return useQuery({
    queryKey: ["automation-logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_logs")
        .select(`
          *,
          rule:automation_rules(name),
          invoice:invoices(invoice_number),
          client:clients(name),
          escalated_to_profile:profiles!automation_logs_escalated_to_fkey(first_name, last_name),
          approved_by_profile:profiles!automation_logs_approved_by_fkey(first_name, last_name)
        `)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as AutomationLog[];
    },
  });
}

export function useCreateAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AutomationRuleInput) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();
      if (!profile?.company_id) throw new Error("No company found");

      const { data, error } = await supabase
        .from("automation_rules")
        .insert({
          company_id: profile.company_id,
          name: input.name,
          description: input.description || null,
          rule_type: input.rule_type,
          trigger_type: input.trigger_type,
          trigger_value: input.trigger_value,
          action_type: input.action_type,
          action_config: input.action_config || {},
          conditions: input.conditions || {},
          is_enabled: input.is_enabled ?? true,
          priority: input.priority ?? 0,
          max_executions: input.max_executions ?? null,
          cooldown_hours: input.cooldown_hours ?? 72,
          created_by: profile.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
    },
  });
}

export function useUpdateAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<AutomationRuleInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.rule_type !== undefined) updateData.rule_type = input.rule_type;
      if (input.trigger_type !== undefined) updateData.trigger_type = input.trigger_type;
      if (input.trigger_value !== undefined) updateData.trigger_value = input.trigger_value;
      if (input.action_type !== undefined) updateData.action_type = input.action_type;
      if (input.action_config !== undefined) updateData.action_config = input.action_config;
      if (input.conditions !== undefined) updateData.conditions = input.conditions;
      if (input.is_enabled !== undefined) updateData.is_enabled = input.is_enabled;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.max_executions !== undefined) updateData.max_executions = input.max_executions;
      if (input.cooldown_hours !== undefined) updateData.cooldown_hours = input.cooldown_hours;

      const { data, error } = await supabase
        .from("automation_rules")
        .update(updateData as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
    },
  });
}

export function useDeleteAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("automation_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
    },
  });
}

export function useToggleAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from("automation_rules")
        .update({ is_enabled } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
    },
  });
}

export function useApproveAutomationLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (logId: string) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .single();
      const { error } = await supabase
        .from("automation_logs")
        .update({
          result: "approved",
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
        } as any)
        .eq("id", logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-logs"] });
    },
  });
}

export function useRejectAutomationLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase
        .from("automation_logs")
        .update({ result: "skipped" } as any)
        .eq("id", logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-logs"] });
    },
  });
}
