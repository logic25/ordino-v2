# Markets Page — Replace Jurisdictions

Drops the existing `/bd/markets` page and `jurisdictions` table and ships a spec-aligned `markets` table at `/markets`.

## 1. Database (single migration)

- `DROP TABLE public.jurisdictions CASCADE;`
- `CREATE TABLE public.markets`:
  - `id uuid pk default gen_random_uuid()`
  - `company_id uuid not null references companies(id) on delete cascade`
  - `name text not null`
  - `state text not null default 'NY'`
  - `tier smallint not null check (tier in (1,2,3))`
  - `mode text not null default 'reactive' check (mode in ('reactive','proactive'))`
  - `operational_score smallint check (operational_score between 0 and 100)`
  - `commercial_score smallint check (commercial_score between 0 and 100)`
  - `notes text`
  - `checklist jsonb not null default '[]'`
  - `intel jsonb not null default '{}'`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- `CREATE UNIQUE INDEX markets_company_name_uniq ON public.markets (company_id, name);`
- `CREATE INDEX markets_company_tier_idx ON public.markets (company_id, tier);`
- GRANT select/insert/update/delete to `authenticated`; ALL to `service_role`.
- RLS enabled; policy `FOR ALL USING (public.is_company_member(company_id))`.
- `updated_at` trigger reuses the existing `public.update_updated_at_column()` (the same function `bd_events` uses — verified).
- Seed via `DO $$` loop over `companies.id`, inserting the 5 starter rows (Manhattan T1 Proactive 90/95, Brooklyn T1 Proactive 90/80, Nassau T1 Reactive 60/30, Westchester T2 Reactive 40/20, Jersey City NJ T2 Reactive 30/15) with `ON CONFLICT (company_id, name) DO NOTHING`.

## 2. Frontend

Delete:
- `src/pages/bd/BdMarkets.tsx`
- `src/hooks/useJurisdictions.ts`
- `BdMarkets` lazy import and `/bd/markets` route in `src/App.tsx`
- `/bd/markets` entry in `src/components/layout/AppSidebar.tsx`

Create:
- `src/hooks/useMarkets.ts` — `useMarkets`, `useCreateMarket`, `useUpdateMarket`, `useDeleteMarket`, `useResearchMarket` (invokes the edge function, writes `intel` back).
- `src/pages/Markets.tsx` — header (`Markets` h1 + `+ Add Market`), `Overview` / `Details` tabs.
  - Overview: 3 tier summary cards (count, proactive, reactive) + table (Market, State, Tier, Mode badge — emerald for Proactive, muted for Reactive, Op Score, Comm Score, Actions).
  - Details: per-market card with toggleable checklist (persists full array), notes editor, intel sections (`why_it_matters`, `requirements`, `key_contacts`, `competitive_landscape`), and a `Research with AI` button.
- `src/components/markets/AddEditMarketDialog.tsx` — name, state select (default NY), tier select with tooltip, mode toggle with tooltip, two 0–100 sliders each with tooltip, notes textarea.

Wire-up:
- Route: `<Route path="/markets" element={<ProtectedRoute><Markets /></ProtectedRoute>} />` via `lazyWithRetry`.
- Sidebar: add `Markets` (icon `Globe2`) under Business Development, below BD Events.

## 3. Edge function — `research-market`

New `supabase/functions/research-market/index.ts`, mirroring `draft-event-strategy`:
- CORS, default JWT verification, Zod-validated `{ market_name, state, tier }`.
- Calls Lovable AI Gateway with `google/gemini-2.5-flash`, prompting for a JSON object with `why_it_matters` (2–3 sentences), `requirements`, `key_contacts`, `competitive_landscape`.
- Resilient JSON parse: on failure return `{ warning, raw }` (per project rule); never crash.
- Returns the intel blob; the client persists it to `markets.intel`.

## 4. Changelog

Append to the same migration, using the exact column set the existing seed migrations use (verified across `20260606160200`, `20260611172809`, `20260611183329`, `20260611231819`):

```sql
INSERT INTO public.changelog_entries (company_id, date, title, description, tag)
SELECT id, CURRENT_DATE, 'Markets page',
       'Markets page rebuilt with tier/mode model and AI research',
       'feature'
FROM public.companies;
```

`created_by` is nullable; omitted to match prior inserts. RLS is bypassed during migration execution.

## 5. Verification (post-ship)

1. `SELECT id, name, tier, mode, operational_score FROM markets LIMIT 5;`
2. `/markets` renders the 5 seed rows.
3. Add Market dialog shows all 4 tooltip icons (Tier, Mode, Op, Comm).
4. Details tab shows `Research with AI` button per market.

## Technical notes

- `useResearchMarket` uses `supabase.functions.invoke('research-market', { body })`; JWT is attached automatically.
- Checklist edits write the full `checklist` array back (small payloads — no RPC needed).
- Mode badge classes use semantic tokens (`bg-emerald-100 text-emerald-700` vs `bg-muted text-muted-foreground`).
- Confirmed safe: `jurisdictions` is only referenced by the two files being deleted; `clients.licensed_jurisdictions` is an unrelated `text[]` column and is untouched.

## Out of scope (separate follow-up)

The three dashboard questions at the end of your earlier message (AR 30-day trend arrows on the KPI card; whether Sales Health includes leads or only proposals; clickable Proposal-Conversion KPI that opens a detail modal) are dashboard work, not Markets. I'll scope those in a separate plan after this ships unless you want them folded in now.
