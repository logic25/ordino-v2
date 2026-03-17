

# CitiSignal Complimentary Subscription Safeguards

## The Problem

If you give away CitiSignal monitoring free because the client uses you as their building expediter, you need proof that relationship exists and an automatic way to stop giving it away if the relationship ends. Otherwise you're handing out free monitoring with no accountability.

## Design

### New columns on `signal_subscriptions`

| Column | Type | Purpose |
|---|---|---|
| `is_complimentary` | boolean (default false) | Flags this as a freebie bundled with expediting |
| `enrolled_by` | uuid (FK → profiles) | Who sold/enrolled it — accountability |
| `linked_project_id` | uuid (FK → projects, nullable) | The expediting project that justifies the comp — proof we got the building |
| `monthly_rate` | numeric (nullable) | For paid subs — what they're paying |
| `billing_start_date` | date (nullable) | When billing begins for paid subs |
| `comp_reason` | text (nullable) | Free-text justification ("Active expediting client, 3 projects") |

### Business Rules

1. **Complimentary requires a linked project** — when `is_complimentary` is toggled on, the dialog forces you to select an active project for this property. No project = can't toggle it on. This is your proof you got the building.

2. **Auto-expiration for complimentary subs** — if no `expires_at` is set, default to **1 year from enrollment**. This forces a review. The SignalSection will show a countdown: "Comp expires in 47 days."

3. **Warning when linked project closes** — if the linked project's phase moves to `closeout` or status becomes inactive, the SignalSection shows a warning badge: "Linked project closed — review subscription." This is a UI-level check (not a trigger), keeping it simple.

4. **Trial = 14 days auto-expiry** — selecting "Trial" auto-sets `expires_at` to +14 days.

5. **Enrolled-by tracking** — auto-captured on creation so managers can see who's giving away comps.

### UI Changes

**SignalEnrollDialog** additions:
- "Complimentary" switch — only enabled when property has active projects
- When on: project selector dropdown (required), comp reason textarea, no monthly rate
- When off + status "active": monthly rate input, billing start date
- When status "trial": read-only expires_at showing 14-day date
- All modes: enrolled-by auto-captured (shown read-only on edit)

**SignalSection** additions:
- "Sold by: [Name]" line
- "Complimentary — linked to [Project Name]" or "Paid — $X/mo"
- Expiration countdown for comps and trials
- Warning badge if: comp with no linked project, linked project closed, or subscription expired

### Files Changed

| File | Change |
|---|---|
| Migration SQL | Add 6 columns to `signal_subscriptions` |
| `src/hooks/useSignalSubscriptions.ts` | Update types + mutation to include new fields, auto-set `enrolled_by` |
| `src/components/properties/SignalEnrollDialog.tsx` | Complimentary toggle, project selector, comp reason, rate input, auto-expiry logic |
| `src/components/properties/SignalSection.tsx` | Show enrolled-by, linked project, rate, expiration countdown, warning badges |
| `src/components/properties/SignalStatusBadge.tsx` | Add "complimentary" visual indicator |

### What this prevents

- Giving away monitoring without proof of an expediting relationship (linked project required)
- Forgetting to remove comps (auto-expiration + countdown)
- Not knowing who authorized the comp (enrolled-by tracking)
- Comps outliving the project relationship (warning when project closes)

