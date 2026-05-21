# Enrich Partner Recommendations (Beacon + Companies UI)

Goal: when anyone asks Beacon "do we have a good [architect/plumber/MEP/etc.]?" — or browses Companies — they see meaningful signals to recommend the right partner. Works for every trade, not just architects.

Since all users will have Gmail connected post-launch, responsiveness from `emails` is a reliable signal.

## What each partner card will show

- **Avg rating** + 1–2 recent review snippets (from existing `reviews`)
- **Past projects together**: count + most recent address + month
- **Responsiveness**: median email reply time over last 90 days from `emails` table, bucketed as Fast (≤4h) / Same-day (≤24h) / Slow (≤72h) / Unresponsive. Falls back to "Not enough data" when <3 threads.
- **Specialties**: top-3 inferred from `proposal_items.disciplines`, overridable by manual tags
- **Manual tags + internal notes** (free-text, never exposed on RFPs)
- **Borough / territory**

## Changes

### 1. Migration — manual override fields on `clients`
- `specialty_tags text[]` — manual chips (e.g. "landmarks", "Brooklyn", "hospitality")
- `internal_notes text` — private notes, never leaves the app

### 2. `beacon-data-proxy/index.ts` — enrich `vendor_lookup`
For each partner returned, compute and attach: rating avg + 2 recent snippets, past-projects count/address/month, responsiveness bucket + median hours, inferred specialties, manual tags, notes, borough. Cache 5 min per (company_id, type).

### 3. `beacon-proxy/index.ts` — broaden intent routing + richer card
- Expand trade-intent regex to catch plain phrasing: "do we have / who are our / any good / list our / got a / need a [trade]"
- Expand trade vocabulary: architect, engineer, expeditor, MEP, plumber, electrician, GC, landscape, fire protection, draftsman, consultant, surveyor, etc.
- Render the enriched fields in the response card

### 4. Companies UI — mirror the same data
- `ClientDialog.tsx` — inputs for specialty tags + internal notes
- `ClientTable.tsx` / `ClientDetailSheet.tsx` — show specialty chips, "X past jobs" badge, "Last worked: Mar 2026" line, responsiveness badge

## Technical notes

- Responsiveness query: group `emails` by `thread_id` where partner email is in `from_email`/`to_emails`, pair outbound → next inbound, take median delta over last 90 days. Skip threads with <2 messages.
- Inferred specialties: aggregate `proposal_items.disciplines` across proposals where this `client_id` is the partner; top 3 by frequency.
- Manual tags always win over inferred when both exist.
- Monetization (partner_referrals log, priority placement, verified tier) already logged to roadmap — out of scope here.