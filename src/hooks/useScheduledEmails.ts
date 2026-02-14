import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduledEmail {
  id: string;
  company_id: string;
  user_id: string;
  email_draft: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    html_body: string;
    reply_to_email_id?: string;
  };
  scheduled_send_time: string;
  timezone: string;
  status: string;
  project_id: string | null;
  gmail_message_id: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export function useScheduledEmails() {
  return useQuery({
    queryKey: ["scheduled-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_emails")
        .select("*")
        .eq("status", "scheduled")
        .order("scheduled_send_time", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ScheduledEmail[];
    },
  });
}

export function useCreateScheduledEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      emailDraft,
      scheduledSendTime,
      timezone = "America/New_York",
      projectId,
    }: {
      emailDraft: ScheduledEmail["email_draft"];
      scheduledSendTime: Date;
      timezone?: string;
      projectId?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile) throw new Error("No profile found");

      const { data, error } = await supabase
        .from("scheduled_emails")
        .insert({
          company_id: profile.company_id,
          user_id: profile.id,
          email_draft: emailDraft as any,
          scheduled_send_time: scheduledSendTime.toISOString(),
          timezone,
          status: "scheduled",
          project_id: projectId || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-emails"] });
    },
  });
}

export function useCancelScheduledEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scheduled_emails")
        .update({ status: "cancelled" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-emails"] });
    },
  });
}
