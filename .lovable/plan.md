## Plan: Capture pg_policies rule + close remaining security pass (#2 and #3)

You're right — let's finish the security pass instead of stopping at #1. Here's the full scope.

### Part A — Memory rule (option 2: memory + repo note)

1. **Save `mem://preferences/security-migrations`** with the rule:
   - Every RLS migration must end with a `pg_policies` verification query against the affected table.
   - Always `DROP POLICY` by the actual `pg_policies.policyname` — never a guessed label.
   - Reason: `DROP POLICY IF EXISTS` on a wrong name fails silently; permissive policies OR together, so a stale self-write policy survives a "fix" migration.
2. **Add one line to `mem://index.md` Core section** so it applies to every future action.
3. **Add `docs/security-migrations.md`** — short checklist (≤30 lines) mirroring the memory rule, with the exact `pg_policies` query to copy-paste.

### Part B — Issue #2: Beacon cross-tenant leak

Investigate first, then fix. I need to read these before writing the migration:
- `src/services/beaconApi.ts` and `supabase/functions/beacon-*` — confirm which edge function(s) accept a `company_id` from the client vs deriving it from the JWT.
- The RLS policies on whatever tables Beacon reads (likely `documents`, `projects`, `properties`, embeddings tables).

Likely fix shape (subject to what I find):
- Derive `company_id` server-side from `auth.uid()` → `profiles.company_id` inside the edge function, ignore any client-supplied value.
- Add an RLS policy or function-level guard that rejects queries where the derived `company_id` doesn't match the row.
- Verify with `pg_policies` per the new rule.

### Part C — Issue #3: `user_roles` cleanup (functions still reading `profiles.role`)

Investigate first:
- `grep` for functions referencing `profiles.role` (e.g. `is_manager`, `is_pm`, `is_production`).
- Compare `app_role` enum values (`admin`, `production`, `accounting`) against the role strings those functions check (`manager`, `pm`, `production`).
- Inspect `sync_profile_role_to_user_roles` trigger to see which roles it actually mirrors.

Then either:
- **If the enum covers every checked role:** migrate the functions to read from `user_roles` via `has_role()`, drop the `profiles.role` reads, keep the trigger as a safety net for one release, then drop it.
- **If there's a gap (e.g. `manager`/`pm` aren't in `app_role`):** extend the enum first in a separate migration, backfill `user_roles` from `profiles.role`, verify counts match, then migrate the functions. No behavior change.

This is cleanup, not a live hole, so I'll show you the function-by-function diff before applying.

### Order of operations

1. Land Part A (memory + repo note) — no DB changes, safe to ship immediately.
2. Investigate Part B, show you the edge-function + migration diff, ship after approval.
3. Investigate Part C, show you the enum/backfill/function diff, ship after approval.

Each DB migration ends with the `pg_policies` (or equivalent `pg_proc` for function changes) verification query, per the new rule.

### Why I paused instead of just doing all three earlier

Your last message framed #2 and #3 as "latent / cleanup" and asked whether to capture the lesson — I read that as "stop the sprint, just write the note." Re-reading now: you want the note **and** the remaining fixes. Plan above covers both.
