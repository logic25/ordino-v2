# Two fixes this pass — skip market seeding for now

## 1. Portal shows client but zero projects

**Root cause (confirmed in DB):** `projects` has 63 rows, 52 linked via `client_id`, **0 via `client_org_id`**. `usePortalProjects` filters `.not("client_org_id", "is", null)`, so it always returns empty. `client_orgs` already has a `client_id` column linking each org to a customer, so the join exists — just isn't used.

**Fix:** Rewrite `usePortalProjects` / `usePortalProject` in `src/hooks/usePortal.ts`:

1. Load the current user's `client_org_memberships` → get their `client_org_id`s.
2. Load those `client_orgs` → collect the linked `client_id`s.
3. Query `projects` where `client_id IN (…)` OR `building_owner_id IN (…)` OR `client_org_id IN (…)` (keep the org path for anything already migrated).
4. Internal staff with zero memberships keep the existing "see all" fallback.

No schema change. Existing RLS on `projects` handles company scoping.

## 3. Restructure `research-market` so results are tables, not prose

Today the edge function returns 6 prose blobs — that's why the AI research feels light. Switch the tool schema to return structured rows for the two things that actually feed the UI:

**New/changed fields on the tool schema:**
- `suggested_services[]` — `{ service_name, price_low, price_typical, price_high, unit ("per_filing" | "per_hour" | "pct_of_construction_cost" | "flat"), basis_notes, confidence ("low"|"medium"|"high"), source_url }`
- `entry_steps[]` — ordered `{ step, detail, source_url }` (was one paragraph)
- Keep prose for `why_it_matters`, `requirements`, `key_contacts`, `competitive_landscape` — those genuinely are narrative
- Keep the third-party review guardrail exactly as-is (unsourced "accepted" → "unknown")
- Bump model instructions: require a `source_url` on every service row or drop `confidence` to `"low"`

**Frontend wiring:**
- `useMarkets.ts` — add `useDraftServicesFromAI(marketId)` mutation that takes the returned `suggested_services[]` and bulk-inserts them into `market_services` as unverified drafts (`verified_at = null`, `source = 'ai_research'`).
- `MarketServicesSection.tsx` — add a "Research pricing with AI" button next to the existing add-service action; on success, invalidate the services query and toast "N draft rows added — verify each before trusting."
- `Markets.tsx` detail — render `entry_steps` as an ordered checklist instead of a paragraph.

Everything AI-produced lands as **unverified drafts** — your existing verify gate is unchanged.

## Answer to your side-question

> "am I missing anything? anyone in my company [should be able to] see if it's worth exploring, what it takes, and what we can charge"

The Markets detail page layout already answers that question (Why it matters / Requirements / Third-party review / Services & pricing / Competitors). The gap is *depth* of the Services/Pricing section — fix #3 closes that by making AI output real rows a teammate can scan in five seconds instead of a wall of prose.

## Out of scope this pass

- Seeding the 18 markets from your prior research doc (deferred per your request)
- Competitor AI research
- Cross-market dedupe / analytics

## Files touched

- `src/hooks/usePortal.ts` — portal project query rewrite
- `supabase/functions/research-market/index.ts` — tool schema restructure
- `src/hooks/useMarkets.ts` — `useDraftServicesFromAI` mutation
- `src/components/markets/MarketServicesSection.tsx` — AI research button + draft insert
- `src/pages/Markets.tsx` — render `entry_steps` as ordered list
