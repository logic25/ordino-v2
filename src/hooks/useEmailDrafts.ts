import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmailDraft {
  id: string;
  company_id: string;
  user_id: string;
  to_recipients: string[];
  cc_recipients: string[];
  bcc_recipients: string[];
  subject: string;
  body_html: string;
  reply_to_email_id: string | null;
  forward_from_email_id: string | null;
  draft_type: string;
  updated_at: string;
  created_at: string;
}

export function useEmailDrafts() {
  return useQuery({
    queryKey: ["email-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_drafts")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as unknown as EmailDraft[];
    },
  });
}

export function useSaveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      to,
      cc,
      bcc,
      subject,
      bodyHtml,
      draftType = "compose",
      replyToEmailId,
      forwardFromEmailId,
    }: {
      id?: string;
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      bodyHtml: string;
      draftType?: string;
      replyToEmailId?: string;
      forwardFromEmailId?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile) throw new Error("No profile found");

      if (id) {
        // Update existing draft
        const { data, error } = await supabase
          .from("email_drafts")
          .update({
            to_recipients: to,
            cc_recipients: cc || [],
            bcc_recipients: bcc || [],
            subject,
            body_html: bodyHtml,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from("email_drafts")
          .insert({
            company_id: profile.company_id,
            user_id: profile.id,
            to_recipients: to,
            cc_recipients: cc || [],
            bcc_recipients: bcc || [],
            subject,
            body_html: bodyHtml,
            draft_type: draftType,
            reply_to_email_id: replyToEmailId || null,
            forward_from_email_id: forwardFromEmailId || null,
          } as any)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-drafts"] });
    },
  });
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase
        .from("email_drafts")
        .delete()
        .eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-drafts"] });
    },
  });
}
