# BD Lead Detail — Refinement Pass

Tightens the recent redesign based on your feedback. No data-model changes; one label rename and a small identity-card expansion.

## 1. Tone down the visual loudness

- **Drop Space Grotesk + DM Sans** for BD pages. Use the same font stack as the rest of Ordino (system/Inter — whatever the global `body` resolves to). Remove the BD-only Google Fonts `<link>` from `index.html`.
- **Bump up sizes** to match the app: section headers move from `text-[10px]` micro-caps to the standard Ordino label size (`text-xs font-medium uppercase tracking-wide text-slate-500`). Body text uses `text-sm`, values `text-base`.
- **Amber → match Ordino**: keep amber strictly as a small accent (pipeline active step, single icon hue, link hover). Remove:
  - the gold gradient on the "Next Follow-up" card → replace with a quiet white card, `border-slate-200`, with a small amber dot + `text-slate-900` heading
  - amber-700 uppercase subheaders → switch to slate
  - amber-tinted page background → return to Ordino's standard `bg-slate-50`
- Net effect: BD pages look like the rest of Ordino, just with the new editorial grid composition kept intact.

## 2. Subject vs Property (what's there today)

In the DB:
- `subject` — short topic line, captured in the modal with the placeholder *"e.g. Summons, Violation, New Building…"*
- `property_address` — the street address, used to deep-link into Properties

They map cleanly to your instinct: **rename `subject` → "Opportunity"** in the UI only (no migration). Placeholder becomes *"What's the work? (e.g. Façade LL11, New Building, Violation)"*. The Property field stays as the address.

## 3. Identity card — recommendation

Show the lead's origin story compactly, with comms living in the activity rail:

```
PRIMARY IDENTITY
Jane Doe • Property Manager
ACME Realty
jane@acme.com • (212) 555-0100

WHERE WE MET
In-person · Industry Mixer @ Javits  · Jun 4, 2026
First contact: 9 days ago

COMMUNICATIONS
3 emails · 1 call · last activity 2d ago      [Jump to thread →]
```

- Source line pulls `lead_source_type` + `event_name` + `created_at`
- Comms summary counts entries from `bd_activities` (filtered by type) — no new tables, no inline message bodies. The "Jump to thread →" anchors to the existing right-rail `BdActivityThread`.
- Keeps the identity card scannable; the full timeline stays where it already lives.

## 4. Out of scope (deferred)

- Camera/no-event capture UX
- `IN_PERSON` source enum migration
- Sidebar nav restructure

## Technical notes

- Files touched: `src/pages/bd/BdLeadDetail.tsx`, `src/index.css` (remove `.bd-scope` overrides), `index.html` (remove Google Fonts link), `src/components/bd/CaptureLeadModal.tsx` (relabel Subject→Opportunity).
- `LeadStageStepper.tsx` keeps the bar-segment layout but uses amber-600 only on the active segment, slate-200 elsewhere.
- Comms summary computed client-side from the already-fetched `bd_activities` — no new query.
- Changelog entry: "Refined BD lead detail typography, color, and identity card."
