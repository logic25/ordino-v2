import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MarketMode = "reactive" | "proactive";
export type MarketTier = 1 | 2 | 3;

export type ChecklistItem = { id: string; label: string; done: boolean };

export type ThirdPartyReviewStatus = "yes" | "no" | "unknown";

export type MarketIntel = {
  why_it_matters?: string;
  requirements?: string;
  key_contacts?: string;
  competitive_landscape?: string;
  fee_structure?: string;
  entry_steps?: string;
  reference_links?: string;
  third_party_review?: string; // AI narrative describing the jurisdiction's program (if any)
  warning?: string;
  raw?: string;
};
export type MarketService = {
  id: string;
  category: string;              // e.g. "Building", "Trade", "Site/Land Development"
  label: string;                 // e.g. "Commercial Tenant Fit-out (Alteration)"
  offered: boolean;              // are we currently offering this service in this market?
  suggested_fee: string;         // e.g. "$2,500–$6,000 flat"
  county_fee_note?: string;      // e.g. "Min $150 + valuation-based"
  /** @deprecated Third-party plan review is now a market-level attribute, not per-service. Kept for backward compat with existing rows. */
  peer_review_required?: boolean;
  note?: string;                 // freeform note
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
  services: MarketService[];
  third_party_review_allowed: ThirdPartyReviewStatus;
  third_party_review_notes: string | null;
  third_party_review_source_url: string | null;
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
        .update(payload as any)
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
      const resp = (data ?? {}) as Record<string, any>;
      const intel: MarketIntel = {
        why_it_matters: resp.why_it_matters,
        requirements: resp.requirements,
        key_contacts: resp.key_contacts,
        competitive_landscape: resp.competitive_landscape,
        fee_structure: resp.fee_structure,
        entry_steps: resp.entry_steps,
        reference_links: resp.reference_links,
        third_party_review: resp.third_party_review_notes,
        warning: resp.warning,
        raw: resp.raw,
      };
      const patch: Record<string, any> = { intel };
      if (resp.third_party_review_allowed) {
        patch.third_party_review_allowed = resp.third_party_review_allowed;
      }
      if (typeof resp.third_party_review_notes === "string" && resp.third_party_review_notes.trim()) {
        patch.third_party_review_notes = resp.third_party_review_notes;
      }
      if (typeof resp.third_party_review_source_url === "string" && resp.third_party_review_source_url.trim()) {
        patch.third_party_review_source_url = resp.third_party_review_source_url;
      }
      const { error: upErr } = await supabase.from("markets").update(patch).eq("id", market.id);
      if (upErr) throw upErr;
      return intel;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
