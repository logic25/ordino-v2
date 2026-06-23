## Goal
Add a "Teach Beacon" review queue inside the existing Beacon Hub so admin + manager users can fill KB gaps, fix flagged answers, and approve user suggestions — all in-app, no spreadsheet. Reuse existing plumbing; add only what's actually missing.

## Placement (consolidated in Beacon Hub — no standalone sidebar item)
- Beacon stays one place: **ask · usage · config · KB gaps · teach**.
- Add a new **"Teach"** tab to `src/pages/BeaconHub.tsx` next to Usage / Config / Gaps. Default tab order: Teach · Usage · Config · KB Gaps.
- Deep-link `/beacon/teach` resolves via existing `?tab=` pattern; no new route file.
- Hub currently requires admin. Loosen the **Teach tab only** to admin + manager via `usePermissions` / `useUserRoles`. **Conscious confirmation #1:** managers can teach Beacon, which influences answers for the whole team — accepted since managers are senior.

## Security (must land first)
The page reads `beacon_suggestions` and `beacon_feedback` directly from the client. That's only safe if RLS independently restricts both tables to admin + manager. Current state from `supabase/migrations/20260622232839_*.sql`: admin-only via `is_company_admin(...)` + same-company `EXISTS` join on `profiles`. Manager not yet covered.

Single migration before any new frontend code:
- DROP the existing policies by their actual `pg_policies.policyname` (per project security-migrations rule): `"Admins view own-company beacon feedback"`, `"Admins read own-company beacon suggestions"`, `"Admins review own-company beacon suggestions"`.
- Recreate them so the predicate passes when caller is admin **or** manager in the same company, using `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')`. Preserve the same-company `EXISTS` join on `profiles`.
- INSERT remains service-role only.
- End with the standard `SELECT … FROM pg_policies WHERE tablename IN (…)` verification query.

**Conscious confirmation #2:** this migration touches the same beacon_* tables as the in-flight security lockdown. Ship them together (or in strict sequence) so neither one drops a policy the other expects.

Page role-gate + RLS together — neither alone.

## Architecture (hybrid)
| Operation | How it runs |
|---|---|
| Read pending suggestions | direct `from("beacon_suggestions").select(...).eq("status","pending")` — reuses `useBeaconAnalytics` |
| Read 👎 feedback | direct `from("beacon_feedback").select("*").eq("status","new")`, client filter `feedback_type === "negative"` |
| Read KB gaps | `beacon-proxy` → new `get_kb_gaps` analytics action |
| Approve / reject a suggestion | existing `useReviewSuggestion` (direct UPDATE) |
| Teach (any source) | existing `beacon-proxy` `correction` — JWT-derived `user_id` / `user_name` |
| Mark a 👎 handled | `beacon-proxy` `update_feedback_roadmap` `{ feedback_id, status: "resolved" }` |
| Dismiss a gap | `beacon-proxy` `dismiss_kb_gap` |

Only net-new server work: two analytics actions + three admin/manager-gated proxy passthroughs.

## UI (shadcn, amber accent, matches Hub)
Single column, max-w-3xl, inside the Teach tab.

1. **Header strip** — counters: `N gaps · N flagged · N suggestions`.
2. **Quick Add card** ("+ Teach Beacon") — `Question` (Input), `Answer` (Textarea, 4 rows), optional `Topic` (Input). Submit → `correction`.
3. **Review queue** — three grouped sections, top to bottom:
   1. **KB Gaps** (highest value), sorted by frequency desc then last-asked desc.
   2. **👎 Flagged answers**, newest first.
   3. **Pending suggestions**, newest first.
   Empty groups collapse; full empty state: "Nothing to review — Beacon's caught up 🎉".

### Card shape per source
| Field | KB Gap | 👎 Flagged | Suggestion |
|---|---|---|---|
| Pill | `KB Gap · asked N×` | `👎 Flagged` | `Suggestion` |
| Question (read-only) | clustered question | parsed `Q:` from `feedback_text` | suggestion `wrong_answer` (or "—") |
| Beacon's answer (read-only, collapsible) | hidden | parsed `A:` from `feedback_text` | shown if differs from `correct_answer` |
| `Correct answer` Textarea | **empty** | **pre-filled with flagged answer** | **pre-filled with `correct_answer`** |
| Topic (Input) | empty | empty | pre-filled from `topics[0]` |
| Primary button | "Teach Beacon" | "Approve & teach" | "Approve & teach" |
| Secondary | "Not worth answering" | "Dismiss" | "Dismiss" |

All mutations optimistic + sonner toast. React Query keys: `["beacon-teach","gaps" | "feedback-negative" | "suggestions"]`.

### 👎 `feedback_text` parser (known debt)
Format Beacon emits today: `"👎 on Beacon answer — Q: <question> | A: <first 200 chars>"`. Splits on `" — Q: "` / `" | A: "`. On parse miss: render raw text, leave textarea empty.
**Debt flag:** this only works because the chat widget hard-codes that exact string. Robust fix later = store `question` / `flagged_answer` as separate columns on `beacon_feedback`. Not in scope for v1.

