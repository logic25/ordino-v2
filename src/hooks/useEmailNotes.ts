import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmailNote {
  id: string;
  email_id: string;
  company_id: string;
  user_id: string;
  user_name: string;
  note_text: string;
  created_at: string;
}

export function useEmailNotes(emailId: string | undefined) {
  return useQuery({
    queryKey: ["email-notes", emailId],
    queryFn: async () => {
      if (!emailId) return [];
      const { data, error } = await supabase
        .from("email_notes")
        .select("*")
        .eq("email_id", emailId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as EmailNote[];
    },
    enabled: !!emailId,
  });
}

export function useAddEmailNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      emailId,
      noteText,
    }: {
      emailId: string;
      noteText: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id, display_name, first_name, last_name")
        .single();

      if (!profile) throw new Error("No profile found");

      const userName =
        profile.display_name ||
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        "Unknown";

      const { data, error } = await supabase
        .from("email_notes")
        .insert({
          email_id: emailId,
          company_id: profile.company_id,
          user_id: profile.id,
          user_name: userName,
          note_text: noteText,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["email-notes", vars.emailId] });
    },
  });
}

export function useDeleteEmailNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, emailId }: { noteId: string; emailId: string }) => {
      const { error } = await supabase
        .from("email_notes")
        .delete()
        .eq("id", noteId);
      if (error) throw error;
      return emailId;
    },
    onSuccess: (emailId) => {
      queryClient.invalidateQueries({ queryKey: ["email-notes", emailId] });
    },
  });
}
