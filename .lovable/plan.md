
## Status

- ✅ **Pre-check**: `client_contacts` already holds architects/GCs (`license_type`, `license_number`, `specialty`, `is_referrer` columns present). `source_contact_id` FK is safe.
- ✅ **Migration**: `bd_referrals` table + enums + RLS + GRANTs applied (already approved & ran).
- ✅ **Seed**: 5 sample referrals inserted in the Green Light tenant (mix of owners Manny/Chris/Natalia, all 4 source types + OTHER, stages from Ask Made → Won, and one stalled row with no next-action date).
- ⏳ **Blocked on build mode**: hook, lane page, sidebar entry, route.

## Schema as shipped

`public.bd_referrals` columns: `company_id`, `source_contact_id` → `client_contacts`, `source_label` (fallback), **`source_type` enum** (`ARCHITECT` / `GC` / `OWNER` / `PM` / `OTHER`), `referred_name`, `referred_company`, `referred_email`, `referred_phone`, `assigned_to` → `profiles`, `stage` enum (`ASK_MADE` / `INTRO_RECEIVED` / `MEETING_SET` / `PROPOSAL` / `WON` / `LOST`), `next_action_at` date, `next_action_note`, `notes`, `lead_id`, `proposal_id`, `won_value`, `created_by`, standard timestamps + `deleted_at`.

RLS: SELECT `is_company_member`, INSERT/UPDATE `can_modify_operations`, DELETE admin-only — same helpers as `leads` / `bd_events`. Four partial indexes on company + (assigned_to / stage / next_action_at).

## Files to create / edit in build mode

1. **`src/components/bd/referralConstants.tsx`** — `STAGE_META`, `STAGE_ORDER`, `ALL_STAGES`, `TERMINAL_STAGES`, `stageRank`, `SOURCE_TYPE_META` (icons: Building2 / HardHat / KeyRound / ClipboardList / MoreHorizontal), and `isStalled(r)` helper = `!terminal && (no next_action_at || next_action_at < today)`. Mirrors `leadConstants.tsx`.
2. **`src/hooks/useBdReferrals.ts`** — `useReferrals(filters?)` list with joins `assignee:profiles!bd_referrals_assigned_to_fkey`, `source_contact:client_contacts!bd_referrals_source_contact_id_fkey`, `creator:profiles!bd_referrals_created_by_fkey`. Same query-key naming + `invalidateQueries` pattern as `useLeads`. No mutations yet (phase 2).
3. **`src/pages/bd/BdReferrals.tsx`** — header + subtitle matching `BdFollowUps`, owner filter chips (All / Me / Chris / Natalia driven by profiles + `useAuth`), single table grouped by stage with columns: Referred · Source (contact name + source-type pill) · Owner · Stage pill · Next action · **Stalled badge** (red `Stalled` pill rendered via `isStalled`, per your change #2). Empty state card identical to `BdFollowUps`.
4. **`src/App.tsx`** — `lazyWithRetry` import + `<Route path="/bd/referrals" element={<ProtectedRoute><BdReferrals /></ProtectedRoute>} />`.
5. **`src/components/layout/AppSidebar.tsx`** — add `{ title: "Referrals", icon: Handshake, href: "/bd/referrals", resource: "proposals" }` to the BD group between Leads and Events, plus matching entry in `routePrefetchMap`.

No new patterns, no dialog, no Friday view yet — those are phase 2.

## After build mode

I'll show the lane rendering against the 5 seeded rows (one stalled, one no-next-action, one terminal) and stop. Phase 2 (capture modal, stage stepper, Friday view, activity logging, convert-to-lead) waits for your sign-off.
