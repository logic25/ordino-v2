## Lead Detail Page — Full Restructure

Base structure = **v3 (Architectural editorial)**. Color scheme = **Ordino slate/amber with cream accents** (a hint of the reference, not a full repaint). Follow-up treatment = **v2's bold gold card** (clearer than v3's muted version). All current sections preserved — v3 dropped a few that we're putting back.

### Visual system (scoped to `/bd/*` only)

Add a `.bd-section` scope in `index.css` that overlays cream tints on top of Ordino's existing slate/amber tokens — main app is untouched.

- Page background: `#faf8f3` (warm off-white, subtle nod to the reference cream)
- Surface / cards: `white` with `border-slate-200/70`
- Ink: existing slate-900 / slate-600 / slate-400
- Accent: existing **amber-500 / amber-600** (Ordino brand) — used for active pipeline stage, expected value, follow-up card, source tag
- Hairline dividers: `slate-200`
- Headings: Space Grotesk (already loaded)
- Body: DM Sans (add via Google Fonts link in `index.html`)
- Section labels: `text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700`

### Page composition (v3 skeleton, all sections restored)

```text
┌─────────────────────────────────────────────────────────────┐
│ Sticky header: ← Leads / breadcrumb                         │
│   Vanessa L. Gibson           [Edit details] [• • • menu]   │
│   Office of the Bronx Borough President                     │
│   [Event] [Hot] [client_type]                               │
│   ▰▰▰▱▱  Stage: Qualified                                  │
├──────────────────────────────────────┬──────────────────────┤
│ MAIN (col-span 8)                    │ ASIDE (col-span 4)   │
│                                      │                      │
│ § PRIMARY IDENTITY                   │ § ACTIVITY           │
│   Role        | Client type          │   (BdActivityThread, │
│   Email       | Phone                │    full height,      │
│   Address (full width)               │    sticky composer)  │
│                                      │                      │
│ § PROJECT DETAILS                    │                      │
│   Subject (inline edit)              │                      │
│   Property address (inline edit)     │                      │
│                                      │                      │
│ § QUALIFICATION                      │                      │
│   Timeline | Expected value | Owner  │                      │
│                                      │                      │
│ § NEXT FOLLOW-UP  ← amber card (v2)  │                      │
│   "Discuss Hudson Yards…"            │                      │
│   Jun 24 · [Clear]                   │                      │
│                                      │                      │
│ § SOURCE                             │                      │
│   NY Building Congress — Jun 15      │                      │
│                                      │                      │
│ § CONNECTIONS                        │                      │
│   People we know at this company     │                      │
│   Our work at this address           │                      │
└──────────────────────────────────────┴──────────────────────┘
```

All fields stay **inline-edit with debounced autosave** — click value → input → blur saves. No per-field buttons.

### Files changed

- `src/pages/bd/BdLeadDetail.tsx` — full rewrite into the layout above. Keep all existing hooks (`useLead`, `useUpdateLead`, `useLeadConnections`, `useBdActivities`).
- `src/index.css` — add Space Grotesk + DM Sans imports; add `.bd-scope` block with cream background and amber-700 label utility. No global token changes.
- `src/components/bd/LeadStageStepper.tsx` — restyle as horizontal bar segments (v3-style) using existing amber tokens. Same props.
- `src/components/bd/BdActivityThread.tsx` — minor: make it fill the parent height (`h-full` instead of fixed `h-[600px]`) so it slots into the sticky right rail.
- `index.html` — add Google Fonts `<link>` for Space Grotesk + DM Sans.

### Out of scope for this batch (carry-overs from earlier approved plan)

These were already approved but kept separate so this redesign ships independently:

1. `CaptureLeadModal` / `BdScanTab` source-picker copy ("In person" / "No event")
2. `lead_source_type` enum migration to add `IN_PERSON`
3. Camera permission helper text on the scan button

Confirm and I'll ship the redesign first, then tackle 1–3 in the next batch.
