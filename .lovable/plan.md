# BD Lead Detail — Flow, IA, and Cleanup Pass

Combines the structural redesign with the previously-deferred items. Two are kept out of scope with reasons noted at the bottom.

## Page structure (top → bottom, main column)

```
┌─ Sticky header: name, company, Prospect/Contact toggle, badges, stage stepper ─┐
│                                                                                 │
│ MAIN (col-8)                              ASIDE (col-4, sticky)                │
│ ───────────                               ─────────────────                    │
│ 1. Identity                               Activity                             │
│    name • role • company • email …        (notes, emails, calls,               │
│                                            meetings, stage changes              │
│ 2. Origin           ← MOVED UP             — running log for THIS lead)        │
│    Source · Event · First contact                                              │
│    3 emails · 1 call · last 2d ago        Connections   ← MOVED HERE           │
│                                            Same company (n)                    │
│ 3. Opportunity  (was Project Details)      Same property (n)                   │
│    Opportunity · Property · Architect/GC   Prior client? badge                 │
│                                                                                │
│ 4. Qualification                                                               │
│    Timeline · Expected value · Owner · Notes                                   │
│                                                                                │
│ 5. Outreach                                                                    │
│    Sequence enrollment + Next Follow-up (one-off)                              │
│                                                                                │
│ 6. Lineage (only when proposal/project exists)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Deletions: standalone "Acquisition Source" card (folded into Origin), legacy `bd-display` classes.

## Prospect vs Contact

- New column `leads.lead_kind` (`PROSPECT` default, or `CONTACT`).
- Toggle in the header next to the stage badge.
- Capture modal gets a checkbox **"Save as Contact only (not a live opportunity)"**.
- **Contacts do NOT auto-create clients/client_contacts.** They live in `leads` with `lead_kind=CONTACT`. The `clients`/`client_contacts` tables remain reserved for paying customers.
- **Contacts can still be enrolled in sequences** (manually) — useful for "keep in touch" cadences. The sequence dropdown is available on both Prospect and Contact pages; no auto-enroll.
- Contact pages **hide** the stage stepper, Won/Lost actions, and Expected Value (those imply a live deal). Everything else is the same.
- BD → Leads list: default view shows Prospects only; a filter chip surfaces Contacts. One-click **"Promote to Prospect"** button on a Contact page (lands at NEW stage).

## Outreach card (Sequence + Follow-up, side by side)

- **Sequence** (left half): shows current enrollment if any — `Post-event nurture · Step 2 of 5 · Next: Tue Jun 16`. Buttons: `Enroll ▾` / `Pause` / `Unenroll`. Templates managed in BD → Sequences (already exists, unchanged).
- **Next Follow-up** (right half): one-off personal reminder with date + note + Clear (same component, just half-width).
- Quiet inline nudge when both empty on a Prospect past NEW stage: *"No outreach scheduled. Enroll in a sequence or set a follow-up."*

## Disqualification reasons on LOST  *(now in scope)*

When stage moves to LOST, open a tiny inline confirm with required reason: `Not a fit` · `No budget` · `Went with competitor` · `Unresponsive` · `Wrong contact` · `Other (specify)`. Stored on the lead in a new column `lost_reason` (text, nullable). Shown as a small slate chip under the stage badge when present.

## IN_PERSON source enum  *(now in scope)*

Add `IN_PERSON` to the `bd_lead_source_type` enum. Label "In person" with a `Users` icon. Used when you meet someone walking the floor / on a job site / at a coffee shop and it's *not* tied to a tracked event. The capture-modal source picker gets it as a new option (no other modal changes).

## Tooltips — confusing fields only

Small `(i)` icon next to: **Stage**, **Hot**, **Source**, **Sequence**, **Next Follow-up**, **Connections**, **Expected value**, **Lead type**. One-line Radix tooltip each. No tooltips on Name/Email/Phone/Company/Address/Notes.

## Out of scope — with reasons

- **Capture-modal redesign** — bigger surface than this batch; the modal is functional today, and the only modal-related change here (adding `IN_PERSON` and the "Contact only" checkbox) is small. Full redesign deserves its own pass with screens.
- **BD sidebar nav restructure** — needs a separate IA conversation across all BD pages (Leads, Events, Sequences, Follow-ups, Market Signals). Doing it inside a lead-detail batch would scope-creep.

## Technical notes

- **Migration (one file):**
  - `ALTER TYPE bd_lead_source_type ADD VALUE 'IN_PERSON'`
  - `CREATE TYPE lead_kind AS ENUM ('PROSPECT','CONTACT')`
  - `ALTER TABLE leads ADD COLUMN lead_kind lead_kind NOT NULL DEFAULT 'PROSPECT'`
  - `ALTER TABLE leads ADD COLUMN lost_reason text`
- **Files touched:**
  - `src/pages/bd/BdLeadDetail.tsx` — reorder, Prospect/Contact toggle, Outreach card, LOST reason flow, tooltips
  - `src/pages/bd/BdLeads.tsx` — Contacts filter chip, default exclude Contacts from Prospect view
  - `src/components/bd/CaptureLeadModal.tsx` — "Save as Contact only" checkbox, `IN_PERSON` option
  - `src/components/bd/LeadConnectionsCard.tsx` — visual trim for sidebar
  - `src/components/bd/leadConstants.tsx` — SOURCE_META entry for `IN_PERSON`
  - New: `src/components/bd/InfoTip.tsx` (Radix tooltip wrapper around `Info` icon)
  - New: `src/components/bd/LeadOutreachCard.tsx` (Sequence + Follow-up combined)
- **Changelog entry** logged at the end.
