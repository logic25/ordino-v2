/**
 * Canonical jurisdiction registry — the SINGLE source of truth for the exact
 * jurisdiction tag strings Beacon's retrieval filter matches against.
 *
 * Beacon's Pinecone corpus is 100% jurisdiction-tagged (as of 2026-08-12) and the
 * retrieval filter is an EXACT match ($eq). If Ordino sends anything other than the
 * exact tag string below, Beacon silently returns zero KB context. Never inline these
 * strings anywhere else — import from here so the exact-string contract lives in one place.
 *
 * `tag`   — the literal string stored on the Pinecone vectors (do NOT edit without the corpus).
 * `label` — human-facing display name.
 * `state` — USPS state code.
 *
 * Keys (JurisdictionKey) are what we persist in the DB (e.g. companies.default_jurisdiction,
 * projects.jurisdiction) and thread through the app — never persist the raw tag.
 */
export const JURISDICTIONS = {
  NYC: { tag: "NYC", label: "New York City", state: "NY" },
  NYS: { tag: "New York State", label: "New York State", state: "NY" },
  /**
   * Overlap bucket for New York STATE law (e.g. MDL, RPAPL) that also governs NYC
   * buildings. Docs that apply to both are tagged with this exact string in the corpus.
   * FOLLOW-UP (Beacon-side, NOT this PR): Beacon retrieval should eventually filter with
   * $in [requestedTag, "NYC / New York State"] so overlap content surfaces for both NYC
   * and NYS queries. Until then this is a distinct, exact-match bucket like the others.
   */
  NYC_NYS_OVERLAP: { tag: "NYC / New York State", label: "NYC + New York State", state: "NY" },
  FAIRFAX_VA: { tag: "Fairfax County, VA", label: "Fairfax County", state: "VA" },
  SPRING_VALLEY_NY: { tag: "Spring Valley, NY", label: "Spring Valley", state: "NY" },
} as const;

export type JurisdictionKey = keyof typeof JURISDICTIONS;

/** The safe default when no jurisdiction is resolvable. Every code path degrades to this, never to an invalid string. */
export const DEFAULT_JURISDICTION_KEY: JurisdictionKey = "NYC";

/** Resolve a registry key to its exact Beacon tag string. */
export const getJurisdictionTag = (key: JurisdictionKey): string => JURISDICTIONS[key].tag;

/** Type guard: is this arbitrary value a known jurisdiction key? */
export function isJurisdictionKey(value: unknown): value is JurisdictionKey {
  return typeof value === "string" && value in JURISDICTIONS;
}

/**
 * Resolve any candidate (project/property key, company-default key, or unknown) to an
 * exact Beacon tag. Unknown/missing values degrade to NYC — never to an invalid string.
 */
export function resolveJurisdictionTag(candidate?: unknown): string {
  return getJurisdictionTag(isJurisdictionKey(candidate) ? candidate : DEFAULT_JURISDICTION_KEY);
}
