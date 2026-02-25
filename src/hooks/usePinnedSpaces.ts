import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function usePinnedSpaces() {
  const qc = useQueryClient();

  const { data: pinnedIds = [], isLoading } = useQuery({
    queryKey: ["pinned-chat-spaces"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("pinned_chat_spaces" as any)
        .select("space_id")
        .eq("user_id", user.id);
      return (data || []).map((r: any) => r.space_id as string);
    },
    staleTime: 10 * 60 * 1000,
  });

  const pinMutation = useMutation({
    mutationFn: async (spaceId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("pinned_chat_spaces" as any)
        .insert({ user_id: user.id, space_id: spaceId } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pinned-chat-spaces"] });
      toast({ title: "Chat pinned" });
    },
  });

  const unpinMutation = useMutation({
    mutationFn: async (spaceId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("pinned_chat_spaces" as any)
        .delete()
        .eq("user_id", user.id)
        .eq("space_id", spaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pinned-chat-spaces"] });
    },
  });

  return {
    pinnedIds,
    isLoading,
    pin: pinMutation.mutate,
    unpin: unpinMutation.mutate,
  };
}
