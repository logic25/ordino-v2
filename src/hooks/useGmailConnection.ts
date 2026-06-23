import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGmailConnection() {
  return useQuery({
    queryKey: ["gmail-connection"],
    queryFn: async () => {
      // gmail_connections is service-role only (it contains OAuth tokens).
      // Read non-secret status fields via a SECURITY DEFINER RPC.
      const { data, error } = await supabase.rpc("get_my_gmail_connection_status");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ?? null;
    },
  });
}

export function useConnectGmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, redirect_uri }: { code: string; redirect_uri: string }) => {
      const { data, error } = await supabase.functions.invoke("gmail-auth", {
        body: { action: "exchange_code", code, redirect_uri },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
    },
  });
}

export function useDisconnectGmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gmail-auth", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}

export function useGetGmailAuthUrl() {
  return useMutation({
    mutationFn: async (redirect_uri: string) => {
      const { data, error } = await supabase.functions.invoke("gmail-auth", {
        body: { action: "get_auth_url", redirect_uri },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { auth_url: string };
    },
  });
}

export function useSyncGmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gmail-sync", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["email-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
    },
  });
}

export function useSendEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      to,
      cc,
      bcc,
      subject,
      html_body,
      reply_to_email_id,
      forward_from_email_id,
      attachments,
      project_id,
      tag_category,
      append_signature,
    }: {
      to: string;
      cc?: string;
      bcc?: string;
      subject: string;
      html_body: string;
      reply_to_email_id?: string;
      forward_from_email_id?: string;
      attachments?: Array<{ filename: string; content: string; mime_type: string }>;
      project_id?: string;
      tag_category?: string;
      append_signature?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("gmail-send", {
        body: { to, cc, bcc, subject, html_body, reply_to_email_id, forward_from_email_id, attachments, project_id, tag_category, append_signature },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["project-emails"] });
    },
  });
}
