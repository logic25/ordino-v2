## Two problems, one plan

**Problem 1** — BD sidebar ballooned to 7 items (Leads, Referrals, Events, Sequences, Markets, Scorecard, Event Card). Sidebar total is now ~15 rows when BD is expanded. Too noisy.

**Problem 2** — `/bd/scorecard` is six identical gray metric cards + two plain cards. No hierarchy, no color, no story. It reads like a debug dump, not a scoreboard.

---

## Part 1 — Slim BD sidebar from 7 → 3

Keep only the things you touch daily in the sidebar. Move the rest one click deeper.

**New BD group (3 items):**
- **Leads** (`/bd/leads`)
- **Referrals** (`/bd/referrals`)
- **Events** (`/bd/events`)

**Moved:**
- **Sequences** → tab inside Leads page (it's just automated email cadences for leads — belongs there).
- **Scorecard** → promoted to a header button on both Leads and Referrals pages ("View Scorecard" with trophy icon). Also linked from Dashboard.
- **Event Card** → button inside Events page ("My QR Card"). It's a personal utility for use *at* an event, not a nav destination.
- **Markets** stays top-level (it's not BD-only — it feeds RFPs too).

Result: sidebar drops from 15 visible → 11. BD stops dominating.

---

## Part 2 — Redesign BD Scorecard (the "bland" part)

Commit to the trophy/amber theme already implied by the icon. Give the page a real personality.

**New structure, top to bottom:**

1. **Hero band** — dark slate gradient panel with amber accent stripe. Large person name + avatar, period selector (30/90/365 days), and the single most important number displayed huge: **Pipeline Value**. Below it: delta vs. prior period (▲ +$X or ▼ –$X) in green/red.

2. **KPI row (4 tiles, not 6)** — consolidate the noise:
   - **Asks made** (activity)
   - **Qualify rate** with mini sparkline
   - **Win rate** with mini sparkline
   - **Speed to 1st touch** with target line (goal: <24h)
   
   Each tile: colored icon chip (amber/emerald/sky/rose), big number, tiny trend arrow, previous-period comparison. Not identical gray boxes.

3. **Funnel visualization** — replace the 3-number grid with an actual visual funnel (horizontal bars that narrow: Scans → Qualified → Proposals → Won). Each stage shows count + conversion % to next stage. Uses primary + amber gradient.

4. **Leads by stage** — replace flat badge row with a compact stacked bar (Ask Made | Intro | Meeting | Proposal | Won | Lost), each segment amber-to-emerald based on health.

5. **Top referral sources leaderboard** (new) — top 5 sources by pipeline $, with tier badge (Gold/Silver/Bronze — already in your data). Small avatar/initial, name, $ won. Makes the "who's actually driving deals" story obvious.

6. **This week's activity** (new) — small strip showing last 7 days of BD activity from `bd_activities` (dots by day, count on hover). Answers "am I doing anything this week?" at a glance.

**Visual language:**
- Dark slate hero → light card body (contrast)
- Amber (#f59e0b) as the single accent for wins/pipeline, emerald for rates, muted slate for context
- Tabular-nums for all numbers
- Sparklines via existing recharts
- No new libraries needed

---

## Files to change

- `src/components/layout/AppSidebar.tsx` — trim BD group to 3 items, remove Scorecard/Sequences/Markets/Event Card entries (keep routes intact).
- `src/pages/bd/BdScorecard.tsx` — full visual rewrite; same data hook (`useBdScorecard`), no schema changes.
- `src/pages/bd/BdLeads.tsx` — add Sequences tab; add "Scorecard" header button.
- `src/pages/bd/BdReferrals.tsx` — add "Scorecard" header button.
- `src/pages/bd/BdEvents.tsx` — add "My QR Card" button linking to `/bd/event-card`.
- `src/hooks/useBdComp.ts` — extend `useBdScorecard` to also return prior-period comparison values and a 7-day activity spark array (single query addition, no new tables).

## Out of scope
- No changes to Referrals functionality, Friday View, or referral capture.
- No cron / RFP changes.
- No new sidebar redesign — just item pruning.

## What I need from you
Approve the plan, or tell me to also do the "BD Hub landing page" variant instead of promoting Scorecard to a header button.