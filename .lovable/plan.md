# Fix "Why these architects?" — unify partner lookup + backfill data

## The problem in plain English

When you asked Beacon "do we have a good architect?", it gave you a list of *people* (Tom Bradley, Michael Siano, etc.) pulled loosely from the contacts list by job title. That answer included a structural engineer and a project director — not actually architects.

Meanwhile, the new partner system we just built searches a different list: *companies* flagged as "RFP Partners." On that list, Gensler and Lawrence Group aren't even marked as partners, and several firms have no trade type set — so the good answer never gets through.

Two lists, two answers, no one wins. We need to merge them and clean the data.

## Changes

### 1. Backfill existing data (one-time cleanup)

Run a data migration that:
- Sets `client_type` on firms by inferring from their contacts' titles. If a firm has any contact with title containing "Architect", "RA", or "AIA" → `client_type = 'Architect'`. Same logic for Engineer, GC, Expeditor.
- Sets `is_rfp_partner = true` on every firm that already has at least one contact with an architect/engineer/GC title AND appears on a past project (`architect_company_name` or `gc_company_name` match). This catches Gensler, Lawrence Group, Thornton Tomasetti, etc.
- Logs every change so we can review what got flipped.

Pre-production, so safe to run broadly. We'll show you the diff before committing.

### 2. `beacon-data-proxy` — return firms WITH their people

For a trade query like "architect":
- Pull firms from `clients` (RFP partners, type matches)
- Pull individual contacts from `client_contacts` whose `title` matches a curated synonym list for that trade (Architect/RA/Registered Architect/AIA for architects — NOT Engineer or Project Director)
- Group contacts under their parent firm in the response
- Attach a `match_reason` per row: "RFP partner — Architect", "Contact title: RA", "Past project: 123 Main St"

So the answer becomes:
```
Gensler (RFP partner, 3 past projects together)
  • Tom Bradley — Senior Architect
FXCollaborative Architects (RFP partner)
  • [primary contact]
```

### 3. `beacon-data-proxy` — surface gaps instead of hiding them

If a firm has matching contacts but `is_rfp_partner = false`, include it in a `suggested_partners` array with: "Lawrence Group has 1 architect contact but isn't an RFP partner — add?"

### 4. `beacon-proxy` — render the new shape

Update the vendor card to show firm → nested contacts → match reason chip, plus a "Suggested to add" footer.

### 5. Single source-of-truth synonym map

```
architect: Architect, RA, Registered Architect, Architectural, AIA, RA PM
engineer:  Engineer, PE, Professional Engineer, Structural, MEP
gc:        GC, General Contractor, Superintendent
expeditor: Expeditor, Expediter, Filing Rep
```
Used by both the contacts-title filter and the trade-intent regex in `beacon-proxy`. Stops a Structural Engineer from showing up under "architect" again.

## Out of scope

- Review/responsiveness scoring (already done, no change)
- Monetization (already on roadmap)

## Technical notes

- Backfill is a `supabase--insert` UPDATE pass, idempotent, reversible via the change log
- `client_contacts.client_id` join is cheap
- Match-reason computed server-side, no LLM judgement
- Cap contacts-per-firm in response at 3 to keep cards readable
