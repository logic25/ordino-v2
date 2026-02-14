import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmailReminder {
  id: string;
  email_id: string;
  company_id: string;
  user_id: string;
  remind_at: string;
  condition: string;
  status: string;
  reminded_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export function useEmailReminders(emailId?: string) {
  return useQuery({
    queryKey: ["email-reminders", emailId],
    queryFn: async () => {
      if (!emailId) return [];
      const { data, error } = await supabase
        .from("email_reminders")
        .select("*")
        .eq("email_id", emailId)
        .eq("status", "pending")
        .order("remind_at", { ascending: true });
      if (error) throw error;
      return data as unknown as EmailReminder[];
    },
    enabled: !!emailId,
  });
}

export function useAllPendingReminders() {
  return useQuery({
    queryKey: ["email-reminders", "all-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_reminders")
        .select("*")
        .eq("status", "pending")
        .order("remind_at", { ascending: true });
      if (error) throw error;
      return data as unknown as EmailReminder[];
    },
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      emailId,
      remindAt,
      condition = "no_reply",
    }: {
      emailId: string;
      remindAt: Date;
      condition?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile) throw new Error("No profile found");

      const { data, error } = await supabase
        .from("email_reminders")
        .insert({
          email_id: emailId,
          company_id: profile.company_id,
          user_id: profile.id,
          remind_at: remindAt.toISOString(),
          condition,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-reminders"] });
    },
  });
}

export function useCancelReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase
        .from("email_reminders")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        } as any)
        .eq("id", reminderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-reminders"] });
    },
  });
}
