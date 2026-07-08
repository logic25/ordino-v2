## Reframe: Peer review is a jurisdiction attribute, not a service

You're right. "Peer review" (a.k.a. third-party plan review / expedited plan review) is a **program the jurisdiction offers** — some AHJs allow a licensed outside reviewer to approve plans in place of the county, some don't. It's a property of the market, not of each service line. Fairfax allows it; NYC DOB has its own PW1 examiner track with no third-party equivalent; many small towns don't offer it at all.

### What changes

**1. Add jurisdiction-level fields on `markets`**
- `third_party_review_allowed`: `'yes' | 'no' | 'unknown'` (default `unknown`)
- `third_party_review_notes`: freeform (e.g. "Fairfax accepts reviewers on published list — Faisant, ECS, Bowman. Expedited Plan Review program.")
- `third_party_review_source_url`: link to the jurisdiction's program page

Shown on the Market detail as a small badge near the header:
- ✅ Third-party plan review accepted
- ❌ Not accepted
- ❓ Unknown — needs research

**2. Simplify the Services catalog**
Remove `peer_review_required` from `MarketService`. The service catalog goes back to being just "what we offer + what we charge." Whether GLE can *use* a third-party reviewer to speed up any given filing is answered once, at the market level.

The "Peer Review" category rows (Structural / Fire / MEP Peer Review) in the seed catalog get dropped — those aren't services we sell today, and if we ever do, they belong in a separate "GLE can act as third-party reviewer" capability, not in the per-market permit fee list.

**3. AI research prompt update**
`research-market` edge function starts asking: "Does this jurisdiction accept third-party / peer plan review? If yes, name the program and link the page. If unknown, say so." Result populates the three new fields automatically on Research with AI.

**4. Migration notes**
Existing markets: default `third_party_review_allowed = 'unknown'`. Existing services keep working; the `peer_review_required` field is left in the type as optional/ignored so old rows don't break, and the seed catalog stops setting it. No data loss.

### Files touched
- migration: add 3 columns to `markets`
- `src/hooks/useMarkets.ts`: add fields to `Market` type, drop `peer_review_required` from `MarketService` (or mark deprecated)
- `src/components/markets/MarketServicesSection.tsx`: remove peer-review seed rows + the ⚠️ badge logic
- new `src/components/markets/MarketPeerReviewBadge.tsx` (or inline in `Markets.tsx` header)
- `src/pages/Markets.tsx`: render the badge + editable "Third-party plan review" block
- `supabase/functions/research-market/index.ts`: extend schema + prompt

### Open question before I build
Do you want the field to be a simple **yes / no / unknown** dropdown, or a richer status like **`accepted` / `accepted_with_restrictions` / `not_offered` / `unknown`**? Fairfax is a clean "accepted." Some jurisdictions only allow it for certain occupancy types, which is where the "with restrictions" state earns its keep.