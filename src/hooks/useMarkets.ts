import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MarketMode = "reactive" | "proactive";
export type MarketTier = 1 | 2 | 3;

export type ChecklistItem = { id: string; label: string; done: boolean };

export type ThirdPartyReviewStatus =
  | "accepted"
  | "accepted_with_restrictions"
  | "not_offered"
  | "unknown";

export type EntryStep = { step: string; detail?: string; source_url?: string };

export type MarketIntel = {
  why_it_matters?: string;
  requirements?: string;
  key_contacts?: string;
  competitive_landscape?: string;
  fee_structure?: string;
  /** Legacy: prose string. New: ordered structured steps. Renderer handles both. */
  entry_steps?: string | EntryStep[];
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
  /** Optional link to a permit_playbooks row. A service can exist without a playbook;
   *  the row surfaces a "Draft playbook" affordance when this is unset. */
  playbook_id?: string | null;
  /** Verification gate — the flywheel spine. When set, downstream consumers
   *  (proposals, PM briefs, Beacon) may treat this service as authoritative.
   *  Set by (a) explicit human click on "Mark verified", or
   *  (b) auto-flip when the linked playbook is fully human-verified AND suggested_fee is non-empty.
   *  Cleared when the underlying data changes (fee edited, playbook unlinked, offered toggled off). */
  verified_at?: string | null;   // ISO timestamp
  verified_by?: string | null;   // profile.id of the human who verified
  /** @deprecated Third-party plan review is now a market-level attribute, not per-service. */
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
      const { error: upErr } = await supabase.from("markets").update(patch as any).eq("id", market.id);
      if (upErr) throw upErr;
      return intel;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ---------------- Market Competitors ----------------

export type CompetitorScope = "solo" | "local" | "regional" | "national";
export type CompetitorPricingModel = "flat" | "hourly" | "percent" | "mixed" | "unknown";

export type MarketCompetitor = {
  id: string;
  market_id: string;
  company_id: string;
  name: string;
  url: string | null;
  scope: CompetitorScope;
  pricing_text: string | null;
  pricing_model: CompetitorPricingModel;
  source_url: string | null;
  signal_notes: string | null;
  research_model: string | null;
  research_run_id: string | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ParsedCompetitor = {
  name: string;
  url?: string;
  scope?: CompetitorScope;
  pricing_text?: string;
  pricing_model?: CompetitorPricingModel;
  source_url?: string;
  signal_notes?: string;
};

const competitorsKey = (marketId: string) => ["market_competitors", marketId] as const;

export function useMarketCompetitors(marketId: string | undefined) {
  return useQuery({
    enabled: !!marketId,
    queryKey: competitorsKey(marketId ?? ""),
    queryFn: async (): Promise<MarketCompetitor[]> => {
      const { data, error } = await supabase
        .from("market_competitors")
        .select("*")
        .eq("market_id", marketId!)
        .order("verified_at", { ascending: false, nullsFirst: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MarketCompetitor[];
    },
  });
}

function invalidateCompetitors(qc: ReturnType<typeof useQueryClient>, marketId: string) {
  qc.invalidateQueries({ queryKey: competitorsKey(marketId) });
  qc.invalidateQueries({ queryKey: KEY });
}

export function useAddMarketCompetitor() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<MarketCompetitor> & { market_id: string; name: string }) => {
      if (!profile?.company_id) throw new Error("No company");
      const { data, error } = await supabase
        .from("market_competitors")
        .insert({
          market_id: input.market_id,
          company_id: profile.company_id,
          name: input.name,
          url: input.url ?? null,
          scope: (input.scope ?? "local") as CompetitorScope,
          pricing_text: input.pricing_text ?? null,
          pricing_model: (input.pricing_model ?? "unknown") as CompetitorPricingModel,
          source_url: input.source_url ?? null,
          signal_notes: input.signal_notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row: any) => invalidateCompetitors(qc, row.market_id),
  });
}

export function useUpdateMarketCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, market_id, ...patch }: Partial<MarketCompetitor> & { id: string; market_id: string }) => {
      const payload: Record<string, any> = { ...patch };
      delete payload.created_at;
      delete payload.updated_at;
      delete payload.company_id;
      const { data, error } = await supabase
        .from("market_competitors")
        .update(payload as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_row, vars) => invalidateCompetitors(qc, vars.market_id),
  });
}

export function useVerifyMarketCompetitor() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async ({ id, market_id, verified }: { id: string; market_id: string; verified: boolean }) => {
      const { error } = await supabase
        .from("market_competitors")
        .update({
          verified_at: verified ? new Date().toISOString() : null,
          verified_by: verified ? profile?.id ?? null : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => invalidateCompetitors(qc, vars.market_id),
  });
}

export function useDeleteMarketCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, market_id }: { id: string; market_id: string }) => {
      const { error } = await supabase.from("market_competitors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => invalidateCompetitors(qc, vars.market_id),
  });
}

export function useImportMarketCompetitors() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async ({
      marketId,
      rows,
      research_model,
    }: {
      marketId: string;
      rows: ParsedCompetitor[];
      research_model?: string;
    }): Promise<{ inserted: number; skipped: number }> => {
      if (!profile?.company_id) throw new Error("No company");
      const clean = rows.filter((r) => (r.name ?? "").trim().length > 0);
      const skipped = rows.length - clean.length;
      if (clean.length === 0) return { inserted: 0, skipped };
      const runId = (crypto as any).randomUUID?.() ?? null;
      const validScopes: CompetitorScope[] = ["solo", "local", "regional", "national"];
      const validModels: CompetitorPricingModel[] = ["flat", "hourly", "percent", "mixed", "unknown"];
      const payload = clean.map((r) => ({
        market_id: marketId,
        company_id: profile.company_id!,
        name: r.name.trim(),
        url: r.url?.trim() || null,
        scope: (validScopes.includes(r.scope as CompetitorScope) ? r.scope : "local") as CompetitorScope,
        pricing_text: r.pricing_text?.trim() || null,
        pricing_model: (validModels.includes(r.pricing_model as CompetitorPricingModel)
          ? r.pricing_model
          : "unknown") as CompetitorPricingModel,
        source_url: r.source_url?.trim() || null,
        signal_notes: r.signal_notes?.trim() || null,
        research_model: research_model ?? null,
        research_run_id: runId,
      }));
      const { error } = await supabase.from("market_competitors").insert(payload);
      if (error) throw error;
      return { inserted: payload.length, skipped };
    },
    onSuccess: (_r, vars) => invalidateCompetitors(qc, vars.marketId),
  });
}
