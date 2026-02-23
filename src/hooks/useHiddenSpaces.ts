import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useHiddenSpaces() {
  const qc = useQueryClient();

  const { data: hiddenIds = [], isLoading } = useQuery({
    queryKey: ["hidden-chat-spaces"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("hidden_chat_spaces" as any)
        .select("space_id")
        .eq("user_id", user.id);
      return (data || []).map((r: any) => r.space_id as string);
    },
    staleTime: 10 * 60 * 1000,
  });

  const hideMutation = useMutation({
    mutationFn: async (spaceId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("hidden_chat_spaces" as any)
        .insert({ user_id: user.id, space_id: spaceId } as any);
      if (error) throw error;
      return spaceId;
    },
    onSuccess: (spaceId) => {
      qc.invalidateQueries({ queryKey: ["hidden-chat-spaces"] });
      toast({
        title: "Chat hidden",
        description: "This conversation has been hidden from your sidebar.",
        action: (
          undefined // undo handled via unhide
        ),
      });
    },
  });

  const unhideMutation = useMutation({
    mutationFn: async (spaceId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("hidden_chat_spaces" as any)
        .delete()
        .eq("user_id", user.id)
        .eq("space_id", spaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hidden-chat-spaces"] });
    },
  });

  return {
    hiddenIds,
    isLoading,
    hide: hideMutation.mutate,
    unhide: unhideMutation.mutate,
  };
}
