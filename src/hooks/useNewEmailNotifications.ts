import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function useNewEmailNotifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isSubscribed = useRef(false);

  useEffect(() => {
    if (isSubscribed.current) return;
    isSubscribed.current = true;

    const channel = supabase
      .channel("new-emails")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "emails",
        },
        (payload) => {
          const newEmail = payload.new as any;
          queryClient.invalidateQueries({ queryKey: ["emails"] });

          toast({
            title: "New email",
            description: newEmail.subject || newEmail.from_name || "New message received",
          });
        }
      )
      .subscribe();

    return () => {
      isSubscribed.current = false;
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);
}