## New `beacon-analytics` actions

### `get_kb_gaps`
- Source: `beacon_interactions` from the last 60 days where `command = 'passive_gap'` OR (`answered = false` AND `confidence < 0.5`), AND `resolved_at IS NULL` (see migration below).
- Normalize question key (lowercase, strip punctuation, collapse whitespace).
- Group by normalized key. Cluster fields: `id` (most-recent member), `question` (most-recent original), `asked_count`, `last_asked_at`, `member_ids: number[]`, `topic`.
- **No `beacon_corrections` ilike dedup** — dismissal (below) is the source of truth for "already handled," and after a teach we mark the cluster resolved so it never reappears. Removed per review feedback.
- Order by `asked_count` desc, then `last_asked_at` desc. Cap at 50.

### `dismiss_kb_gap`
- Input: `{ member_ids: number[] }`.
- **Does NOT overwrite `command`.** Instead sets a new nullable timestamp column `resolved_at = now()` on each id. Historical analytics that count `command = 'passive_gap'` continue to work; "open gaps" = `resolved_at IS NULL`. Idempotent. Returns `{ ok: true }`.

### Migration addendum (same file as the RLS change)
- `ALTER TABLE public.beacon_interactions ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL;`
- Partial index for the gaps query: `CREATE INDEX IF NOT EXISTS beacon_interactions_open_gaps_idx ON public.beacon_interactions (timestamp DESC) WHERE resolved_at IS NULL AND (command = 'passive_gap' OR (answered = false AND confidence < 0.5));`
- Pre-flight grep of the codebase + edge functions: confirm nothing else filters on `command = 'passive_gap'` in a way that the new `resolved_at` semantics would break (read-only `command` is preserved, so this should be a no-op for existing readers).

## `beacon-proxy` additions
Three admin/manager-gated passthroughs (validate JWT → check role via `has_role` → forward to `beacon-analytics` with `x-beacon-key`):
- `get_kb_gaps`
- `dismiss_kb_gap`
- `update_feedback_roadmap`

`correction` / `feedback` continue to derive `user_id` / `user_name` from the JWT and ignore client values — unchanged.

## Files

**New**
- `src/components/beacon/BeaconTeachPanel.tsx` — Teach tab body.
- `src/components/beacon/QuickTeachForm.tsx`
- `src/components/beacon/TeachCard.tsx` — driven by `source: "gap" | "feedback" | "suggestion"`.
- `src/hooks/useBeaconTeach.ts` — `useKbGaps`, `useNegativeFeedback`, `usePendingSuggestionsForTeach`, `useTeachGap`, `useDismissGap`, `useTeachFromFeedback`, `useDismissFeedback`, `useQuickTeach`. Suggestion approve/reject reuses `useReviewSuggestion`.
- One SQL migration: admin+manager RLS on `beacon_suggestions` + `beacon_feedback`, plus `beacon_interactions.resolved_at` column + partial index. Coordinated with the in-flight security lockdown.

**Edited**
- `src/pages/BeaconHub.tsx` — add Teach tab (admin OR manager), render `<BeaconTeachPanel />`.
- `supabase/functions/beacon-analytics/index.ts` — add `get_kb_gaps`, `dismiss_kb_gap`.
- `supabase/functions/beacon-proxy/index.ts` — admin/manager-gated passthroughs for `get_kb_gaps`, `dismiss_kb_gap`, `update_feedback_roadmap`.

No new sidebar entry. No new route file. No new tables.

## Assumed payload shapes
- `log_correction`: `{ user_id, user_name, wrong_answer, correct_answer, topics }` (proxy overrides identity).
- `update_feedback_roadmap`: `{ feedback_id, status: "resolved" }`.
- `get_kb_gaps` / `dismiss_kb_gap`: new, shapes above.

## Acceptance
- Admin or manager opens Beacon Hub → sees a **Teach** tab with Quick Add + three grouped sections + live counters.
- KB Gaps lists clustered unanswered questions, ordered by frequency, empty answer textarea. "Teach Beacon" writes a `log_correction` then sets `resolved_at` on the cluster's members so it can't resurface.
- "Approve & teach" on a 👎 → `log_correction` + `update_feedback_roadmap{status:"resolved"}`. Card disappears, toast.
- "Approve & teach" on a suggestion → flip status to `approved` via existing path.
- Dismiss never writes to the KB.
- Quick Add → single `log_correction`, form clears.
- Non-admin/non-manager: no Teach tab AND direct selects against `beacon_suggestions` / `beacon_feedback` are blocked by RLS (verify post-migration with a PM session probe).
- Historical analytics queries against `command = 'passive_gap'` still return the same counts after dismissal (because we no longer overwrite `command`).
