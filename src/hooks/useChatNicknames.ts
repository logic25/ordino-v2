import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useChatNicknames() {
  const qc = useQueryClient();

  const { data: nicknames = new Map<string, string>(), isLoading } = useQuery({
    queryKey: ["chat-nicknames"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return new Map<string, string>();
      const { data } = await supabase
        .from("chat_space_nicknames" as any)
        .select("space_id, nickname")
        .eq("user_id", user.id);
      const map = new Map<string, string>();
      for (const r of (data || []) as any[]) {
        map.set(r.space_id, r.nickname);
      }
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });

  const setNickname = useMutation({
    mutationFn: async ({ spaceId, nickname }: { spaceId: string; nickname: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("chat_space_nicknames" as any)
        .upsert({ user_id: user.id, space_id: spaceId, nickname, updated_at: new Date().toISOString() } as any, {
          onConflict: "user_id,space_id",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-nicknames"] });
      toast({ title: "Chat renamed" });
    },
  });

  const removeNickname = useMutation({
    mutationFn: async (spaceId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("chat_space_nicknames" as any)
        .delete()
        .eq("user_id", user.id)
        .eq("space_id", spaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-nicknames"] });
    },
  });

  return {
    nicknames,
    isLoading,
    setNickname: setNickname.mutate,
    removeNickname: removeNickname.mutate,
  };
}
