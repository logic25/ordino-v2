-- Jurisdiction-aware Beacon retrieval — canonical registry plumbing.
--
-- Beacon's Pinecone corpus is 100% jurisdiction-tagged (as of 2026-08-12) and its retrieval
-- filter is an EXACT match ($eq). Ordino resolves a jurisdiction KEY to the exact corpus tag
-- string via the canonical registry in src/lib/jurisdictions.ts. These columns store the KEY
-- (e.g. 'NYC', 'FAIRFAX_VA', 'SPRING_VALLEY_NY', 'NYS', 'NYC_NYS_OVERLAP') — never the raw tag.
--
-- Resolution order at the Beacon boundary: project/property jurisdiction ?? company default ?? NYC.
--
-- NOTE (migration drift): Lovable does NOT auto-apply hand-authored SQL migrations committed via
-- Git. Manny/Hugo must run this in the Supabase SQL editor, then regenerate types.ts.

-- Company-level default (nullable; app falls back to 'NYC' when null).
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS default_jurisdiction text;

-- Project-level override (nullable; falls back to the company default, then 'NYC').
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS jurisdiction text;

-- Property-level override (nullable; same fallback chain). Column added now so the data model
-- is complete; wiring property.jurisdiction into Beacon context is a follow-up (see PR body).
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS jurisdiction text;

COMMENT ON COLUMN public.companies.default_jurisdiction IS
  'Canonical jurisdiction KEY (see src/lib/jurisdictions.ts), not the Beacon tag. Nullable; app falls back to NYC.';
COMMENT ON COLUMN public.projects.jurisdiction IS
  'Canonical jurisdiction KEY (see src/lib/jurisdictions.ts). Nullable; overrides company default for Beacon retrieval.';
COMMENT ON COLUMN public.properties.jurisdiction IS
  'Canonical jurisdiction KEY (see src/lib/jurisdictions.ts). Nullable; overrides company default for Beacon retrieval.';
