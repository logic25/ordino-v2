import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MarketMode = "reactive" | "proactive";
export type MarketTier = 1 | 2 | 3;

export type ChecklistItem = { id: string; label: string; done: boolean };

export type MarketIntel = {
  why_it_matters?: string;
  requirements?: string;
  key_contacts?: string;
  competitive_landscape?: string;
  warning?: string;
  raw?: string;
};

export type Market = {
  id: string;
  company_id: string;
  name: string;
  state: string;
  tier: MarketTier;
  mode: MarketMode;
  operational_score: number | null;
  commercial_score: number | null;
  notes: string | null;
  checklist: ChecklistItem[];
  intel: MarketIntel;
  created_at: string;
  updated_at: string;
};

const KEY = ["markets"] as const;

export function useMarkets() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Market[]> => {
      const { data, error } = await supabase
        .from("markets")
        .select("*")
        .order("tier", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Market[];
    },
  });
}

export function useCreateMarket() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<Market> & { name: string; tier: MarketTier }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { data, error } = await supabase
        .from("markets")
        .insert({
          company_id: profile.company_id,
          name: input.name,
          state: input.state ?? "NY",
          tier: input.tier,
          mode: input.mode ?? "reactive",
          operational_score: input.operational_score ?? null,
          commercial_score: input.commercial_score ?? null,
          notes: input.notes ?? null,
          checklist: (input.checklist ?? []) as any,
          intel: (input.intel ?? {}) as any,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateMarket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Market> & { id: string }) => {
      const payload: Record<string, any> = { ...patch };
      delete payload.created_at;
      delete payload.updated_at;
      delete payload.company_id;
      const { data, error } = await supabase
        .from("markets")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteMarket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("markets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useResearchMarket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (market: Pick<Market, "id" | "name" | "state" | "tier">) => {
      const { data, error } = await supabase.functions.invoke("research-market", {
        body: { market_name: market.name, state: market.state, tier: market.tier },
      });
      if (error) throw error;
      const intel = (data ?? {}) as MarketIntel;
      const { error: upErr } = await supabase
        .from("markets")
        .update({ intel: intel as any })
        .eq("id", market.id);
      if (upErr) throw upErr;
      return intel;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
