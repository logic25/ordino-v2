# Track what's waiting on who + smarter vacation handoff

## Why

Today the dashboard's "Stale" bucket just means "nothing changed in 14 days." It can't tell the difference between:
- You dropped the ball (idle, on you)
- You're correctly waiting on the client
- Client owes you a doc/signature/payment

And when a PM goes on vacation, the covering PM gets nothing — no list of what they're inheriting, no context on who's waiting on what.

This plan ships both in one pass because feature #2 depends on the state added in #1.

---

## Part 1 — Project "waiting on" state

### Schema (projects table)
- `waiting_on` enum: `us | client | agency | partner | none` (default `us`)
- `waiting_since timestamptz`
- `waiting_note text` (optional, e.g. "Waiting on signed PIS")

### UI
- One-click toggle in project header: "Waiting on client" / "Back to us" → sets `waiting_on` + stamps `waiting_since`
- Small badge on project rows (table + dashboard cards): `⏸ Waiting on client · 8d`
- Auto-reset to `us` when: client email arrives on the thread, PIS submitted, CO signed, payment posted (hook into existing webhooks)

### Smarter stale buckets in PMDailyView
Replace the single "Stale 14d+" bucket with three:
- 🔴 **On you, idle 7+ days** — `waiting_on=us` + no `updated_at` change
- 🟡 **Waiting on client 14+ days** — nudge-worthy; one-click "Send follow-up" using existing partner email templates
- ⚪️ **Truly stale 30+ days** — anything else

Beacon picks this up via the existing project context query.

---

## Part 2 — Vacation handoff (extends existing OOO)

### On OOO activation
Auto-generate a **handoff summary** for the covering PM:
- All open projects where `assigned_pm_id = me`
- For each: `waiting_on` state, days in that state, last client touch, next action
- Delivered as: in-app notification + email to cover

### During OOO window
- Covering PM's daily view shows inherited projects badged: `Covering for Chris (back Jun 3)`
- New email/notification routing for those projects → covering PM
- Original PM still sees them but read-only banner

### On return
"While you were out" digest: what changed, what the cover handled, what's still pending.

---

## Technical notes

- New enum + columns: simple migration, no breaking changes
- Auto-reset hooks: piggyback on existing `gmail-sync`, `pis-submit`, `change-orders` triggers — just `UPDATE projects SET waiting_on='us'` when relevant event fires
- Handoff summary: new edge function `generate-ooo-handoff` called from OOO save handler
- Routing during OOO: filter in `useEmails` / `useNotifications` already aware of `assigned_pm_id` — add OOO-cover fallback lookup
- All UI changes are additive (new badges, new toggle button, new bucket) — no rewrites

## Build order
1. Migration: `waiting_on` columns
2. Toggle UI on project header
3. Auto-reset hooks (gmail-sync, PIS, CO, payments)
4. Rewrite stale buckets in `PMDailyView`
5. Beacon awareness (project context query)
6. `generate-ooo-handoff` edge function
7. OOO save handler triggers handoff
8. Routing/cover badges in daily view + emails
9. Return digest

## Out of scope
- SMS/call responsiveness tracking
- Auto-suggested next action (AI) — manual `waiting_note` for now
- Multi-cover (one cover per OOO window)
