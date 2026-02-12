import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGmailConnection() {
  return useQuery({
    queryKey: ["gmail-connection"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gmail_connections")
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return data;
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
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
    },
  });
}

export function useSendEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      to,
      subject,
      html_body,
      reply_to_email_id,
    }: {
      to: string;
      subject: string;
      html_body: string;
      reply_to_email_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("gmail-send", {
        body: { to, subject, html_body, reply_to_email_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}
