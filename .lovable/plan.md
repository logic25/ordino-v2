# Market competitors & pricing — capture + verify

## Goal
Add a structured, verifiable competitor + pricing layer to each market. Same flywheel contract as `market_services`: AI/imported rows land unverified, humans click to verify, any edit auto-clears verification. No downstream consumers (proposals, PM briefs, Beacon) in this pass — capture only, but stored in a shape those consumers can query later.

## Scope
In: `market_competitors` table + RLS + GRANTs, `market_readiness` view extension, hook layer, new `MarketCompetitorsSection.tsx` (table, manual add/edit, verify, bulk import via JSON/CSV paste), wired below Services in `Markets.tsx`.
Out: proposal/PM/Beacon read-through, cross-market dedupe, pricing analytics/normalization, auto-scraping (import is manual paste of research the user runs elsewhere).

## Data model

### New table `public.market_competitors`
| column | type | notes |
|---|---|---|
| `id` | uuid PK, default `gen_random_uuid()` | |
| `market_id` | uuid FK → `markets(id)` ON DELETE CASCADE | indexed |
| `company_id` | uuid, NOT NULL | denormalized from parent market for RLS parity with `market_services` |
| `name` | text NOT NULL | competitor firm name |
| `url` | text | firm website |
| `scope` | enum `competitor_scope`: `solo \| local \| regional \| national` | default `local` |
| `pricing_text` | text | freeform observed pricing |
| `pricing_model` | enum `competitor_pricing_model`: `flat \| hourly \| percent \| mixed \| unknown` | default `unknown` |
| `source_url` | text | where the name/pricing was found |
| `signal_notes` | text | forum/review/reputation commentary |
| `research_model` | text | e.g. `sonar`, `gemini-2.5-pro` |
| `research_run_id` | uuid | groups rows from one import/research call |
| `verified_at` | timestamptz null | verification gate |
| `verified_by` | uuid null | profile id |
| `created_at`, `updated_at` | timestamptz | standard, with update trigger |

Indexes: `(market_id)`, `(company_id)`, partial `(market_id) WHERE verified_at IS NOT NULL`.

### RLS + GRANTs (mirrors `market_services`)
```
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_competitors TO authenticated;
GRANT ALL ON public.market_competitors TO service_role;
ALTER TABLE public.market_competitors ENABLE ROW LEVEL SECURITY;
```
Policies (all scoped to caller's `company_id` via existing `get_user_company_id(auth.uid())` helper — same pattern used by `market_services`):
- SELECT: `company_id = get_user_company_id(auth.uid())`
- INSERT: `WITH CHECK (company_id = get_user_company_id(auth.uid()))`
- UPDATE: `USING` + `WITH CHECK` same condition
- DELETE: same

Before writing the migration I'll run the `pg_policies` lookup on `market_services` to copy the exact policy shape/names in use today, then append the standard `pg_policies` verification query at the end of the migration (per `docs/security-migrations.md`).

### Auto-clear verification trigger
BEFORE UPDATE trigger: if any of `name, url, scope, pricing_text, pricing_model, source_url` changed AND the row was previously verified AND the update did not itself set `verified_at`, then null `verified_at`/`verified_by`. Matches how `MarketServicesSection` clears verification on edit.

### `market_readiness` view extension
Add per market:
- `competitors_total` — `count(*)`
- `competitors_verified` — `count(*) FILTER (WHERE verified_at IS NOT NULL)`

Existing columns untouched. Overview page can later show a "competitive intel: X/Y" chip without a new query.

## Hook layer — `src/hooks/useMarkets.ts`

New exports:
- `MarketCompetitor` type mirroring the table
- `useMarketCompetitors(marketId)` → `useQuery` keyed `["market_competitors", marketId]`
- `useAddMarketCompetitor()` — single-row insert, `verified_at: null`
- `useUpdateMarketCompetitor()` — patch; RPC not needed, DB trigger clears verification
- `useVerifyMarketCompetitor()` — sets `verified_at = now()`, `verified_by = profile.id`
- `useUnverifyMarketCompetitor()` — nulls both
- `useDeleteMarketCompetitor()`
- `useImportMarketCompetitors()` — takes `{ marketId, rows: ParsedCompetitor[], research_model? }`, generates one `research_run_id` uuid client-side, bulk `.insert(rows.map(...))` with `verified_at: null`. Returns `{ inserted, skipped }` (skips rows missing `name`).

All mutations invalidate `["market_competitors", marketId]` and `["markets"]` (so readiness counts refresh).

## UI — `src/components/markets/MarketCompetitorsSection.tsx` (new)

Layout mirrors `MarketServicesSection`:

- **Header row:** "Competitors & Pricing" title, right side shows `X verified / Y total`, buttons: `Add competitor`, `Import`.
- **Table columns:** Name (linked to `url` if present, opens new tab), Scope badge, Pricing text, Pricing model badge, Verified badge (`ShieldCheck` when verified, muted "Unverified" otherwise), Source link icon (`ExternalLink` → `source_url`), Actions (edit / verify-toggle / delete).
- **Add / Edit dialog:** shadcn Dialog with fields `name` (required), `url`, `scope` Select, `pricing_text` textarea, `pricing_model` Select, `source_url`, `signal_notes` textarea.
- **Import dialog:** shadcn Dialog with:
  - Tabs: `JSON` | `CSV`
  - Textarea for paste
  - Parse preview table (first 5 rows) with per-row validation ("missing name" errors flagged, row skipped)
  - "Import N rows" button → calls `useImportMarketCompetitors`, toast on success ("N drafted, review and verify")
  - Accepted JSON: array of `{ name, url?, scope?, pricing_text?, pricing_model?, source_url?, signal_notes? }`
  - Accepted CSV: header row required, columns match the JSON keys; parsed with a tiny built-in splitter (quote-aware) — no new dependency
  - Unknown enum values fall back to defaults (`scope: local`, `pricing_model: unknown`) and are flagged in the preview
- **Verify affordance:** row-level `ShieldCheck` button toggles verify/unverify. Editing any authoritative field also auto-clears via the DB trigger — the UI re-reads state after mutation so the badge flips without extra client logic.
- **Empty state:** "No competitors captured yet. Add manually or paste research from Perplexity/Claude."

## Wiring — `src/pages/Markets.tsx`

In `MarketDetailsCard`, add a new `<div className="border-t pt-3"><MarketCompetitorsSection market={market} /></div>` immediately below the existing Services section and above AI Research.

No other layout changes.

## Files touched
- `supabase/migrations/<new>.sql` — enums, table, GRANTs, RLS, trigger, view extension, verification `pg_policies` query
- `src/integrations/supabase/types.ts` — regenerated post-migration
- `src/hooks/useMarkets.ts` — types + 7 new exports listed above
- `src/components/markets/MarketCompetitorsSection.tsx` — new
- `src/pages/Markets.tsx` — one-line wire-in

## Migration order
1. Migration (table + enums + RLS + trigger + view). Approved and run first so types regenerate.
2. Hook layer changes.
3. New section component.
4. Wire into `Markets.tsx`.

## Open decisions before I build
1. **CSV parser:** built-in mini quote-aware splitter (no dep) vs. add `papaparse` (~7 KB gz). Default: built-in — the import format is user-controlled and small. OK?
2. **Scope of "Import" replace vs append:** append-only (never touches existing rows) is my default so re-imports don't nuke human edits. Confirm — or do you want an "Import (replace unverified only)" option too?
3. **Delete cascade on market:** competitors get deleted when the parent market is deleted (ON DELETE CASCADE). Consistent with services. OK?